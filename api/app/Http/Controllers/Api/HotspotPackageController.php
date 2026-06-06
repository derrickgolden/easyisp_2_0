<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HotspotPackage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class HotspotPackageController extends Controller
{
    protected $radiusService;

    public function __construct(\App\Services\CustomerRadiusService $radiusService)
    {
        $this->middleware('permission:manage-packages')->except(['index', 'show']);
        $this->middleware('permission:view-packages')->only(['index', 'show']);
        $this->radiusService = $radiusService;
    }

    private function normalizePackageData(array $data)
    {
        $speedFields = [
            'speed_up', 'speed_down',
            'burst_limit_up', 'burst_limit_down',
            'burst_threshold_up', 'burst_threshold_down',
            'min_limit_up', 'min_limit_down',
        ];

        foreach ($speedFields as $field) {
            if (!empty($data[$field])) {
                $val = trim($data[$field]);
                if (is_numeric($val)) {
                    $val .= 'M';
                }
                $data[$field] = strtoupper($val);
            }
        }

        return $data;
    }

    public function index(Request $request)
    {
        $packages = HotspotPackage::where('organization_id', $request->user()->organization_id)->get();
        return response()->json($packages);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('packages', 'name')->where(function ($query) use ($request) {
                    return $query
                        ->where('organization_id', $request->user()->organization_id)
                        ->where('status', 'hotspot');
                }),
            ],
            'radius_group' => 'nullable|string|max:255',
            'attributes' => 'nullable|array',
            'speed_up' => 'required|string',
            'speed_down' => 'required|string',
            'price' => 'required|numeric|min:0',
            'validity' => 'required|integer|min:1',
            'validity_type' => 'nullable|in:days,months,hours,minutes',
            'type' => 'nullable|in:time,data',
            'data_limit_mb' => 'nullable|integer|min:0',
            'session_timeout' => 'nullable|integer|min:0',
            'idle_timeout' => 'nullable|integer|min:0',
            'shared_users' => 'nullable|integer|min:1',
            'expires_at' => 'nullable|date',
            'mikrotik_profile' => 'nullable|string|max:255',
            'is_voucher' => 'nullable|boolean',
            'priority' => 'nullable|integer|between:1,8',
            'burst_limit_up' => 'nullable|string',
            'burst_limit_down' => 'nullable|string',
            'burst_threshold_up' => 'nullable|string',
            'burst_threshold_down' => 'nullable|string',
            'burst_time' => 'nullable|string',
            'min_limit_up' => 'nullable|string',
            'min_limit_down' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $this->normalizePackageData($request->all());
        $data['organization_id'] = $request->user()->organization_id;
        $data['status'] = 'hotspot';

        $package = HotspotPackage::create($data);

        $this->radiusService->syncHotspotPackageToRadius($package);

        return response()->json([
            'message' => 'Hotspot package created successfully',
            'package' => $package,
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $package = HotspotPackage::where('organization_id', $request->user()->organization_id)->find($id);

        if (!$package) {
            return response()->json(['message' => 'Hotspot package not found'], 404);
        }

        return response()->json($package);
    }

    public function update(Request $request, $id)
    {
        $package = HotspotPackage::where('organization_id', $request->user()->organization_id)->find($id);

        if (!$package) {
            return response()->json(['message' => 'Hotspot package not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('packages', 'name')->where(function ($query) use ($request) {
                    return $query
                        ->where('organization_id', $request->user()->organization_id)
                        ->where('status', 'hotspot');
                })->ignore($id),
            ],
            'radius_group' => 'sometimes|nullable|string|max:255',
            'attributes' => 'sometimes|nullable|array',
            'speed_up' => 'sometimes|string',
            'speed_down' => 'sometimes|string',
            'price' => 'sometimes|numeric|min:0',
            'validity' => 'sometimes|integer|min:1',
            'validity_type' => 'nullable|in:days,months,hours,minutes',
            'type' => 'nullable|in:time,data',
            'data_limit_mb' => 'sometimes|nullable|integer|min:0',
            'session_timeout' => 'sometimes|nullable|integer|min:0',
            'idle_timeout' => 'sometimes|nullable|integer|min:0',
            'shared_users' => 'sometimes|nullable|integer|min:1',
            'expires_at' => 'sometimes|nullable|date',
            'mikrotik_profile' => 'sometimes|nullable|string|max:255',
            'is_voucher' => 'sometimes|nullable|boolean',
            'priority' => 'nullable|integer|between:1,8',
            'burst_limit_up' => 'nullable|string',
            'burst_limit_down' => 'nullable|string',
            'burst_threshold_up' => 'nullable|string',
            'burst_threshold_down' => 'nullable|string',
            'burst_time' => 'nullable|string',
            'min_limit_up' => 'nullable|string',
            'min_limit_down' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $this->normalizePackageData($request->all());
    $data['status'] = 'hotspot';
        $package->update($data);

        $radiusFields = [
            'name', 'speed_up', 'speed_down', 'burst_limit_up', 'burst_limit_down',
            'burst_threshold_up', 'burst_threshold_down', 'burst_time',
            'priority', 'min_limit_up', 'min_limit_down',
        ];

        if ($package->wasChanged($radiusFields)) {
            $this->radiusService->syncHotspotPackageToRadius($package);
        }

        return response()->json([
            'message' => 'Hotspot package updated successfully',
            'package' => $package,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $package = HotspotPackage::where('organization_id', $request->user()->organization_id)->find($id);

        if (!$package) {
            return response()->json(['message' => 'Hotspot package not found'], 404);
        }

        DB::connection('radius')->table('radgroupreply')
            ->where('groupname', 'hotspot_package_' . $package->id)
            ->delete();

        $package->delete();

        return response()->json(['message' => 'Hotspot package deleted successfully']);
    }
}
