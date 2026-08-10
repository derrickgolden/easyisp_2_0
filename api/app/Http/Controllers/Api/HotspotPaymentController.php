<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HotspotCustomer;
use App\Models\HotspotPackage;
use App\Models\HotspotPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Http\Resources\HotspotPaymentResource;
use Illuminate\Support\Facades\Log;

class HotspotPaymentController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:manage-payments')->except([
            'index',
            'show',
            'pending',
        ]);
        $this->middleware('permission:view-payments')->only([
            'index',
            'show',
            'pending',
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
            
            Log::info('Fetched payment:', ['payment' => $payment], $id);
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

    public function getByCustomer(Request $request, $customerId)
    {
        $payments = HotspotPayment::where('organization_id', $request->user()->organization_id)
            ->where('customer_id', $customerId)
            ->orderByDesc('created_at')
            ->get();

        return HotspotPaymentResource::collection($payments);
    }

    public function pending(Request $request)
    {
        $payments = HotspotPayment::where('organization_id', $request->user()->organization_id)
            ->where('status', 'pending')
            ->orderByDesc('created_at')
            ->paginate(50);

        return HotspotPaymentResource::collection($payments);
    }

    public function resolvePending(Request $request, $paymentId)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:hotspot_customers,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $organizationId = $request->user()->organization_id;

        $payment = HotspotPayment::where('organization_id', $organizationId)
            ->where('id', $paymentId)
            ->first();

        if (! $payment) {
            return response()->json(['message' => 'Hotspot payment not found'], 404);
        }

        if ($payment->status !== 'pending') {
            return response()->json(['message' => 'Only pending hotspot payments can be resolved'], 400);
        }

        $customer = HotspotCustomer::where('organization_id', $organizationId)
            ->where('id', $request->customer_id)
            ->first();

        if (! $customer) {
            return response()->json(['message' => 'Hotspot customer not found in organization'], 404);
        }

        try {
            DB::beginTransaction();

            $expiresAt = null;
            $package = null;
            if ($payment->package_id) {
                $package = HotspotPackage::where('organization_id', $organizationId)
                    ->where('id', $payment->package_id)
                    ->first();

                if ($package) {
                    $seconds = $this->resolveSessionTimeoutSeconds($package);
                    $expiresAt = $seconds > 0 ? now()->addSeconds($seconds) : null;
                }
            }

            $payment->update([
                'customer_id' => $customer->id,
                'status' => 'paid',
                'expires_at' => $expiresAt,
            ]);

            $customerUpdates = [
                'status' => 'active',
                'activated_at' => now(),
            ];

            if ($payment->site_id) {
                $customerUpdates['site_id'] = $payment->site_id;
            }

            if ($payment->package_id) {
                $customerUpdates['package_id'] = $payment->package_id;
            }

            if ($expiresAt) {
                $customerUpdates['expiry_date'] = $expiresAt;
            }

            $customer->update($customerUpdates);

            DB::commit();

            return response()->json([
                'message' => 'Hotspot payment resolved and applied',
                'payment' => new HotspotPaymentResource($payment->fresh()),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Error resolving hotspot payment: ' . $e->getMessage(),
            ], 500);
        }
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

    private function resolveSessionTimeoutSeconds(HotspotPackage $package): int
    {
        $sessionTimeout = (int) data_get($package, 'session_timeout', 0);
        if ($sessionTimeout > 0) {
            return $sessionTimeout;
        }

        $durationHours = (int) data_get($package, 'duration_hours', 0);
        if ($durationHours > 0) {
            return $durationHours * 3600;
        }

        $validity = (int) data_get($package, 'validity', 0);
        if ($validity <= 0) {
            return 0;
        }

        $validityType = strtolower((string) data_get($package, 'validity_type', 'days'));

        return match ($validityType) {
            'minutes' => $validity * 60,
            'hours' => $validity * 3600,
            'months' => $validity * 30 * 86400,
            default => $validity * 86400,
        };
    }
}
