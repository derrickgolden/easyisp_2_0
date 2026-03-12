<?php

namespace App\Http\Controllers\Api;

use App\Services\MikrotikService;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;

class MikrotikController extends Controller
{
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
}