<?php

namespace App\Http\Controllers\Api;

use App\Models\Site;
use App\Services\MikrotikService;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;

class MikrotikController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:reboot-router')->only(['rebootSite']);
    }

    public function getUserTraffic(Request $request)
    {
        $username = $request->query('username');
        $nasIpAddress = $request->query('nas_ip_address');

        if (!$username) {
            Log::warning('Mikrotik traffic request missing username query param');
            return response()->json([
                'message' => 'username query parameter is required',
            ], 422);
        }

        try {
            $mikrotik = resolve(MikrotikService::class);
            $traffic = $mikrotik->getUserTraffic($username, $nasIpAddress);

            return response()->json($traffic);
        } catch (\Throwable $e) {
            Log::error("Failed to fetch MikroTik traffic for {$username}: {$e->getMessage()}", [
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'Failed to fetch user traffic',
                'username' => $username,
                'rx' => 0,
                'tx' => 0,
                'status' => 'offline',
            ], 500);
        }
    }

    public function rebootSite(Request $request, string $id)
    {
        $site = $this->resolveAccessibleSite($request, $id);
        if (!$site) {
            return response()->json([
                'message' => 'Site not found',
            ], 404);
        }

        try {
            $mikrotik = resolve(MikrotikService::class);
            $mikrotik->rebootSite($site);

            return response()->json([
                'message' => 'Router reboot command sent successfully',
                'site_id' => $site->id,
            ]);
        } catch (\Throwable $e) {
            Log::error("Failed to reboot MikroTik router for site {$site->id}: {$e->getMessage()}", [
                'site_id' => $site->id,
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'Failed to send reboot command',
            ], 500);
        }
    }

    private function resolveAccessibleSite(Request $request, string $id): ?Site
    {
        $user = $request->user();

        if ($user->is_super_admin) {
            if ($user->organization_id) {
                return Site::where('organization_id', $user->organization_id)->find($id);
            }

            return Site::find($id);
        }

        if (!$user->organization_id) {
            return null;
        }

        return Site::where('organization_id', $user->organization_id)->find($id);
    }
}