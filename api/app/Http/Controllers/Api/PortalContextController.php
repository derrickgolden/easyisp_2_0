<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Package;
use App\Models\Site;
use App\Services\PortalContextResolverService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PortalContextController extends Controller
{
    public function resolve(Request $request, PortalContextResolverService $resolver)
    {
        $data = $request->validate([
            'client_ip' => 'required|ip',
            'nas_ip' => 'nullable|ip',
            'site_id' => 'nullable',
            'identity' => 'nullable|string|max:255',
            'mac' => 'nullable|string|max:32',
        ]);

        // if (empty($data['nas_ip']) && empty($data['site_id']) && empty($data['identity'])) {
        //     return response()->json([
        //         'success' => false,
        //         'message' => 'Provide at least one of nas_ip, site_id, or identity.',
        //     ], 422);
        // }

        try {
            $resolved = $resolver->resolve($data);

            return response()->json([
                'success' => true,
                'data' => $resolved,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Failed to resolve portal context', [
                'error' => $e->getMessage(),
                'query' => $request->query(),
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to resolve portal context right now.',
            ], 500);
        }
    }

    public function customer(Request $request, string $id)
    {
        $customer = Customer::find($id);

        if (!$customer) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found.',
            ], 404);
        }

        $customer->loadMissing(['package', 'site']);

        return response()->json([
            'success' => true,
            'customer' => $this->formatCustomer($customer),
        ]);
    }

    public function packages(Request $request)
    {
        $siteId = $request->query('site_id');

        $packages = Package::query();

        if ($siteId) {
            $packages->where('site_id', $siteId);
        }

        return response()->json([
            'success' => true,
            'packages' => $packages->get()->map(fn (Package $package) => $this->formatPackage($package))->values()->all(),
        ]);
    }

    public function initiatePayment(Request $request)
    {
        $data = $request->validate([
            'customer_id' => 'required|integer',
            'package_id' => 'required|integer',
            'phone' => 'required|string|max:20',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payment request received.',
            'customer_id' => $data['customer_id'],
            'package_id' => $data['package_id'],
        ]);
    }

    protected function formatCustomer(Customer $customer): array
    {
        $customer->loadMissing(['package', 'site']);

        return [
            'id' => (string) $customer->id,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'full_name' => $customer->full_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'house_no' => $customer->house_no,
            'apartment' => $customer->apartment,
            'location' => $customer->location,
            'connection_type' => $customer->connection_type,
            'package_id' => $customer->package_id ? (string) $customer->package_id : null,
            'custom_package_price' => $customer->custom_package_price !== null ? (float) $customer->custom_package_price : null,
            'effective_package_price' => $customer->effective_package_price !== null ? (float) $customer->effective_package_price : null,
            'site_id' => $customer->site_id ? (string) $customer->site_id : null,
            'installation_fee' => (float) $customer->installation_fee,
            'status' => $customer->status,
            'expiry_date' => $customer->expiry_date,
            'extension_date' => $customer->extension_date,
            'connected_sites' => $customer->connected_sites,
            'balance' => (float) $customer->balance,
            'created_at' => $customer->created_at?->toISOString(),
            'radius_username' => $customer->radius_username,
            'radius_password' => $customer->radius_password,
            'username' => $customer->radius_username,
            'ip_address' => $customer->ip_address,
            'mac_address' => $customer->mac_address,
            'parent_id' => $customer->parent_id ? (string) $customer->parent_id : null,
            'is_independent' => (bool) $customer->is_independent,
            'is_online' => (bool) ($customer->is_online ?? false),
            'nas_ip_address' => $customer->radius_nas_ip ?? null,
            'package' => $customer->package ? $this->formatPackage($customer->package) : null,
            'site' => $customer->site ? $this->formatSite($customer->site) : null,
        ];
    }

    protected function formatPackage(Package $package): array
    {
        return [
            'id' => (string) $package->id,
            'name' => $package->name,
            'speed' => $package->speed_up || $package->speed_down
                ? trim(($package->speed_up ?: '') . '/' . ($package->speed_down ?: ''))
                : null,
            'price' => (float) $package->price,
            'validity' => $package->validity,
            'validity_type' => $package->validity_type,
            'type' => $package->type,
            'status' => $package->status,
        ];
    }

    protected function formatSite(Site $site): array
    {
        return [
            'id' => (string) $site->id,
            'name' => $site->name,
            'address' => $site->address ?? null,
        ];
    }
}
