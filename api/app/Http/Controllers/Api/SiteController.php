<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SiteResource;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SiteController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->is_super_admin) {
            $query = Site::with('organization:id,name');
            if ($request->filled('organization_id')) {
                $query->where('organization_id', $request->organization_id);
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

        $site = Site::create(array_merge($data, [
            'organization_id' => $request->user()->organization_id,
        ]));

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

        $site->update($data);

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

        $site->delete();
        return response()->json(['message' => 'Site deleted successfully']);
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
