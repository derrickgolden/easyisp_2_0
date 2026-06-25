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
        $this->middleware('permission:manage-sites')->except(['index', 'show', 'getIpamData', 'systemIndex']);
        $this->middleware('permission:view-sites')->only(['index', 'show', 'getIpamData']);
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
