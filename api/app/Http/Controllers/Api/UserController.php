<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\SystemAdmin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user instanceof SystemAdmin) {
            $query = User::query();
            if ($request->filled('organization_id')) {
                $query->where('organization_id', $request->organization_id);
            }
            return response()->json($query->paginate(15));
        }

        if ($user->organization) {
            $users = $user->organization->users()->paginate(15);
            return response()->json($users);
        }

        if ($user->is_super_admin) {
            $query = User::query();
            if ($request->filled('organization_id')) {
                $query->where('organization_id', $request->organization_id);
            }
            return response()->json($query->paginate(15));
        }

        return response()->json(['message' => 'Organization context required'], 403);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|unique:users',
            'phone' => 'nullable|string',
            'password' => 'required|string|min:6',
            'role_id' => 'required|exists:roles,id',
            'parent_id' => 'nullable|exists:users,id',
            'is_super_admin' => 'sometimes|boolean',
            'status' => 'sometimes|in:Active,Inactive',
            'organization_id' => 'sometimes|nullable|exists:organizations,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $requestUser = $request->user();
        $organizationId = $requestUser instanceof SystemAdmin
            ? $request->organization_id
            : $requestUser->organization_id;
        if (!$organizationId && $request->filled('organization_id')) {
            $organizationId = $request->organization_id;
        }

        if (!$organizationId) {
            return response()->json(['message' => 'Organization is required'], 422);
        }

        $user = User::create([
            'organization_id' => $organizationId,
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'role_id' => $request->role_id,
            'parent_id' => $request->parent_id,
            'is_super_admin' => $request->boolean('is_super_admin', false),
            'status' => $request->status ?? 'Active',
        ]);

        return response()->json([
            'message' => 'User created successfully',
            'user' => $user,
        ], 201);
    }

    public function show($id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }
        return response()->json($user);
    }

    public function update(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string',
            'password' => 'sometimes|string|min:6',
            'role_id' => 'sometimes|exists:roles,id',
            'is_super_admin' => 'sometimes|boolean',
            'status' => 'sometimes|in:Active,Inactive',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->has('password')) {
            $request->merge(['password' => Hash::make($request->password)]);
        }

        $user->update($request->all());

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $user,
        ]);
    }

    public function destroy($id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $user->delete();
        return response()->json(['message' => 'User deleted successfully']);
    }
}
