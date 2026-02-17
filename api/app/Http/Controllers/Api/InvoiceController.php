<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = $request->input('per_page', 15);

        $query = Invoice::where('organization_id', $user->organization_id)
            ->orderBy('issue_date', 'desc')
            ->orderBy('created_at', 'desc');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhere('customer_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status') && in_array($request->status, ['paid', 'unpaid', 'overdue'], true)) {
            $query->where('status', $request->status);
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id',
            'invoice_number' => 'nullable|string|max:100',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.amount' => 'required|numeric|min:0',
            'subtotal' => 'required|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'issue_date' => 'required|date',
            'due_date' => 'required|date',
            'status' => 'nullable|in:paid,unpaid,overdue',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $customer = Customer::where('organization_id', $user->organization_id)
            ->findOrFail($request->customer_id);

        $invoiceNumber = $request->invoice_number ?: $this->generateInvoiceNumber();

        $invoice = Invoice::create([
            'organization_id' => $user->organization_id,
            'customer_id' => $customer->id,
            'invoice_number' => $invoiceNumber,
            'customer_name' => trim($customer->first_name . ' ' . $customer->last_name),
            'items' => $request->items,
            'subtotal' => $request->subtotal,
            'tax' => $request->tax ?? 0,
            'total' => $request->total,
            'issue_date' => $request->issue_date,
            'due_date' => $request->due_date,
            'status' => $request->status ?? 'unpaid',
        ]);

        return response()->json($invoice, 201);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();

        $invoice = Invoice::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        return response()->json($invoice);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();

        $invoice = Invoice::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'customer_id' => 'sometimes|required|exists:customers,id',
            'invoice_number' => 'sometimes|required|string|max:100',
            'items' => 'sometimes|required|array|min:1',
            'items.*.description' => 'required_with:items|string|max:255',
            'items.*.amount' => 'required_with:items|numeric|min:0',
            'subtotal' => 'sometimes|required|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'total' => 'sometimes|required|numeric|min:0',
            'issue_date' => 'sometimes|required|date',
            'due_date' => 'sometimes|required|date',
            'status' => 'sometimes|required|in:paid,unpaid,overdue',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->filled('customer_id')) {
            $customer = Customer::where('organization_id', $user->organization_id)
                ->findOrFail($request->customer_id);
            $invoice->customer_id = $customer->id;
            $invoice->customer_name = trim($customer->first_name . ' ' . $customer->last_name);
        }

        $invoice->fill($request->only([
            'invoice_number',
            'items',
            'subtotal',
            'tax',
            'total',
            'issue_date',
            'due_date',
            'status',
        ]));

        $invoice->save();

        return response()->json($invoice);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        $invoice = Invoice::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        $invoice->delete();

        return response()->json(['message' => 'Invoice deleted successfully']);
    }

    private function generateInvoiceNumber(): string
    {
        return 'INV-' . now()->format('Ymd') . '-' . strtoupper(substr(md5((string) microtime(true)), 0, 6));
    }
}
