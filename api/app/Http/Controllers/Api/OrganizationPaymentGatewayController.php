<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrganizationPaymentGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class OrganizationPaymentGatewayController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $organization = $user->organization;
        if (! $organization) {
            return response()->json(['success' => false, 'message' => 'Organization not found.'], 401);
        }

        $gateways = $organization->paymentGateways()->orderByDesc('is_default')->get();
        return response()->json(['success' => true, 'data' => $gateways], 200);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $organization = $user->organization;
        if (! $organization) {
            return response()->json(['success' => false, 'message' => 'Organization not found.'], 404);
        }

        $data = $request->validate([
            'provider' => [
                'required',
                'string',
                'max:64',
            ],
            'config' => ['nullable', 'array'],
            'is_default' => ['nullable', 'boolean'],
            'active' => ['nullable', 'boolean'],
        ]);

        // If a gateway for this provider already exists for the organization, update it instead
        $existing = $organization->paymentGateways()->where('provider', $data['provider'])->first();

        if ($existing) {
            if (! empty($data['is_default'])) {
                $organization->paymentGateways()->where('is_default', true)->update(['is_default' => false]);
            }

            $existing->fill([
                'config' => $data['config'] ?? $existing->config,
                'is_default' => ! empty($data['is_default']) ? true : $existing->is_default,
                'active' => array_key_exists('active', $data) ? (bool) $data['active'] : $existing->active,
            ]);

            $existing->save();

            return response()->json(['success' => true, 'data' => $existing], 200);
        }

        // If marking default, clear other defaults
        if (! empty($data['is_default'])) {
            $organization->paymentGateways()->where('is_default', true)->update(['is_default' => false]);
        }

        $gateway = OrganizationPaymentGateway::create([
            'organization_id' => $organization->id,
            'provider' => $data['provider'],
            'config' => $data['config'] ?? [],
            'is_default' => ! empty($data['is_default']),
            'active' => isset($data['active']) ? (bool) $data['active'] : true,
            'created_by' => $request->user()->id ?? null,
        ]);

        return response()->json(['success' => true, 'data' => $gateway], 201);
    }
}
