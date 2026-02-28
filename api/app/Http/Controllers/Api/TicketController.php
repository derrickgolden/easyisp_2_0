<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TicketController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:manage-tickets')->except(['index', 'show', 'getByCustomer']);
        $this->middleware('permission:view-tickets')->only(['index', 'show', 'getByCustomer']);
    }

    public function index(Request $request)
    {
        $tickets = Ticket::where('organization_id', $request->user()->organization_id)
            ->with('customer:id,first_name,last_name,phone')
            ->orderBy('created_at', 'desc')
            ->get();
        return response()->json($tickets);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'nullable|exists:customers,id',
            'subject' => 'required|string|max:255',
            'description' => 'required|string',
            'priority' => 'sometimes|in:low,medium,high,critical',
            'status' => 'sometimes|in:open,in-progress,closed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $ticket = Ticket::create(array_merge($request->all(), [
            'organization_id' => $request->user()->organization_id,
            'priority' => $request->priority ?? 'medium',
            'status' => 'open',
        ]));

        return response()->json([
            'message' => 'Ticket created successfully',
            'ticket' => $ticket,
        ], 201);
    }

    public function show($id)
    {
        $ticket = Ticket::with('customer:id,first_name,last_name,phone')->find($id);
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }
        return response()->json($ticket);
    }

    public function update(Request $request, $id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'subject' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'priority' => 'sometimes|in:low,medium,high,critical',
            'status' => 'sometimes|in:open,in-progress,closed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $ticket->update($request->all());

        return response()->json([
            'message' => 'Ticket updated successfully',
            'ticket' => $ticket,
        ]);
    }

    public function destroy($id)
    {
        $ticket = Ticket::find($id);
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $ticket->delete();
        return response()->json(['message' => 'Ticket deleted successfully']);
    }

    public function getByCustomer($customerId)
    {
        $tickets = Ticket::where('customer_id', $customerId)
            ->with('customer:id,first_name,last_name,phone')
            ->orderBy('created_at', 'desc')
            ->paginate(15);
        return response()->json($tickets);
    }
}
