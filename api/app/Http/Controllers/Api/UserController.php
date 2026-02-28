<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\SystemAdmin;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\PermissionRegistrar;

class UserController extends Controller
{
    public function __construct()
    {
        $this->middleware(function ($request, $next) {
            $user = $request->user();

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            if ($user instanceof SystemAdmin || ($user instanceof User && $user->is_super_admin)) {
                return $next($request);
            }

            return response()->json(['message' => 'Forbidden'], 403);
        });
    }

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
        $isSuperAdmin = $request->boolean('is_super_admin', false);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|unique:users',
            'phone' => 'nullable|string',
            'password' => 'required|string|min:6',
            'role_id' => $isSuperAdmin ? 'nullable' : 'required|exists:roles,id',
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

        if ($isSuperAdmin) {
            $role = Role::firstOrCreate(
                ['organization_id' => $organizationId, 'name' => 'Super Admin', 'guard_name' => 'sanctum'],
                []
            );
        } else {
            if (!$request->filled('role_id')) {
                return response()->json(['errors' => ['role_id' => ['The role id field is required.']]], 422);
            }

            $role = Role::where('id', $request->role_id)
                ->where('organization_id', $organizationId)
                ->first();

            if (!$role) {
                return response()->json(['errors' => ['role_id' => ['The selected role id is invalid.']]], 422);
            }
        }

        // Automatically set parent_id based on user type
        $parentId = null;
        if (!$isSuperAdmin) {
            // For regular users, set parent_id to the organization's super admin
            $superAdmin = User::where('organization_id', $organizationId)
                ->where('is_super_admin', true)
                ->first();
            $parentId = $superAdmin ? $superAdmin->id : null;
        }

        $user = User::create([
            'organization_id' => $organizationId,
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'role_id' => $role->id,
            'parent_id' => $parentId,
            'is_super_admin' => $isSuperAdmin,
            'status' => $request->status ?? 'Active',
        ]);

        app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);
        $user->syncRoles([$role]);

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

        $user->update($request->except('role_id'));

        if ($request->filled('role_id')) {
            $role = Role::where('id', $request->role_id)
                ->where('organization_id', $user->organization_id)
                ->first();

            if (!$role) {
                return response()->json(['message' => 'Invalid role for organization'], 422);
            }

            $user->role_id = $role->id;
            $user->save();
            app(PermissionRegistrar::class)->setPermissionsTeamId($user->organization_id);
            $user->syncRoles([$role]);
        }

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
