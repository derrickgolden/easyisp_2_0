<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HotspotCustomer;
use App\Models\HotspotTransaction;
use App\Services\HotspotSubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class HotspotTransactionController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-transactions')->except(['store']);
    }

    public function index(Request $request)
    {
        $organizationId = $request->user()->organization_id;
        $perPage = (int) $request->get('per_page', 10);
        $search = trim((string) $request->get('search', ''));

        $transactionsQuery = HotspotTransaction::with('customer:id,first_name,last_name')
            ->where('organization_id', $organizationId)
            ->latest();

        if ($search !== '') {
            $transactionsQuery->where(function ($query) use ($search) {
                $query->where('id', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('reference_id', 'like', "%{$search}%")
                    ->orWhere('method', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($customerQuery) use ($search) {
                        $customerQuery->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                    });
            });
        }

        $transactions = $transactionsQuery->paginate($perPage);

        return response()->json($transactions);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:hotspot_customers,id',
            'amount' => 'required|numeric|min:0.01',
            'type' => 'required|in:credit,debit',
            'category' => 'required|string',
            'method' => 'required|string',
            'description' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $organizationId = $request->user()->organization_id;
            $customer = HotspotCustomer::where('organization_id', $organizationId)
                ->where('id', $request->customer_id)
                ->first();

            if (! $customer) {
                DB::rollBack();
                return response()->json(['message' => 'Hotspot customer not found in organization'], 404);
            }

            $balanceBefore = $customer->balance;
            $activationNote = null;

            if ($request->type === 'credit') {
                $customer->increment('balance', $request->amount);
            } else {
                $customer->decrement('balance', $request->amount);
            }

            $transaction = HotspotTransaction::create([
                'organization_id' => $organizationId,
                'customer_id' => $request->customer_id,
                'amount' => $request->amount,
                'type' => $request->type,
                'category' => $request->category,
                'method' => $request->method,
                'description' => $request->description,
                'balance_before' => $balanceBefore,
                'balance_after' => $customer->balance,
            ]);

            if ($request->type === 'credit') {
                $customerForSync = $customer->fresh(['package']);
                $wasExpired = $customerForSync->status === 'expired';
                $packagePrice = $customerForSync->effective_package_price;
                $canAutoRenew = $wasExpired && $packagePrice !== null && $customerForSync->balance >= $packagePrice;

                app(HotspotSubscriptionService::class)->syncSubscription($customerForSync);

                if ($canAutoRenew) {
                    $customerAfterSync = $customerForSync->fresh();

                    if ($customerAfterSync && $customerAfterSync->status === 'active') {
                        $activationNote = 'Customer auto-activated successfully.';
                    } else {
                        $activationNote = 'Deposit posted. Auto-activation check completed.';
                    }
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Hotspot transaction created successfully',
                'transaction' => $transaction,
                'activation_note' => $activationNote,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error creating hotspot transaction: ' . $e->getMessage()], 500);
        }
    }

    public function getByCustomer(Request $request, $customerId)
    {
        $perPage = (int) $request->get('per_page', 10);

        $transactions = HotspotTransaction::where('customer_id', $customerId)
            ->where('organization_id', $request->user()->organization_id)
            ->latest()
            ->paginate($perPage);

        return response()->json($transactions);
    }

    public function show(Request $request, $id)
    {
        $transaction = HotspotTransaction::where('organization_id', $request->user()->organization_id)
            ->find($id);

        if (! $transaction) {
            return response()->json(['message' => 'Hotspot transaction not found'], 404);
        }

        return response()->json($transaction);
    }
}
