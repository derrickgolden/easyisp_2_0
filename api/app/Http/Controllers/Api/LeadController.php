<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LeadController extends Controller
{
    /**
     * Display a listing of the leads.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $organizationId = $user->organization_id;

        $query = Lead::where('organization_id', $organizationId)
            ->orderBy('created_at', 'desc');

        // Filter by status if provided
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Search functionality
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        $perPage = $request->get('per_page', 10);
        $leads = $query->paginate($perPage);

        return response()->json($leads);
    }

    /**
     * Store a newly created lead.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'status' => 'nullable|in:new,contacted,survey,converted,lost',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();
        
        $lead = Lead::create([
            'organization_id' => $user->organization_id,
            'name' => $request->name,
            'phone' => $request->phone,
            'email' => $request->email,
            'address' => $request->address,
            'status' => $request->status ?? 'new',
            'notes' => $request->notes,
        ]);

        return response()->json([
            'message' => 'Lead created successfully',
            'data' => $lead
        ], 201);
    }

    /**
     * Display the specified lead.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        
        $lead = Lead::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        return response()->json(['data' => $lead]);
    }

    /**
     * Update the specified lead.
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'sometimes|required|string|max:20',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'status' => 'nullable|in:new,contacted,survey,converted,lost',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();
        
        $lead = Lead::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        $lead->update($request->only([
            'name',
            'phone',
            'email',
            'address',
            'status',
            'notes',
        ]));

        return response()->json([
            'message' => 'Lead updated successfully',
            'data' => $lead
        ]);
    }

    /**
     * Remove the specified lead.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        
        $lead = Lead::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        $lead->delete();

        return response()->json([
            'message' => 'Lead deleted successfully'
        ]);
    }

    /**
     * Get statistics for leads.
     */
    public function stats(Request $request)
    {
        $user = $request->user();
        $organizationId = $user->organization_id;

        $stats = [
            'total' => Lead::where('organization_id', $organizationId)->count(),
            'new' => Lead::where('organization_id', $organizationId)->where('status', 'new')->count(),
            'contacted' => Lead::where('organization_id', $organizationId)->where('status', 'contacted')->count(),
            'survey' => Lead::where('organization_id', $organizationId)->where('status', 'survey')->count(),
            'converted' => Lead::where('organization_id', $organizationId)->where('status', 'converted')->count(),
            'lost' => Lead::where('organization_id', $organizationId)->where('status', 'lost')->count(),
        ];

        return response()->json($stats);
    }
}
