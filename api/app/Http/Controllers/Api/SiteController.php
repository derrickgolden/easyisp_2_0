<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SiteResource;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SiteController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:manage-sites')->except(['index', 'show', 'getIpamData', 'systemIndex', 'downloadHotspotTemplate', 'pppoePaymentPortal']);
        $this->middleware('permission:view-sites')->only(['index', 'show', 'getIpamData', 'downloadHotspotTemplate']);
    }

    /**
     * Serve a standalone PPPoE payment portal page for web-proxy redirects.
     *
     * Expected query params from redirect:
     * - site_id (optional): Site ID or NAS IP
     * - nas_ip  (optional): NAS IP
     * - ip      (optional): PPPoE client IP
     */
    public function pppoePaymentPortal(Request $request)
    {
        $siteInput = trim((string) (
            $request->query('site_id')
            ?? $request->query('site')
            ?? $request->query('nas_ip')
            ?? $request->query('nas')
            ?? ''
        ));

        $site = null;
        if ($siteInput !== '') {
            $site = Site::query()
                ->where('id', $siteInput)
                ->orWhere('ip_address', $siteInput)
                ->orWhere('name', $siteInput)
                ->first();
        }

        if (! $site) {
            return response()->json([
                'success' => false,
                'message' => 'Site not found for PPPoE portal request.',
            ], 404);
        }

        $templatePath = resource_path('portal/pppoepayment.html');
        if (!is_file($templatePath)) {
            return response()->json([
                'success' => false,
                'message' => 'PPPoE payment template not found.',
            ], 500);
        }

        $apiBaseUrl = rtrim((string) config('app.url', ''), '/');
        if ($apiBaseUrl === '') {
            $apiBaseUrl = rtrim($request->getSchemeAndHttpHost(), '/');
        }

        $rawHtml = file_get_contents($templatePath);
        $html = strtr((string) $rawHtml, [
            '__SITE_ID__' => (string) $site->id,
            '__SITE_NAME__' => (string) $site->name,
            '__SITE_NAS_IP__' => (string) ($site->ip_address ?? ''),
            '__API_BASE_URL__' => $apiBaseUrl,
        ]);

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    }

    public function systemIndex(Request $request)
    {
        $query = Site::with('organization:id,name');

        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->organization_id);
        }

        return SiteResource::collection($query->orderByDesc('created_at')->paginate(15));
    }
    
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->is_super_admin) {
            $query = Site::with('organization:id,name');
            if ($request->filled('organization_id')) {
                $query->where('organization_id', $request->organization_id);
            } elseif ($user->organization_id) {
                $query->where('organization_id', $user->organization_id);
            } else {
                return response()->json(['message' => 'Organization context required'], 403);
            }
            return SiteResource::collection($query->paginate(15));
        }

        if ($user->organization) {
            $sites = Site::where('organization_id', $user->organization_id)
                ->with('organization:id,name')
                ->paginate(15);
            return SiteResource::collection($sites);
        }

        return response()->json(['message' => 'Organization context required'], 403);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'location' => 'required|string',
            'ip_address' => 'required|string',
            'mikrotik_username' => 'nullable|string|max:255',
            'mikrotik_password' => 'nullable|string|max:255',
            'mikrotik_port' => 'nullable|integer|min:1|max:65535',
            'radius_secret' => 'nullable|string',
            'notify_on_down' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        if (empty($data['radius_secret'])) {
            $data['radius_secret'] = 'p5D031tEhfRNXBwm';
        }

        $site = DB::transaction(function () use ($data, $request) {
            $site = Site::create(array_merge($data, [
                'organization_id' => $request->user()->organization_id,
            ]));
            $this->syncNas($site);
            return $site;
        });

        return response()->json([
            'message' => 'Site created successfully',
            'site' => new SiteResource($site),
        ], 201);
    }

    public function show($id)
    {
        $site = Site::find($id);
        if (!$site) {
            return response()->json(['message' => 'Site not found'], 404);
        }
        return new SiteResource($site);
    }

    public function update(Request $request, $id)
    {
        $site = Site::find($id);
        if (!$site) {
            return response()->json(['message' => 'Site not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'location' => 'sometimes|string',
            'ip_address' => 'sometimes|string',
            'mikrotik_username' => 'nullable|string|max:255',
            'mikrotik_password' => 'nullable|string|max:255',
            'mikrotik_port' => 'nullable|integer|min:1|max:65535',
            'radius_secret' => 'nullable|string',
            'notify_on_down' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        if (array_key_exists('radius_secret', $data) && empty($data['radius_secret'])) {
            unset($data['radius_secret']);
        }

        $oldIpAddress = $site->ip_address;

        DB::transaction(function () use ($site, $data, $oldIpAddress) {
            $site->update($data);
            $this->syncNas($site, $oldIpAddress);
        });

        return response()->json([
            'message' => 'Site updated successfully',
            'site' => new SiteResource($site),
        ]);
    }

    public function destroy($id)
    {
        $site = Site::find($id);
        if (!$site) {
            return response()->json(['message' => 'Site not found'], 404);
        }

        DB::transaction(function () use ($site) {
            $this->deleteNas($site);
            $site->delete();
        });

        return response()->json(['message' => 'Site deleted successfully']);
    }

    private function syncNas(Site $site, ?string $oldIpAddress = null): void
    {
        $description = 'Site: ' . $site->name . ' (' . ($site->location ?? 'Not specified') . ')';
        $radiusConnection = DB::connection('radius');

        // 3. If the IP address actually changed, delete or overwrite the old record
        if ($oldIpAddress && $oldIpAddress !== $site->ip_address) {
            $radiusConnection->table('nas')
                ->where('nasname', $oldIpAddress)
                ->where('organization_id', $site->organization_id)
                ->delete();
        }

        $radiusConnection->table('nas')->updateOrInsert(
            ['nasname' => $site->ip_address, 'organization_id' => $site->organization_id],
            [
                'nasname'         => $site->ip_address,
                'shortname'       => $site->name,
                'type'            => 'other',
                'secret'          => $site->radius_secret ?? 'secret',
                'description'     => $description,
                'organization_id' => $site->organization_id,
                'status'          => 'active',
            ]
        );
    }

    private function deleteNas(Site $site): void
    {
        DB::connection('radius')->table('nas')
            ->where('nasname', $site->ip_address)
            ->where('organization_id', $site->organization_id)
            ->delete();
    }

    /**
     * Generate and stream the login.html Mikrotik template for a site.
     */
    public function downloadHotspotTemplate($id)
    {
        $site = Site::find($id);
        if (!$site) {
            return response()->json(['message' => 'Site not found'], 404);
        }

        // 1. Get the domain/URL from configuration or app defaults
        $apiUrl = config('app.url') ?? 'https://isp.easytech.africa';
        $nasIp = $site->ip_address ?? '10.20.20.3';
        $siteNameHtml = e($site->name);
        $companyName = trim((string) data_get($site->organization?->settings, 'general.isp_legal_name', ''));
        $companyNameHtml = e($companyName !== '' ? $companyName : ($site->organization?->name . ' Hotspot' ?? 'Easy Tech Hotspot'));
        $supportHotline = trim((string) data_get($site->organization?->settings, 'general.support_hotline', ''));
        $supportHotline = $supportHotline !== '' ? $supportHotline : '+254714475702';
        $supportPhone = preg_replace('/[^\d+]/', '', $supportHotline);
        $whatsappNumber = preg_replace('/\D+/', '', $supportHotline);
        if (str_starts_with($whatsappNumber, '0')) {
            $whatsappNumber = '254' . substr($whatsappNumber, 1);
        }

        // 2. Define your clean Mikrotik login boilerplate template
        $htmlContent = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$siteNameHtml} - Hotspot Login</title>
    <style>
        :root {
            --primary: #2563eb;
            --primary-gradient: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            --mpesa: #16a34a;
            --mpesa-gradient: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            --bg: #f1f5f9;
            --card-bg: #ffffff;
            --text-main: #0f172a;
            --text-muted: #475569;
            --border: #cbd5e1;
            --ring: rgba(37, 99, 235, 0.25);
            --radius-lg: 24px;
            --radius-md: 16px;
            --radius-sm: 10px;
            --shadow: 0 12px 30px -5px rgba(15, 23, 42, 0.12), 0 8px 12px -6px rgba(15, 23, 42, 0.06);
            --pop-shadow: 0 10px 20px rgba(37, 99, 235, 0.15);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            background: var(--bg);
            background-image: radial-gradient(at 50% 0%, rgba(37, 99, 235, 0.1) 0px, transparent 70%);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 16px;
            font-size: 16px; /* Increased base size */
        }

        .container {
            background: var(--card-bg);
            width: 100%;
            max-width: 460px;
            padding: 32px 24px;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow);
            border: 1px solid rgba(255, 255, 255, 0.8);
        }

        /* Header Section */
        .header {
            text-align: center;
            margin-bottom: 28px;
        }

        .brand-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            background: rgba(37, 99, 235, 0.12);
            color: var(--primary);
            border-radius: 50%;
            margin-bottom: 12px;
        }

        .header h1 {
            font-size: 28px; /* Bigger title */
            font-weight: 800;
            color: var(--text-main);
            letter-spacing: -0.02em;
        }

        .header p {
            font-size: 16px; /* Bigger subtitle */
            color: var(--text-muted);
            margin-top: 6px;
            font-weight: 500;
        }

        /* ULTRA-SHORT INSTRUCTIONS BOX */
        .how-to-pay {
            background: #eff6ff;
            border: 2px solid #bfdbfe;
            border-radius: var(--radius-md);
            padding: 14px 16px;
            margin-bottom: 24px;
        }

        .how-to-pay-title {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--primary);
            font-weight: 800;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .steps-list {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
        }

        .step-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: 700;
            color: var(--text-main);
        }

        .step-num {
            background: var(--primary);
            color: #ffffff;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 800;
            flex-shrink: 0;
        }

        .step-arrow {
            color: #93c5fd;
            font-weight: 800;
            font-size: 14px;
        }

        /* Section Titles */
        .section-title {
            font-size: 14px; /* Larger section headers */
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            margin: 28px 0 14px 0;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 5rem;
        }

        .section-title::after {
            content: "";
            flex: 1;
            height: 2px;
            background: #e2e8f0;
            /* margin-top: 2rem; */
        }

        /* SQUARE PACKAGE CARDS GRID */
        .packages-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr); /* 2-Column Square Grid */
            gap: 14px;
        }

        @media (max-width: 340px) {
            .packages-grid {
                grid-template-columns: 1fr; /* Fallback for very small screens */
            }
        }

        .package-card {
            border: 2px solid var(--border);
            border-radius: var(--radius-md);
            padding: 16px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: flex-start;
            cursor: pointer;
            transition: all 0.25 cubic-bezier(0.175, 0.885, 0.32, 1.275);
            background: #ffffff;
            width: 100%;
            color: inherit;
            position: relative;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
            text-align: left;
        }

        /* POP-OUT HOVER & ACTIVE EFFECT */
        .package-card:hover, .package-card:focus-visible {
            border-color: var(--primary);
            background-color: #f8fafc;
            transform: translateY(-5px) scale(1.02); /* Pops up */
            box-shadow: var(--pop-shadow);
        }

        .package-card:active {
            transform: translateY(-2px) scale(1);
        }

        .package-info {
            width: 100%;
            text-align: center;
        }

        .package-info .name {
            font-weight: 800;
            font-size: 20px; /* High priority bigger font */
            color: yellowgreen;
            line-height: 1.2;
            margin-bottom: 6px;
            word-break: break-word;
            text-align: center;
        }

        .package-info .meta {
            font-size: 18px; /* Larger sub-info */
            color: #6809ec;
            font-weight: 500;
            text-align: center;
        }

        .package-price {
            font-weight: 900;
            font-size: 18px; /* Bigger price badge */
            color: #ffffff;
            background: var(--primary-gradient);
            padding: 8px 12px;
            border-radius: var(--radius-sm);
            width: 100%;
            text-align: center;
            /* box-shadow: 0 3px 8px rgba(37, 99, 235, 0.25); */
            background: var(--mpesa-gradient) !important;
            box-shadow: 0 4px 14px rgba(22, 163, 74, 0.25) !important;
            margin-top: 8px;
        }

        /* Dynamic Loading State */
        #packages-loading {
            text-align: center;
            padding: 20px;
            background: #f8fafc;
            border-radius: var(--radius-md);
            border: 2px dashed var(--border);
            font-size: 15px;
            font-weight: 600;
        }

        /* Forms & Inputs */
        .input-group {
            margin-bottom: 16px;
        }

        .input-group label {
            display: block;
            font-size: 14px; /* Bigger labels */
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--text-main);
        }

        .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }

        .input-wrapper input {
            width: 100%;
            padding: 14px 16px; /* Larger input padding */
            border: 2px solid var(--border);
            border-radius: var(--radius-md);
            font-size: 16px; /* Prevent auto-zoom on mobile safari & easier typing */
            font-weight: 600;
            outline: none;
            background: #f8fafc;
            color: var(--text-main);
            transition: all 0.2s ease;
        }

        .input-wrapper input:focus {
            background: #ffffff;
            border-color: var(--primary);
            box-shadow: 0 0 0 4px var(--ring);
        }

        /* Buttons */
        .btn {
            width: 100%;
            padding: 16px; /* Larger touch-target buttons */
            background: var(--primary-gradient);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            font-size: 16px; /* Bigger text */
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
            display: inline-flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
        }

        .btn:hover {
            opacity: 0.95;
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn-mpesa {
            background: var(--mpesa-gradient) !important;
            box-shadow: 0 4px 14px rgba(22, 163, 74, 0.25) !important;
        }

        /* M-Pesa Form Dynamic Box */
        #form-mpesa {
            background: #f0fdf4;
            border: 2px solid #86efac;
            padding: 20px;
            border-radius: var(--radius-md);
            margin: 18px 0;
            animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Overlay & Loader */
        .overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(5px);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 100;
            padding: 20px;
        }

        .overlay-card {
            background: #ffffff;
            padding: 36px 28px;
            border-radius: var(--radius-lg);
            text-align: center;
            max-width: 360px;
            width: 100%;
            box-shadow: var(--shadow);
        }

        .spinner {
            width: 52px;
            height: 52px;
            border: 5px solid var(--border);
            border-top-color: var(--mpesa);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 18px auto;
        }

        /* Support Section Styling */
        .support-card {
            background: #f8fafc;
            border: 2px solid var(--border);
            border-radius: var(--radius-md);
            padding: 16px;
            text-align: center;
            margin-top: 10px;
        }

        .support-text {
            font-size: 14px;
            color: var(--text-muted);
            font-weight: 500;
            margin-bottom: 14px;
            line-height: 1.4;
        }

        .hotline-card {
            padding: 18px;
            margin: 0 0 24px;
            border: 1px solid #bfdbfe;
            border-radius: var(--radius-md);
            background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
        }

        .hotline-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
        }

        .hotline-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #dbeafe;
            color: var(--primary);
            flex-shrink: 0;
        }

        .hotline-heading {
            display: block;
            color: var(--text-main);
            font-size: 15px;
            font-weight: 900;
        }

        .hotline-label {
            display: block;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-top: 3px;
        }

        .hotline-contacts {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .hotline-contact {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            min-width: 0;
            padding: 12px;
            border: 1px solid #dbeafe;
            border-radius: var(--radius-sm);
            background: #ffffff;
        }

        .hotline-number {
            display: block;
            color: var(--primary);
            font-size: 17px;
            font-weight: 900;
            overflow-wrap: anywhere;
        }

        .call-hotline {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 12px;
            border: 1px solid #93c5fd;
            border-radius: var(--radius-sm);
            background: #ffffff;
            color: var(--primary);
            font-size: 13px;
            font-weight: 800;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .call-hotline:hover {
            background: #dbeafe;
            border-color: var(--primary);
        }

        .call-hotline:focus-visible {
            outline: 3px solid var(--ring);
            outline-offset: 2px;
        }

        @media (max-width: 360px) {
            .hotline-contacts {
                grid-template-columns: 1fr;
            }

            .call-hotline {
                justify-content: center;
            }
        }

        .support-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .support-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 10px;
            border-radius: var(--radius-sm);
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.2s ease;
        }

        .btn-call {
            background: #ffffff;
            color: var(--primary);
            border: 2px solid var(--primary);
        }

        .btn-call:hover {
            background: rgba(37, 99, 235, 0.08);
        }

        .btn-whatsapp {
            background: #25d366;
            color: #ffffff;
            border: 2px solid #25d366;
        }

        .btn-whatsapp:hover {
            background: #20ba5a;
            border-color: #20ba5a;
        }

        .login-error {
            margin: 16px 0;
            padding: 16px;
            border-radius: 12px;
            background: #fff7ed;
            border: 1px solid #fed7aa;
            color: #9a3412;
        }

        .error-title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 6px;
        }

        .error-message {
            font-size: 14px;
            line-height: 1.5;
        }


        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .hidden { display: none !important; }
        #mikrotik-auth-form { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="brand-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            </div>
            <h1>{$companyNameHtml}</h1>
            <p>Select a pack to get connected</p>
        </div>

        <!-- Hotline Support phone numbers -->
        <div class="hotline-card">
            <div class="hotline-header">
                <span class="hotline-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 1 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 1 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </span>
                <div>
                    <strong class="hotline-heading">Need help? Call support</strong>
                    <span class="hotline-label">Our support team is ready to help</span>
                </div>
            </div>
            <div class="hotline-contacts">
                <div class="hotline-contact">
                <div class="hotline-copy">
                    <strong class="hotline-number">{$supportPhone}</strong>
                </div>
                <a href="tel:{$supportPhone}" class="call-hotline" aria-label="Call support on {$supportPhone}">
                    <span>Call</span>
                </a>
            </div>
                <div class="hotline-contact">
                <div class="hotline-copy">
                    <strong class="hotline-number">0789824337</strong>
                </div>
                <a href="tel:0789824337" class="call-hotline" aria-label="Call support on 0789824337">
                    <span>Call</span>
                </a>
                </div>
            </div>
        </div>

        <!-- ULTRA-SHORT HOW TO PAY INSTRUCTIONS -->
        <div class="how-to-pay">
            <div class="how-to-pay-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                How to Connect
            </div>
            <div class="steps-list">
                <div class="step-item">
                    <span class="step-num">1</span> Choose Package
                </div>
                <span class="step-arrow">➔</span>
                <div class="step-item">
                    <span class="step-num">2</span> Enter Phone
                </div>
                <span class="step-arrow">➔</span>
                <div class="step-item">
                    <span class="step-num">3</span> Enter PIN
                </div>
            </div>
        </div>

        <!-- Packages Section -->
        <div style="margin-top: auto;" class="section-title">Select Internet Package</div>
        <div id="packages-loading">
            <span style="color: var(--text-muted);">Getting packages...</span>
        </div>
        <div class="packages-grid" id="packages-container"></div>

        <!-- Dynamic M-Pesa Form -->
        <form id="form-mpesa" class="hidden" onsubmit="handleMpesaPurchase(event)">
            <input type="hidden" id="selected-package-id">
            <input type="hidden" id="selected-package-price">
            <div class="input-group" style="margin-bottom: 12px;">
                <label id="mpesa-form-label" for="mpesa-phone" style="color: #15803d; font-size: 15px;">Pay via M-Pesa</label>
                <div class="input-wrapper">
                    <input type="tel" id="mpesa-phone" placeholder="e.g., 0712345678" required>
                </div>
            </div>
            <button type="submit" class="btn btn-mpesa" id="mpesa-submit-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Send M-Pesa STK Push
            </button>
        </form>

        <div id="mikrotik-error" style="display:none;">$(error)</div>

        <div id="customer-error" class="login-error" style="display:none;">
            <div class="error-title"></div>
            <div class="error-message"></div>
        </div>

        <script>
        (function () {
            var mikrotikError = document.getElementById("mikrotik-error");
            var customerError = document.getElementById("customer-error");
            var errorTitle = customerError.querySelector(".error-title");
            var errorMessage = customerError.querySelector(".error-message");

            if (!mikrotikError) return;

            var message = mikrotikError.textContent.trim();

            // Check if MikroTik populated an error message
            var UNPARSED_VAR = "$(" + "error)";
            if (message && message !== UNPARSED_VAR) {
                // Handle specific MikroTik error cases
                if (message.indexOf("already logged in") !== -1) {
                    errorTitle.textContent = "Voucher Already In Use";
                    errorMessage.textContent = "This voucher is connected on another device. Please disconnect the other device before trying again.";
                } else if (message.indexOf("invalid username") !== -1 || message.indexOf("not found") !== -1) {
                    errorTitle.textContent = "Invalid Code or Password";
                    errorMessage.textContent = "The voucher or credentials entered are incorrect. Please double-check and try again.";
                } 
                
                // Display error banner
                customerError.style.display = "block";

                // Smooth scroll error banner into view automatically
                setTimeout(function () {
                    requestAnimationFrame(function () {
                        customerError.scrollIntoView({ 
                            behavior: "smooth", 
                            block: "center" 
                        });
                    });
                }, 100);
            }
        })();
</script>

        <!-- Voucher Form -->
        <div class="section-title">Already Have A Code?</div>
        <form id="form-voucher" onsubmit="handleVoucherSubmit(event)">
            <div class="input-group">
                <div class="input-wrapper">
                    <input type="text" id="voucher-code" placeholder="Enter Voucher or Access Code" required autocomplete="off" oninput="this.value = this.value.toUpperCase()">
                </div>
            </div>
            <button type="submit" class="btn">Activate Voucher</button>
        </form>

        <!-- Member Form -->
        <div class="section-title">Member Login</div>
        <form id="form-member" onsubmit="handleMemberSubmit(event)">
            <div class="input-group">
                <div class="input-wrapper">
                    <input type="text" id="username" placeholder="Username / Phone Number" required>
                </div>
            </div>
            <div class="input-group">
                <div class="input-wrapper">
                    <input type="password" id="password" placeholder="Password" required>
                </div>
            </div>
            <button type="submit" class="btn">Sign In</button>
        </form>

        <div class="section-title">Need Help?</div>
        <div class="support-card">
            <p class="support-text">Having trouble connecting? Contact our team for quick support.</p>
            <div class="support-actions">
                <a href="tel:{$supportPhone}" class="support-btn btn-call">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Call Support
                </a>
            </div>
        </div>
    </div>

    <!-- Status Overlay -->
    <div id="mpesa-overlay" class="overlay hidden">
        <div class="overlay-card">
            <div class="spinner"></div>
            <h2 style="color: var(--mpesa); margin-bottom: 8px; font-weight: 800; font-size: 22px;">STK Push Sent!</h2>
            <p style="margin-bottom: 10px; font-weight: 700; font-size: 16px;">Check your phone for the M-Pesa PIN prompt.</p>
            <p style="color: var(--text-muted); font-size: 14px;" id="polling-status">Waiting for transaction validation...</p>
        </div>
    </div>

    <!-- Hidden MikroTik Auth Form -->
    <form id="mikrotik-auth-form" name="login" action="\$(link-login-only)" method="post">
        <input type="hidden" name="username" id="mt-user" value="\$(username)" />
        <input type="hidden" name="password" id="mt-pass" />
        <input type="hidden" name="dst" value="\$(link-orig)" />
        <input type="hidden" name="popup" value="true" />
        <input type="hidden" name="chap-id" value="\$(chap-id)" />
        <input type="hidden" name="chap-challenge" value="\$(chap-challenge)" />
        <input type="hidden" name="link-login" value="\$(link-login)" />
        <input type="hidden" name="link-login-only" value="\$(link-login-only)" />
    </form>

    <script>
        const API_BASE_URL = "{$apiUrl}";
        document.addEventListener("DOMContentLoaded", fetchPackages);

        async function fetchPackages() {
            const container = document.getElementById("packages-container");
            const loadingText = document.getElementById("packages-loading");
            try {
                const response = await fetch(`\${API_BASE_URL}/api/hotspot/packages?nas_ip={$nasIp}`);
                if (!response.ok) throw new Error("Failed to fetch data");
                const packages = await response.json();

                loadingText.classList.add("hidden");
                container.innerHTML = "";

                if(packages.length === 0) {
                    container.innerHTML = '<div style="color: var(--text-muted); font-size:15px; text-align:center; grid-column: span 2;">No internet packages available.</div>';
                    return;
                }

                packages.forEach(pkg => {
                    const id = pkg.id || pkg._id;
                    const name = pkg.name || pkg.plan_name;
                    const price = pkg.price || pkg.amount;
                    const validity = pkg.validity || pkg.duration || "Access Pack";
                    const validity_type = pkg.validity_type || "";

                    const buttonCard = document.createElement("button");
                    buttonCard.className = "package-card";
                    buttonCard.type = "button";
                    buttonCard.onclick = () => selectPackage(id, name, price, validity, validity_type);

                    // Exact innerHTML structure requested with square pop-out styling
                    buttonCard.innerHTML = `
                        <div class="package-info">
                            <div class="name">\${name}</div>
                            <div class="meta">\${validity} \${validity_type}</div>
                        </div>
                        <div class="package-price">KES \${price}</div>
                    `;
                    container.appendChild(buttonCard);
                });
            } catch (error) {
                loadingText.innerText = "Error loading packages.";
            }
        }

        function selectPackage(id, name, price, validity, validity_type) {
            document.getElementById("selected-package-id").value = id;
            document.getElementById("selected-package-price").value = price;
            document.getElementById("mpesa-form-label").innerText = `Pay KES \${price} via M-Pesa to get \${validity} \${validity_type} WiFi connectivity.`;
            document.getElementById("form-mpesa").classList.remove("hidden");
            document.getElementById("mpesa-phone").focus();
            document.getElementById("form-mpesa").scrollIntoView({ behavior: 'smooth' });
        }

        async function handleMpesaPurchase(event) {
            event.preventDefault();
            const phoneInput = document.getElementById("mpesa-phone").value.trim();
            const packageId = document.getElementById("selected-package-id").value;
            const price = document.getElementById("selected-package-price").value;
            const submitBtn = document.getElementById("mpesa-submit-btn");
            const overlay = document.getElementById("mpesa-overlay");

            if (!phoneInput || !packageId) return;

            submitBtn.disabled = true;
            submitBtn.innerText = "Processing...";

            const siteIp = "{$nasIp}" || "\$(identity)" || "\$(server-address)";
            const clientMac = "\$(mac)" || "";
            const clientIp = "\$(ip)" || "";

            try {
                const response = await fetch(`\${API_BASE_URL}/api/payments/hotspot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone: phoneInput,
                        package_id: parseInt(packageId, 10),
                        amount: parseFloat(price),
                        site_ip: siteIp,
                        mac: clientMac,
                        ip: clientIp,
                        transaction_type: "CustomerPayBillOnline"
                    })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || "Request failed.");
                overlay.classList.remove("hidden");
                pollTransactionStatus(result.checkout_request_id || result.reference);
            } catch (error) {
                alert(error.message);
                submitBtn.disabled = false;
                submitBtn.innerText = "Send M-Pesa STK Push";
            }
        }

        function pollTransactionStatus(reference) {
            const pollingStatus = document.getElementById("polling-status");
            let attempts = 15;
            const interval = setInterval(async () => {
                pollingStatus.innerText = `Validating with Safaricom M-Pesa... (\${attempts} attempts remaining)`;
                try {
                    const res = await fetch(`\${API_BASE_URL}/api/payments/hotspot/check-status?reference=\${reference}`);
                    const data = await res.json();
                    if (res.ok && data.status === "completed") {
                        clearInterval(interval);
                        executeMikrotikLogin(data.code || data.voucher_code, data.code || data.voucher_code);
                    } else if (data.status === "failed") {
                        clearInterval(interval);
                        alert("Transaction failed.");
                        document.getElementById("mpesa-overlay").classList.add("hidden");
                        const submitButton = document.getElementById("mpesa-submit-btn");
                        submitButton.disabled = false;
                        submitButton.innerText = "Send M-Pesa STK Push";
                    }
                } catch (err) {}
                attempts--;
                if (attempts <= 0) {
                    clearInterval(interval);
                    alert("Verification timed out. If you have completed the payment, please contact support for the voucher code.");
                    document.getElementById("mpesa-overlay").classList.add("hidden");
                    const submitButton = document.getElementById("mpesa-submit-btn");
                    submitButton.disabled = false;
                    submitButton.innerText = "Send M-Pesa STK Push";
                }
            }, 3000);
        }

        function handleVoucherSubmit(event) {
            event.preventDefault();
            const code = document.getElementById('voucher-code').value.trim();
            if (code) executeMikrotikLogin(code, code);
        }

        function handleMemberSubmit(event) {
            event.preventDefault();
            const user = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value;
            if (user && pass) executeMikrotikLogin(user, pass);
        }

        function executeMikrotikLogin(username, password) {
            document.getElementById('mt-user').value = username;
            document.getElementById('mt-pass').value = password;
            document.getElementById('mikrotik-auth-form').submit();
        }

    </script>
</body>
</html>
HTML;

        // 3. Return string as clean text/html file download headers
        return response($htmlContent, 200, [
            'Content-Type' => 'text/html',
            'Content-Disposition' => 'attachment; filename="login.html"',
            'Cache-Control' => 'no-cache, private',
        ]);
    }

    /**
     * Get IP allocation map for a site (IPAM)
     */
    public function getIpamData($id)
    {
        $site = Site::find($id);
        if (!$site) {
            return response()->json(['message' => 'Site not found'], 404);
        }

        // Extract base network from site IP (e.g., 192.168.1.1 -> 192.168.1)
        $ipParts = explode('.', $site->ip_address);
        $baseNetwork = implode('.', array_slice($ipParts, 0, 3));

        // Get all customers with IPs in this subnet
        $customers = \App\Models\Customer::where('site_id', $site->id)
            ->whereNotNull('ip_address')
            ->select('id', 'first_name', 'last_name', 'ip_address', 'status', 'radius_username')
            ->get();

        // Create IP allocation map (last octet -> customer data)
        $allocations = [];
        foreach ($customers as $customer) {
            $customerIpParts = explode('.', $customer->ip_address);
            $lastOctet = (int) end($customerIpParts);
            
            $allocations[$lastOctet] = [
                'id' => $customer->id,
                'name' => $customer->first_name . ' ' . $customer->last_name,
                'username' => $customer->radius_username,
                'status' => $customer->status,
                'ip' => $customer->ip_address,
            ];
        }

        return response()->json([
            'site_id' => $site->id,
            'site_name' => $site->name,
            'base_network' => $baseNetwork,
            'subnet' => $baseNetwork . '.0/24',
            'allocations' => $allocations,
            'total_allocated' => count($allocations),
            'total_available' => 254 - count($allocations),
        ]);
    }
}
