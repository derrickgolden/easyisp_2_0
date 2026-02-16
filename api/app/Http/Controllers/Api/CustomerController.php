<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\CustomerRadiusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Http\Resources\CustomerResource;
use App\Services\SubscriptionService;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class CustomerController extends Controller
{
    protected $radiusService;
    protected $subscriptionService;

    public function __construct(CustomerRadiusService $radiusService, SubscriptionService $subscriptionService)
    {
        $this->radiusService = $radiusService;
        $this->subscriptionService = $subscriptionService;
    }

    public function index(Request $request)
    {
        $customers = $request->user()->organization
            ->customers()
            ->select([
                'id',
                'first_name',
                'last_name',
                'phone',
                'email',
                'balance',
                'parent_id',
                'status',
                'connection_type',
                'radius_username',
                'radius_password',
                'expiry_date',
                'house_no',
                'apartment',
                'location',
                'package_id',
                'site_id',
                'created_at',
            ])
            ->with(['package:id,name']) // Only fetch package id and name
            ->addSelect([
                'is_online' => \DB::connection('radius')
                    ->table('radacct')
                    ->select(\DB::raw('CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END'))
                    ->whereRaw('radacct.username COLLATE utf8mb4_unicode_ci = customers.radius_username')
                    ->whereNull('acctstoptime')
                    ->limit(1)
            ])
            ->latest()
            ->get();

        return CustomerResource::collection($customers);
    }

    public function showWithRelations($id)
    {
        // Load everything in one go or via lazy-loading
        $customer = Customer::with(['package', 'site', 'parent', 'subAccounts'])->find($id);

        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        return response()->json([
            'customer' => new CustomerResource($customer),
        ]);
    }

    public function store(Request $request)
    {
        $orgId = $request->user()->organization_id;
        $isChild = $request->filled('parent_id');

        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            // EMAIL: Unique inside Org ONLY if it's a main account (not a child)
            'email' => [
                'nullable', 'string', 'email',
                !$isChild ? Rule::unique('customers')->where('organization_id', $orgId) : ''
            ],

            // PHONE: Unique inside Org ONLY if it's a main account (not a child)
            'phone' => [
                'required', 'string',
                !$isChild ? Rule::unique('customers')->where('organization_id', $orgId) : ''
            ],
            'location' => 'required|string',
            'apartment' => 'nullable|string',
            'house_no' => 'nullable|string',
            'package_id' => 'required|exists:packages,id',
            'site_id' => 'nullable|exists:sites,id',
            'connection_type' => 'sometimes|in:PPPoE,Static IP,DHCP',
            'installation_fee' => 'sometimes|numeric|min:0',
            'balance' => 'sometimes|numeric|min:0',
            'ip_address' => 'nullable|string',
            'mac_address' => 'nullable|string',
            'parent_id' => 'nullable|exists:customers,id',
            'is_independent' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Get organization for company acronym
        $organization = \App\Models\Organization::find($request->user()->organization_id);
        
        // Auto-generate RADIUS password
        $radiusPassword = $request->input('radius_password') 
            ?? CustomerRadiusService::generateRadiusPassword();

        // Resolve trial expiry from organization settings (fallback to 30 minutes)
        $settings = $organization->settings ?? [];
        $trialSettings = $settings['general'] ?? [];
        $trialUnit = strtolower($trialSettings['trial_unit'] ?? 'minutes');
        $trialDuration = (int) ($trialSettings['trial_duration'] ?? 0);

        if ($trialDuration <= 0) {
            $trialUnit = 'minutes';
            $trialDuration = 30;
        }

        $defaultExpiry = match ($trialUnit) {
            'days', 'day' => now()->addDays($trialDuration),
            'hours', 'hour' => now()->addHours($trialDuration),
            'minutes', 'minute', 'mins', 'min' => now()->addMinutes($trialDuration),
            default => now()->addMinutes(30),
        };

        // Create customer first with a temporary username to get the ID
        $tempUsername = 'temp_' . uniqid();
        $customer = Customer::create(array_merge($request->all(), [
            'organization_id' => $request->user()->organization_id,
            'status' => 'active',
            'radius_username' => $tempUsername,
            'radius_password' => $radiusPassword,
            'expiry_date' => $request->input('expiry_date', $defaultExpiry),
        ]));

        // Generate final RADIUS username using customer ID and organization acronym
        $radiusUsername = $request->input('radius_username') 
            ?? CustomerRadiusService::generateRadiusUsername(
                $customer->id,
                $organization->acronym ?? null
            );

        // Check if username already exists and modify if necessary
        $usernameModified = false;
        if (Customer::where('radius_username', $radiusUsername)->where('id', '!=', $customer->id)->exists()) {
            // Username exists, add acronym prefix if not already present
            if ($organization->acronym) {
                $acronym = strtolower(trim($organization->acronym));
                $acronym = preg_replace('/[^a-z0-9]/', '', $acronym);
                
                // Only add prefix if username doesn't already start with it
                if (!str_starts_with($radiusUsername, $acronym . '_')) {
                    $radiusUsername = $acronym . '_' . $radiusUsername;
                    $usernameModified = true;
                }
            }
            
            // If still exists after adding acronym, append customer ID
            if (Customer::where('radius_username', $radiusUsername)->where('id', '!=', $customer->id)->exists()) {
                $radiusUsername = $radiusUsername . '_' . $customer->id;
                $usernameModified = true;
            }
        }

        // Update customer with the generated username
        $customer->radius_username = $radiusUsername;
        $customer->save();

        // Sync to RADIUS
        $syncResult = $this->radiusService->syncCustomerToRadius($customer);

        if (!$syncResult['success']) {
            // Log the error but don't fail customer creation
            \Log::error('RADIUS sync failed for customer ' . $customer->id . ': ' . $syncResult['message']);
        }

        $customer = new CustomerResource($customer);

        return response()->json([
            'message' => 'Customer created successfully',
            'customer' => $customer->load('package', 'site'),
            'radius_sync' => $syncResult,
            'username_modified' => $usernameModified,
            'username_message' => $usernameModified ? 'RADIUS username was modified to avoid conflicts' : null,
        ], 201);
    }

    public function show($id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        $customer = new CustomerResource($customer);
        return response()->json($customer->load('package', 'site', 'payments', 'transactions'));
    }

    public function update(Request $request, $id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'email' => 'nullable|string|email',
            'phone' => 'sometimes|string',
            'location' => 'sometimes|string',
            'apartment' => 'nullable|string',
            'house_no' => 'nullable|string',
            'package_id' => 'sometimes|exists:packages,id',
            'site_id' => 'nullable|exists:sites,id',
            'connection_type' => 'sometimes|in:PPPoE,Static IP,DHCP',
            'radius_username' => 'sometimes|string|max:255', // Uniqueness handled by conflict resolution logic
            'installation_fee' => 'sometimes|numeric|min:0',
            'status' => 'sometimes|in:active,expired,suspended',
            'expiry_date' => 'sometimes|date',
            'extension_date' => 'nullable|date',
            'balance' => 'sometimes|numeric|min:0',
            'ip_address' => 'nullable|string',
            'mac_address' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $oldUsername = $customer->radius_username;
        
        // Track if we need to modify the username
        $usernameModified = false;
        $newUsername = $request->input('radius_username');
        
        // If username is being changed, check for conflicts
        if ($newUsername && $newUsername !== $oldUsername) {
            // Check if new username already exists
            if (Customer::where('radius_username', $newUsername)->where('id', '!=', $customer->id)->exists()) {
                // Username exists, add acronym prefix if available and not already present
                $organization = \App\Models\Organization::find($customer->organization_id);
                if ($organization->acronym) {
                    $acronym = strtolower(trim($organization->acronym));
                    $acronym = preg_replace('/[^a-z0-9]/', '', $acronym);
                    
                    // Only add prefix if username doesn't already start with it
                    if (!str_starts_with($newUsername, $acronym . '_')) {
                        $newUsername = $acronym . '_' . $newUsername;
                        $usernameModified = true;
                    }
                }
                
                // If still exists after adding acronym, append customer ID
                if (Customer::where('radius_username', $newUsername)->where('id', '!=', $customer->id)->exists()) {
                    $newUsername = $newUsername . '_' . $customer->id;
                    $usernameModified = true;
                }
                
                // Update request data with modified username
                $request->merge(['radius_username' => $newUsername]);
            }
        }

        $customer->update($request->all());

        // Re-sync to RADIUS if critical fields changed
        if ($customer->wasChanged(['package_id', 'ip_address', 'status', 'radius_password', 'radius_username'])) {
            $syncResult = $this->radiusService->syncCustomerToRadius($customer, $oldUsername);
            if ($syncResult['success']) {
                // Force the router to kick the user so they reconnect with new settings
                $this->radiusService->disconnectCustomer($oldUsername ?? $customer->radius_username);
            }else {
                \Log::error('RADIUS sync failed for customer ' . $customer->id . ': ' . $syncResult['message']);
            }
        }

        if ($customer->wasChanged(['expiry_date', 'extension_date'])) {
            $syncResult = $this->subscriptionService->syncSubscription($customer);
        }

        return response()->json([
            'message' => 'Customer updated successfully',
            'customer' => $customer->load('package', 'site'),
            'username_modified' => $usernameModified,
            'username_message' => $usernameModified ? 'RADIUS username was modified to avoid conflicts' : null,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        // Load subAccounts to check for existence
        $customer = Customer::with('subAccounts')->findOrFail($id);

        // If they have sub-accounts and the admin didn't confirm "cascade"
        if ($customer->subAccounts->count() > 0 && !$request->has('cascade')) {
            return response()->json([
                'message' => 'This account has sub-accounts.',
                'error_code' => 'HAS_SUB_ACCOUNTS',
                'count' => $customer->subAccounts->count()
            ], 422);
        }

        return DB::transaction(function () use ($customer) {
            // 1. Clean up Sub-Accounts first
            foreach ($customer->subAccounts as $subAccount) {
                // Remove from RADIUS
                $this->radiusService->removeCustomerFromRadius($subAccount->radius_username);
                $this->radiusService->disconnectCustomer($subAccount->radius_username);
                
                // Delete from MySQL
                $subAccount->delete();
            }

            // 2. Clean up the Master Account
            $this->radiusService->removeCustomerFromRadius($customer->radius_username);
            $this->radiusService->disconnectCustomer($customer->radius_username);
            $customer->delete();

            return response()->json(['message' => 'Master and sub-accounts deleted successfully']);
        });
    }

    public function pauseSubscription(Customer $customer)
    {
        $now = Carbon::now();
        $expiry = Carbon::parse($customer->expiry_date);

        if ($expiry->isFuture()) {
            // Store the remaining seconds
            $customer->paused_seconds_remaining = $now->diffInSeconds($expiry);
        } else {
            $customer->paused_seconds_remaining = 0;
        }

        $customer->status = 'suspended';
        $customer->expiry_date = null; // Clear this so cron doesn't process them
        $customer->save();

        $this->subscriptionService->applySuspendedStatus($customer);

        return response()->json([
            'message' => 'Service paused successfully',
            'customer' => $customer
        ]);
    }

    public function resumeSubscription(Customer $customer)
    {
        if ($customer->status !== 'suspended') {
            return response()->json([
                'message' => 'Service is not paused',
                'customer' => $customer
            ]);
        }

        $now = Carbon::now();
        
        // Create new expiry based on saved seconds
        if ($customer->paused_seconds_remaining > 0) {
            $customer->expiry_date = $now->addSeconds($customer->paused_seconds_remaining);
        } else {
            // If they had no time left, resume them as expired so they have to pay
            $customer->expiry_date = $now->subMinute(); 
        }

        $customer->paused_seconds_remaining = 0; // Reset the bucket
        $customer->status = 'active'; // This will be validated by syncSubscription
        $customer->save();

        // Run sync to update RADIUS and disconnect if necessary
        $this->subscriptionService->syncSubscription($customer);

        return response()->json([
            'message' => 'Service resumed successfully',
            'customer' => $customer
        ]);
    }

    /**
     * Sync a specific customer to RADIUS database
     */
    public function syncToRadius($id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        $result = $this->radiusService->syncCustomerToRadius($customer);

        return response()->json($result, $result['success'] ? 200 : 500);
    }

    /**
     * Sync all customers in organization to RADIUS
     */
    public function syncAllToRadius(Request $request)
    {
        $organization_id = $request->user()->organization_id;
        $customers = Customer::where('organization_id', $organization_id)
            ->where('status', 'active')
            ->get();

        $results = [
            'total' => $customers->count(),
            'synced' => 0,
            'failed' => 0,
            'errors' => [],
        ];

        foreach ($customers as $customer) {
            $syncResult = $this->radiusService->syncCustomerToRadius($customer);
            
            if ($syncResult['success']) {
                $results['synced']++;
            } else {
                $results['failed']++;
                $results['errors'][] = [
                    'customer_id' => $customer->id,
                    'username' => $customer->radius_username,
                    'error' => $syncResult['message'],
                ];
            }
        }

        return response()->json($results);
    }

    /**
     * Get RADIUS sync status for a customer
     */
    public function getRadiusStatus($id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        // Check if user exists in RADIUS database
        $radiusUser = \DB::connection('radius')
            ->table('radcheck')
            ->where('username', $customer->radius_username)
            ->first();

        $radiusGroups = \DB::connection('radius')
            ->table('radusergroup')
            ->where('username', $customer->radius_username)
            ->get();

        return response()->json([
            'customer_id' => $customer->id,
            'radius_username' => $customer->radius_username,
            'synced' => $radiusUser ? true : false,
            'in_radius_database' => $radiusUser ? true : false,
            'groups' => $radiusGroups->toArray(),
            'message' => $radiusUser ? 'Customer is synced to RADIUS' : 'Customer not found in RADIUS database',
        ]);
    }

    public function getByOrganization(Request $request)
    {
        $customers = Customer::where('organization_id', $request->user()->organization_id)
            ->with('package', 'site');

        return response()->json($customers);
    }

    /**
     * Reset/Flush MAC binding for a customer (remove and re-add to RADIUS)
     */
    public function resetMacBinding($id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        try {
            // Remove customer from RADIUS database
            $this->radiusService->flushMacOnly($customer->radius_username);
            
            // Disconnect any active sessions
            $this->radiusService->disconnectCustomer($customer->radius_username);
                        
            return response()->json([
                'message' => 'MAC binding reset.',
                'customer_id' => $customer->id,
                'status' => 're-syncing'
            ], 200);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to reset MAC binding',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
