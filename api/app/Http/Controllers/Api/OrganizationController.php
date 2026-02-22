<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OrganizationController extends Controller
{
    public function listAll()
    {
        $organizations = Organization::withCount(['sites', 'customers'])
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