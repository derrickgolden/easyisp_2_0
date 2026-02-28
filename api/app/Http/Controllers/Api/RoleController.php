<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use App\Models\Role;
use App\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    /**
     * List all roles for current organization
     */
    public function index(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;

        $roles = Role::where('organization_id', $organizationId)
            ->with('permissions:id,name')
            ->get()
            ->map(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
            });

        return response()->json([
            'data' => $roles
        ]);
    }

    /**
     * Create new role
     */
    public function store(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;

        $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('roles')
                    ->where('organization_id', $organizationId)
            ],
            'permissions' => 'nullable|array',
            'permissions.*' => [
                'string',
                Rule::exists('permissions', 'name')->where(fn ($query) => $query->where('guard_name', 'sanctum')),
            ],
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role = Role::create([
            'name' => $request->name,
            'guard_name' => 'sanctum',
            'organization_id' => $organizationId,
        ]);

        if ($request->permissions) {
            $permissionNames = collect($request->permissions)->unique()->values();
            $permissionModels = Permission::query()
                ->whereIn('name', $permissionNames)
                ->where('guard_name', 'sanctum')
                ->get();

            $role->syncPermissions($permissionModels);
        }

        return response()->json([
            'message' => 'Role created successfully',
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name')
            ]
        ], 201);
    }

    /**
     * Update role
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $organizationId = $request->user()->organization_id;

        $role = Role::where('organization_id', $organizationId)
            ->findOrFail($id);
        \Log::info('update role', $request->all(), ['role_id' => $id, 'organization_id' => $organizationId]);
        $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('roles')
                    ->ignore($role->id)
                    ->where('organization_id', $organizationId)
            ],
            'permissions' => 'nullable|array',
            'permissions.*' => [
                'string',
                Rule::exists('permissions', 'name')->where(fn ($query) => $query->where('guard_name', 'sanctum')),
            ],
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role->update([
            'name' => $request->name,
            'guard_name' => 'sanctum',
        ]);

        if ($request->permissions !== null) {
            $permissionNames = collect($request->permissions)->unique()->values();
            $permissionModels = Permission::query()
                ->whereIn('name', $permissionNames)
                ->where('guard_name', 'sanctum')
                ->get();

            $role->syncPermissions($permissionModels);
        }

        return response()->json([
            'message' => 'Role updated successfully',
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name')
            ]
        ]);
    }

    /**
     * Delete role
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $organizationId = $request->user()->organization_id;

        $role = Role::where('organization_id', $organizationId)
            ->findOrFail($id);

        // Optional: prevent deleting Owner
        if ($role->name === 'Owner') {
            return response()->json([
                'message' => 'Owner role cannot be deleted'
            ], 403);
        }

        $role->delete();

        return response()->json([
            'message' => 'Role deleted successfully'
        ]);
    }
}

// class RoleController extends Controller
// {
//     public function index(Request $request)
//     {
//         $organizationId = $request->user()->organization_id;
//         app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);

//         $roles = Role::where('organization_id', $organizationId)->paginate(15);
//         $roles->getCollection()->transform(function (Role $role) use ($organizationId) {
//             app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);
//             $role->permissions = $role->permissions()->pluck('name')->values();
//             return $role;
//         });
//         return response()->json($roles);
//     }

//     public function store(Request $request)
//     {
//         $validator = Validator::make($request->all(), [
//             'name' => 'required|string|max:255',
//             'permissions' => 'array',
//             'permissions.*' => 'string',
//         ]);

//         if ($validator->fails()) {
//             return response()->json(['errors' => $validator->errors()], 422);
//         }

//         $organizationId = $request->user()->organization_id;
//         app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);

//         $role = Role::create([
//             'organization_id' => $organizationId,
//             'name' => $request->name,
//             'guard_name' => 'sanctum',
//         ]);

//         $permissions = collect($request->permissions ?? [])
//             ->unique()
//             ->map(function ($perm) use ($organizationId) {
//                 return Permission::firstOrCreate([
//                     'organization_id' => $organizationId,
//                     'name' => $perm,
//                     'guard_name' => 'sanctum',
//                 ]);
//             });

//         $role->syncPermissions($permissions);
//         app(PermissionRegistrar::class)->forgetCachedPermissions();

//         return response()->json([
//             'message' => 'Role created successfully',
//             'role' => [
//                 'id' => (string) $role->id,
//                 'name' => $role->name,
//                 'permissions' => $role->permissions()->pluck('name')->values(),
//             ],
//         ], 201);
//     }

//     public function show(Request $request, $id)
//     {
//         $role = Role::find($id);
//         if (!$role) {
//             return response()->json(['message' => 'Role not found'], 404);
//         }
//         if ($request->user()->organization_id !== $role->organization_id) {
//             return response()->json(['message' => 'Unauthorized'], 403);
//         }
//         $organizationId = $role->organization_id;
//         app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);

//         return response()->json([
//             'id' => (string) $role->id,
//             'name' => $role->name,
//             'permissions' => $role->permissions()->pluck('name')->values(),
//         ]);
//     }

//     public function update(Request $request, $id)
//     {
//         $role = Role::find($id);
//         if (!$role) {
//             return response()->json(['message' => 'Role not found'], 404);
//         }
//         if ($request->user()->organization_id !== $role->organization_id) {
//             return response()->json(['message' => 'Unauthorized'], 403);
//         }

//         $validator = Validator::make($request->all(), [
//             'name' => 'sometimes|string|max:255',
//             'permissions' => 'sometimes|array',
//             'permissions.*' => 'string',
//         ]);

//         if ($validator->fails()) {
//             return response()->json(['errors' => $validator->errors()], 422);
//         }

//         $organizationId = $role->organization_id;
//         app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);

//         if ($request->filled('name')) {
//             $role->name = $request->name;
//         }
//         if ($request->has('permissions')) {
//             $permissions = collect($request->permissions ?? [])
//                 ->unique()
//                 ->map(function ($perm) use ($organizationId) {
//                     return Permission::firstOrCreate([
//                         'organization_id' => $organizationId,
//                         'name' => $perm,
//                         'guard_name' => 'sanctum',
//                     ]);
//                 });
//             $role->syncPermissions($permissions);
//             app(PermissionRegistrar::class)->forgetCachedPermissions();
//         }
//         $role->save();

//         return response()->json([
//             'message' => 'Role updated successfully',
//             'role' => [
//                 'id' => (string) $role->id,
//                 'name' => $role->name,
//                 'permissions' => $role->permissions()->pluck('name')->values(),
//             ],
//         ]);
//     }

//     public function destroy(Request $request, $id)
//     {
//         $role = Role::find($id);
//         if (!$role) {
//             return response()->json(['message' => 'Role not found'], 404);
//         }
//         if ($request->user()->organization_id !== $role->organization_id) {
//             return response()->json(['message' => 'Unauthorized'], 403);
//         }

//         if ($role->users()->count() > 0) {
//             return response()->json(['message' => 'Cannot delete role with assigned users'], 422);
//         }

//         $role->delete();
//         return response()->json(['message' => 'Role deleted successfully']);
//     }
// }
