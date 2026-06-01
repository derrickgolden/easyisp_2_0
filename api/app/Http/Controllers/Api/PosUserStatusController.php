<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PosUserStatusController extends Controller
{
    public function index(): JsonResponse
    {
        $users = DB::connection('laravel_pos')
            ->table('users')
            ->select([
                'id',
                'first_name',
                'last_name',
                'email',
                'phone',
                'status',
                'created_at',
            ])
            ->orderByDesc('id')
            ->get()
            ->map(function (object $user) {
                $user->status = (bool) $user->status;
                return $user;
            });

        return response()->json(['data' => $users]);
    }

    public function toggleStatus(int $id): JsonResponse
    {
        $user = DB::connection('laravel_pos')
            ->table('users')
            ->select('id', 'status')
            ->where('id', $id)
            ->first();

        if (! $user) {
            return response()->json([
                'message' => 'User not found in laravel_pos database.',
            ], 404);
        }

        $newStatus = ! ((bool) $user->status);

        DB::connection('laravel_pos')
            ->table('users')
            ->where('id', $id)
            ->update(['status' => $newStatus]);

        return response()->json([
            'message' => 'User status updated successfully.',
            'data' => [
                'id' => $id,
                'status' => $newStatus,
            ],
        ]);
    }
}
