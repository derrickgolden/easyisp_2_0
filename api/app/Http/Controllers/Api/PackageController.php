<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PackageController extends Controller
{
    protected $radiusService;

    public function __construct(\App\Services\CustomerRadiusService $radiusService)
    {
        $this->radiusService = $radiusService;
    }

    /**
     * Normalization Helper
     */
    private function normalizePackageData(array $data)
    {
        $speedFields = [
            'speed_up', 'speed_down', 
            'burst_limit_up', 'burst_limit_down', 
            'burst_threshold_up', 'burst_threshold_down',
            'min_limit_up', 'min_limit_down'
        ];

        foreach ($speedFields as $field) {
            if (!empty($data[$field])) {
                $val = trim($data[$field]);
                // If it's just a number (e.g., "10"), append "M"
                if (is_numeric($val)) {
                    $val .= 'M';
                }
                // Ensure uppercase (e.g., "10m" -> "10M")
                $data[$field] = strtoupper($val);
            }
        }

        return $data;
    }

    public function index(Request $request)
    {
        $packages = Package::where('organization_id', $request->user()->organization_id)->paginate(15);
        return response()->json($packages);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:packages,name,NULL,id,organization_id,' . $request->user()->organization_id,
            'speed_up' => 'required|string',
            'speed_down' => 'required|string',
            'price' => 'required|numeric|min:0',
            'validity_days' => 'required|integer|min:1',
            'type' => 'nullable|in:time,data',
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

        // Normalize all speed-related fields before saving
        $data = $this->normalizePackageData($request->all());
        $data['organization_id'] = $request->user()->organization_id;

        $package = Package::create($data);

        // sync with radius server
        $this->radiusService->syncPackageToRadius($package);

        return response()->json([
            'message' => 'Package created successfully',
            'package' => $package,
        ], 201);
    }

    public function show($id)
    {
        $package = Package::find($id);
        if (!$package) {
            return response()->json(['message' => 'Package not found'], 404);
        }
        return response()->json($package);
    }

    public function update(Request $request, $id)
    {
        $package = Package::find($id);
        if (!$package) {
            return response()->json(['message' => 'Package not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'speed_up' => 'sometimes|string',
            'speed_down' => 'sometimes|string',
            'price' => 'sometimes|numeric|min:0',
            'validity_days' => 'sometimes|integer|min:1',
            'type' => 'nullable|in:time,data',
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
        $package->update($data);

        // Sync if any technical radius fields changed
        $radiusFields = [
            'speed_up', 'speed_down', 'burst_limit_up', 'burst_limit_down', 
            'burst_threshold_up', 'burst_threshold_down', 'burst_time', 
            'priority', 'min_limit_up', 'min_limit_down'
        ];

        if ($package->wasChanged($radiusFields)) {
            $this->radiusService->syncPackageToRadius($package);
        }

        return response()->json([
            'message' => 'Package updated successfully',
            'package' => $package,
        ]);
    }

    public function destroy($id)
    {
        $package = Package::find($id);
        if (!$package) {
            return response()->json(['message' => 'Package not found'], 404);
        }

        if ($package->customers()->count() > 0) {
            return response()->json(['message' => 'Cannot delete package with active customers'], 422);
        }

        // 2. Remove group from RADIUS
        DB::connection('radius')->table('radgroupreply')->where('groupname', "package_" . $id)->delete();

        $package->delete();
        return response()->json(['message' => 'Package deleted successfully']);
    }
}
