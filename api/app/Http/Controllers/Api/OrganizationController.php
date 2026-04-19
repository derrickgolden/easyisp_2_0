<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationLicenseSnapshot;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OrganizationController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:system-settings')->except(['show', 'index', 'licenseBilling', 'licenseBillingById']);
        $this->middleware('permission:view-templates')->only(['show', 'index', 'licenseBilling']);
    }

    public function listAll()
    {
        $organizations = Organization::withCount(['sites', 'customers'])
            ->with(['latestLicenseSnapshot'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($organizations);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'acronym' => 'required|string|max:5|unique:organizations,acronym',
            'subscription_tier' => 'required|in:lite,pro,enterprise',
            'status' => 'sometimes|in:active,suspended',
            'settings' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $defaultSettings = [
            'theme' => 'dark',
            'language' => 'en',
        ];

        $incomingSettings = $request->input('settings', []);
        $settings = array_merge($defaultSettings, is_array($incomingSettings) ? $incomingSettings : []);

        $organization = Organization::create([
            'name' => $request->input('name'),
            'acronym' => $request->input('acronym'),
            'subscription_tier' => $request->input('subscription_tier'),
            'status' => $request->input('status', 'active'),
            'settings' => $settings,
        ]);

        return response()->json([
            'message' => 'Organization created successfully',
            'organization' => $organization,
        ], 201);
    }

    public function index(Request $request)
    {
        $organization = $request->user()->organization;
        return response()->json($organization);
    }

    public function licenseBilling(Request $request)
    {
        $organization = $request->user()->organization;
        $month = $request->input('month');

        $query = OrganizationLicenseSnapshot::where('organization_id', $organization->id)
            ->orderByDesc('snapshot_month');

        if ($month) {
            $query->where('snapshot_month', $month . '-01');
        }

        $latest = (clone $query)->first();
        $history = (clone $query)->limit(12)->get();

        return response()->json([
            'current' => $latest,
            'price_per_active_user' => 15.00,
            'currency' => 'KES',
            'organization_status' => $organization->status,
            'is_active' => $organization->status === 'active',
            'history' => $history,
        ]);
    }

    public function update(Request $request)
    {
        $organization = $request->user()->organization;
        
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'acronym' => 'sometimes|required|string|max:5|unique:organizations,acronym,' . $organization->id,
            'subscription_tier' => 'sometimes|in:lite,pro,enterprise',
            'status' => 'sometimes|in:active,suspended',
            'settings' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Handle settings merge - don't replace, merge with existing
        if ($request->has('settings')) {
            $existingSettings = $organization->settings ?? [];
            $newSettings = $request->input('settings');
            
            // Deep merge: combine existing and new settings
            $mergedSettings = array_merge($existingSettings, $newSettings);
            
            // Update with merged settings
            $organization->update([
                'name' => $request->input('name', $organization->name),
                'acronym' => $request->input('acronym', $organization->acronym),
                'subscription_tier' => $request->input('subscription_tier', $organization->subscription_tier),
                'status' => $request->input('status', $organization->status),
                'settings' => $mergedSettings,
            ]);
        } else {
            // Update only non-settings fields if settings not provided
            $organization->update($request->only('name', 'acronym', 'subscription_tier', 'status'));
        }

        return response()->json([
            'message' => 'Organization updated successfully',
            'organization' => $organization,
        ]);
    }

    public function show($id)
    {
        $organization = Organization::find($id);
        if (!$organization) {
            return response()->json(['message' => 'Organization not found'], 404);
        }
        return response()->json($organization);
    }

    public function licenseBillingById($id)
    {
        $organization = Organization::find($id);
        if (!$organization) {
            return response()->json(['message' => 'Organization not found'], 404);
        }

        $query = OrganizationLicenseSnapshot::where('organization_id', $organization->id)
            ->orderByDesc('snapshot_month');

        $latest = (clone $query)->first();
        $history = (clone $query)->limit(24)->get();

        return response()->json([
            'organization_id' => $organization->id,
            'organization_name' => $organization->name,
            'organization_status' => $organization->status,
            'current' => $latest,
            'price_per_active_user' => 15.00,
            'currency' => 'KES',
            'history' => $history,
        ]);
    }

    public function updateLicenseBillingStatusById(Request $request, $id, $snapshotId)
    {
        $organization = Organization::find($id);
        if (!$organization) {
            return response()->json(['message' => 'Organization not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:billed,paid',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $snapshot = OrganizationLicenseSnapshot::where('organization_id', $organization->id)
            ->where('id', $snapshotId)
            ->first();

        if (!$snapshot) {
            return response()->json(['message' => 'Billing snapshot not found'], 404);
        }

        $status = $request->input('status');
        $snapshot->status = $status;

        if ($status === 'paid') {
            if (!$snapshot->paid_at) {
                $snapshot->paid_at = Carbon::now();
            }
        } else {
            $snapshot->paid_at = null;
        }

        $snapshot->save();

        // If the latest 3 snapshots are paid, automatically reactivate the organization.
        $latestThreeStatuses = OrganizationLicenseSnapshot::where('organization_id', $organization->id)
            ->orderByDesc('snapshot_month')
            ->limit(3)
            ->pluck('status');

        if ($latestThreeStatuses->count() > 0 && $latestThreeStatuses->every(fn ($itemStatus) => $itemStatus === 'paid')) {
            $organization->status = 'active';
            $organization->save();
        }

        return response()->json([
            'message' => 'Billing status updated successfully',
            'snapshot' => $snapshot,
        ]);
    }

    public function updateById(Request $request, $id)
    {
        $organization = Organization::find($id);
        if (!$organization) {
            return response()->json(['message' => 'Organization not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'acronym' => 'sometimes|required|string|max:5|unique:organizations,acronym,' . $organization->id,
            'subscription_tier' => 'sometimes|in:lite,pro,enterprise',
            'status' => 'sometimes|in:active,suspended',
            'settings' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->has('settings')) {
            $existingSettings = $organization->settings ?? [];
            $newSettings = $request->input('settings');
            $mergedSettings = array_merge($existingSettings, $newSettings);

            $organization->update([
                'name' => $request->input('name', $organization->name),
                'acronym' => $request->input('acronym', $organization->acronym),
                'subscription_tier' => $request->input('subscription_tier', $organization->subscription_tier),
                'status' => $request->input('status', $organization->status),
                'settings' => $mergedSettings,
            ]);
        } else {
            $organization->update($request->only('name', 'acronym', 'subscription_tier', 'status'));
        }

        return response()->json([
            'message' => 'Organization updated successfully',
            'organization' => $organization,
        ]);
    }

    public function destroy($id)
    {
        $organization = Organization::find($id);
        if (!$organization) {
            return response()->json(['message' => 'Organization not found'], 404);
        }

        $organization->delete();

        return response()->json(['message' => 'Organization deleted successfully']);
    }
}