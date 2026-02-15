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
        $sites = Site::where('organization_id', $request->user()->organization_id)->paginate(15);
        return SiteResource::collection($sites);
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

        $site = Site::create(array_merge($request->all(), [
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

        $site->update($request->all());

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
}
