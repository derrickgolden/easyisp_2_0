<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Organization;
use App\Models\SystemAdmin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'organization_name' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|unique:users',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Create organization
        $organization = Organization::create([
            'name' => $request->organization_name,
            'subscription_tier' => 'lite',
            'status' => 'active',
        ]);

        // Create default admin role
        $adminRole = $organization->roles()->create([
            'name' => 'Admin',
            'permissions' => ['all'],
        ]);

        // Create user
        $user = User::create([
            'organization_id' => $organization->id,
            'role_id' => $adminRole->id,
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'is_super_admin' => true,
            'status' => 'Active',
        ]);

        $user->load('role');
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Registration successful',
            'user' => $user,
            'role' => $user->role ? [
                'id' => (string) $user->role->id,
                'name' => $user->role->name,
                'permissions' => $user->role->permissions ?? [],
            ] : null,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->update(['last_login' => now()]);
        $user->load('role');
        $token = $user->createToken('admin-token', ['access-admin'])->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => $user,
            'role' => $user->role ? [
                'id' => (string) $user->role->id,
                'name' => $user->role->name,
                'permissions' => $user->role->permissions ?? [],
            ] : null,
            'token' => $token,
        ], 200);
    }

    public function loginSystemAdmin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $admin = SystemAdmin::where('email', $request->email)->first();

        if (!$admin || !Hash::check($request->password, $admin->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $admin->createToken('sys-token', ['access-system'])->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => $admin,
            'token' => $token,
        ], 200);
    }

    public function loginCustomer(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'identifier' => 'required|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $identifier = $request->input('identifier');
        $customer = \App\Models\Customer::where('email', $identifier)
            ->orWhere('phone', $identifier)
            ->orWhere('radius_username', $identifier)
            ->first();

        if (!$customer || !Hash::check($request->password, $customer->password)) {
            throw ValidationException::withMessages([
                'identifier' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $customer->createToken('customer-token', ['access-portal'])->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'customer' => $customer,
            'token' => $token,
        ], 200);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully'], 200);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('role');

        return response()->json([
            'user' => $user,
            'role' => $user->role ? [
                'id' => (string) $user->role->id,
                'name' => $user->role->name,
                'permissions' => $user->role->permissions ?? [],
            ] : null,
        ]);
    }
}
