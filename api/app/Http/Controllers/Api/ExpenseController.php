<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = $request->input('per_page', 15);
        
        $query = Expense::where('organization_id', $user->organization_id)
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc');

        // Search filter
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('reference_no', 'like', "%{$search}%");
            });
        }

        // Category filter
        if ($request->has('category') && $request->category && $request->category !== 'All') {
            $query->where('category', $request->category);
        }

        // Date range filter
        if ($request->has('start_date') && $request->start_date) {
            $query->whereDate('date', '>=', $request->start_date);
        }

        if ($request->has('end_date') && $request->end_date) {
            $query->whereDate('date', '<=', $request->end_date);
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        
        $validator = Validator::make($request->all(), [
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'category' => 'required|string|max:100',
            'date' => 'required|date',
            'payment_method' => 'required|string|max:100',
            'reference_no' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $expense = Expense::create([
            'organization_id' => $user->organization_id,
            'description' => $request->description,
            'amount' => $request->amount,
            'category' => $request->category,
            'date' => $request->date,
            'payment_method' => $request->payment_method,
            'reference_no' => $request->reference_no,
        ]);

        return response()->json($expense, 201);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        
        $expense = Expense::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        return response()->json($expense);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        
        $expense = Expense::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'description' => 'sometimes|required|string|max:255',
            'amount' => 'sometimes|required|numeric|min:0',
            'category' => 'sometimes|required|string|max:100',
            'date' => 'sometimes|required|date',
            'payment_method' => 'sometimes|required|string|max:100',
            'reference_no' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $expense->update($request->all());

        return response()->json($expense);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        
        $expense = Expense::where('organization_id', $user->organization_id)
            ->findOrFail($id);

        $expense->delete();

        return response()->json(['message' => 'Expense deleted successfully']);
    }

    public function stats(Request $request)
    {
        $user = $request->user();
        
        // Date range filter for stats
        $query = Expense::where('organization_id', $user->organization_id);
        
        if ($request->has('start_date') && $request->start_date) {
            $query->whereDate('date', '>=', $request->start_date);
        }

        if ($request->has('end_date') && $request->end_date) {
            $query->whereDate('date', '<=', $request->end_date);
        }

        $totalExpenses = $query->sum('amount');
        $expenseCount = $query->count();
        
        // Category breakdown
        $byCategory = Expense::where('organization_id', $user->organization_id)
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->get()
            ->pluck('total', 'category');

        return response()->json([
            'total_expenses' => $totalExpenses,
            'expense_count' => $expenseCount,
            'by_category' => $byCategory,
        ]);
    }
}
