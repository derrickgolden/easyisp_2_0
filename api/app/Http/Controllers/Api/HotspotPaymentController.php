<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HotspotPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class HotspotPaymentController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:manage-payments')->except([
            'index',
            'show',
        ]);
        $this->middleware('permission:view-payments')->only([
            'index',
            'show',
        ]);
    }

    public function index(Request $request)
    {
        $payments = HotspotPayment::where('organization_id', $request->user()->organization_id)
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json($payments);
    }

    public function show(Request $request, $id)
    {
        $payment = HotspotPayment::where('organization_id', $request->user()->organization_id)
            ->find($id);

        if (! $payment) {
            return response()->json([
                'message' => 'Hotspot payment not found',
            ], 404);
        }

        return response()->json($payment);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'site_id' => 'required|exists:sites,id',
            'package_id' => 'required|exists:packages,id',
            'phone' => 'required|string',
            'mac_address' => 'nullable|string',
            'ip_address' => 'nullable|string',
            'amount' => 'required|numeric|min:0',
            'account_reference' => 'nullable|string',
            'checkout_request_id' => 'nullable|string',
            'mpesa_receipt' => 'nullable|string',
            'status' => 'nullable|in:pending,paid,failed,expired',
            'expires_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $payment = HotspotPayment::create(array_merge($request->all(), [
            'organization_id' => $request->user()->organization_id,
            'status' => $request->input('status', 'pending'),
        ]));

        return response()->json([
            'message' => 'Hotspot payment created successfully',
            'payment' => $payment,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $payment = HotspotPayment::where('organization_id', $request->user()->organization_id)
            ->find($id);

        if (! $payment) {
            return response()->json([
                'message' => 'Hotspot payment not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'site_id' => 'sometimes|exists:sites,id',
            'package_id' => 'sometimes|exists:packages,id',
            'phone' => 'sometimes|string',
            'mac_address' => 'nullable|string',
            'ip_address' => 'nullable|string',
            'amount' => 'sometimes|numeric|min:0',
            'account_reference' => 'nullable|string',
            'checkout_request_id' => 'nullable|string',
            'mpesa_receipt' => 'nullable|string',
            'status' => 'sometimes|in:pending,paid,failed,expired',
            'expires_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $payment->fill($request->all());
        $payment->save();

        return response()->json([
            'message' => 'Hotspot payment updated successfully',
            'payment' => $payment,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $payment = HotspotPayment::where('organization_id', $request->user()->organization_id)
            ->find($id);

        if (! $payment) {
            return response()->json([
                'message' => 'Hotspot payment not found',
            ], 404);
        }

        $payment->delete();

        return response()->json([
            'message' => 'Hotspot payment deleted successfully',
        ]);
    }
}
