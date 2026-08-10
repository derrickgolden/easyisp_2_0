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
        // $apiUrl = config('app.url') ?? 'https://aqua.easytech.africa';
        $apiUrl = 'https://aqua.easytech.africa';
        $nasIp = $site->ip_address ?? '10.20.20.3';
        $siteNameHtml = e($site->name);

        // 2. Define your clean Mikrotik login boilerplate template
        $htmlContent = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$siteNameHtml} Connect - Hotspot Login</title>
    <style>
        :root {
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --bg: #f8fafc;
            --card: #ffffff;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --success: #16a34a;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background-color: var(--bg); color: var(--text); padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .container { background: var(--card); width: 100%; max-width: 440px; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 28px; }
        .header h1 { font-size: 24px; color: var(--primary); margin-bottom: 6px; }
        .header p { font-size: 14px; color: var(--muted); }
        .section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 12px; font-weight: 700; }
        .packages-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 24px; }
        .package-card { border: 2px solid var(--border); border-radius: 10px; padding: 14px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s ease; text-align: left; background: none; width: 100%; color: inherit; }
        .package-card:hover { border-color: var(--primary); background-color: #f0f7ff; }
        .package-info .name { font-weight: 600; font-size: 16px; margin-bottom: 2px; }
        .package-info .meta { font-size: 12px; color: var(--muted); }
        .package-price { font-weight: 700; font-size: 18px; color: var(--primary); }
        .input-group { margin-bottom: 16px; position: relative; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
        .input-group input { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 15px; outline: none; transition: border 0.2s; }
        .input-group input:focus { border-color: var(--primary); }
        .btn { width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .btn:hover { background: var(--primary-hover); }
        .hidden { display: none !important; }
        .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 100; text-align: center; padding: 20px; }
        .spinner { width: 50px; height: 50px; border: 5px solid var(--border); border-top-color: #22c55e; border-radius: 50%; animation: spin 1s infinite linear; margin-bottom: 16px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        #mikrotik-auth-form { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{$siteNameHtml} Hotspot</h1>
            <p>Select a package</p>
        </div>

        <div class="section-title">Select Internet Package</div>
        <div id="packages-loading" style="color: var(--muted); font-size: 14px; margin-bottom: 20px;">Fetching dynamic packages...</div>
        <div class="packages-grid" id="packages-container"></div>

        <form id="form-mpesa" class="hidden" onsubmit="handleMpesaPurchase(event)">
            <input type="hidden" id="selected-package-id">
            <input type="hidden" id="selected-package-price">
            <div class="input-group">
                <label id="mpesa-form-label" for="mpesa-phone">Pay via M-Pesa for Selected Plan</label>
                <input type="tel" id="mpesa-phone" placeholder="e.g., 0712345678" required>
            </div>
            <button type="submit" class="btn" id="mpesa-submit-btn" style="background-color: #22c55e; margin-bottom: 24px;">Send M-Pesa STK Push</button>
        </form>

        <div class="section-title">Already have a code?</div>
        <form id="form-voucher" onsubmit="handleVoucherSubmit(event)">
            <div class="input-group">
                <label for="voucher-code">Voucher / Access Code</label>
                <input type="text" id="voucher-code" placeholder="Enter code here" required autocomplete="off">
            </div>
            <button type="submit" class="btn">Activate Voucher</button>
        </form>

        <form id="form-member" onsubmit="handleMemberSubmit(event)" style="margin-top: 30px;">
            <div class="input-group">
                <label for="username">Username</label>
                <input type="text" id="username" placeholder="e.g., 0712345678" required>
            </div>
            <div class="input-group">
                <label for="password">Password</label>
                <input type="password" id="password" placeholder="Enter password" required>
            </div>
            <button type="submit" class="btn">Sign In</button>
        </form>
    </div>

    <div id="mpesa-overlay" class="overlay hidden">
        <div class="spinner"></div>
        <h2 style="color: #22c55e; margin-bottom: 8px;">STK Push Sent!</h2>
        <p style="margin-bottom: 6px; font-weight: 600;">Check your phone for the M-Pesa PIN prompt.</p>
        <p style="color: var(--muted); font-size: 14px;" id="polling-status">Waiting for transaction validation...</p>
    </div>

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
                    container.innerHTML = '<div style="color: var(--muted); font-size:14px;">No internet packages available.</div>';
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
                    buttonCard.onclick = () => selectPackage(id, name, price);
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

        function selectPackage(id, name, price) {
            document.getElementById("selected-package-id").value = id;
            document.getElementById("selected-package-price").value = price;
            document.getElementById("mpesa-form-label").innerText = `Pay KES \${price} via M-Pesa for: \${name}`;
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

            const siteId = "{$nasIp}" || "\$(identity)" || "\$(server-address)";
            const clientMac = "\$(mac)" || "";
            const clientIp = "\$(ip)" || "";

            try {
                const response = await fetch(`\${API_BASE_URL}/api/payments/hotspot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone: phoneInput,
                        package_id: parseInt(packageId, 10), // <-- Hard cast to int here
                        amount: parseFloat(price),
                        site_id: siteId,
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
            let attempts = 0;
            const interval = setInterval(async () => {
                attempts++;
                pollingStatus.innerText = `Validating with Safaricom M-Pesa... (\${attempts})`;
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
                        document.getElementById("mpesa-submit-btn").disabled = false;
                    }
                } catch (err) {}
                if (attempts >= 20) {
                    clearInterval(interval);
                    alert("Verification timed out.");
                    document.getElementById("mpesa-overlay").classList.add("hidden");
                    document.getElementById("mpesa-submit-btn").disabled = false;
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
