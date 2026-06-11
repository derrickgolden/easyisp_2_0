<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Site;
use App\Models\Package;
use App\Models\Organization;
use App\Models\HotspotCustomer;
use Illuminate\Support\Facades\Log;

class HotspotController extends Controller
{
    public function portal(Request $request)
    {
        Log::info('hotspot.portal.request', [
            'site_ip' => $request->site_ip,
            'mac' => $request->mac,
            'ip' => $request->ip,
        ]);
        $site = Site::portalFields()->where(
            'ip_address',
            $request->site_ip
        )->firstOrFail();

        $organization = Organization::portalFields()->findOrFail($site->organization_id);

        $packages = Package::portalFields()->where(
            'organization_id',
            $site->organization_id
        )->get();

        $normalizedMac = $this->normalizeMacAddress((string) ($request->mac ?? ''));
        if ($normalizedMac !== null) {
            HotspotCustomer::query()->updateOrCreate(
                [
                    'organization_id' => $organization->id,
                    'mac_address' => $normalizedMac,
                ],
                [
                    'site_id' => $site->id,
                    'last_ip_address' => (string) ($request->ip ?? ''),
                    'last_seen_at' => now(),
                ]
            );
        }

        Log::info('hotspot.portal', [
            'site_id' => $site->id,
            'site_ip_address' => $site->ip_address,
            'organization_id' => $organization->id,
            'organization_name' => $organization->name,
            'packages_count' => $packages->count(),
            'mac' => $request->mac,
            'ip' => $request->ip,
        ]);
        return view('hotspot.portal', [
            'site' => $site,
            'organization' => $organization,
            'packages' => $packages,
            'mac' => $request->mac,
            'ip' => $request->ip,
        ]);
    }

    public function hotspot(Request $request)
    {
        return $this->portal($request);
    }

    public function pay(Request $request)
    {
        // STK Push here

        return redirect('/success');
    }

    public function success()
    {
        return view('hotspot.success');
    }

    private function normalizeMacAddress(string $mac): ?string
    {
        $raw = strtoupper(trim($mac));
        if ($raw === '') {
            return null;
        }

        $hexOnly = preg_replace('/[^A-F0-9]/', '', $raw) ?? '';
        if (strlen($hexOnly) !== 12) {
            return null;
        }

        return implode(':', str_split($hexOnly, 2));
    }
}