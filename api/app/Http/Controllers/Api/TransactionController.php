<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    public function index(Request $request)
    {
        $transactions = Transaction::where('organization_id', $request->user()->organization_id)->paginate(15);
        return response()->json($transactions);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id',
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

            $customer = Customer::find($request->customer_id);
            $balanceBefore = $customer->balance;

            // Update customer balance
            if ($request->type === 'credit') {
                $customer->increment('balance', $request->amount);
            } else {
                $customer->decrement('balance', $request->amount);
            }

            $transaction = Transaction::create([
                'organization_id' => $request->user()->organization_id,
                'customer_id' => $request->customer_id,
                'amount' => $request->amount,
                'type' => $request->type,
                'category' => $request->category,
                'method' => $request->method,
                'description' => $request->description,
                'balance_before' => $balanceBefore,
                'balance_after' => $customer->balance,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Transaction created successfully',
                'transaction' => $transaction,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error creating transaction: ' . $e->getMessage()], 500);
        }
    }

    public function getByCustomer($customerId)
    {
        $transactions = Transaction::where('customer_id', $customerId)->paginate(15);
        return response()->json($transactions);
    }

    public function show($id)
    {
        $transaction = Transaction::find($id);
        if (!$transaction) {
            return response()->json(['message' => 'Transaction not found'], 404);
        }
        return response()->json($transaction);
    }
}
