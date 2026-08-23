<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\HotspotCustomerResource;
use App\Services\HotspotCustomerRadiusService;
use App\Services\HotspotSubscriptionService;
use App\Services\CustomerMessagingService;
use App\Models\HotspotCustomer;
use App\Models\Site;
use Carbon\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;


class HotspotCustomerController extends Controller
{
    protected $radiusService;
    protected $subscriptionService;
        
    public function __construct(HotspotCustomerRadiusService $radiusService, HotspotSubscriptionService $subscriptionService)
    {
        $this->middleware('permission:view-customers')->only(['index', 'getByOrganization']);
        $this->middleware('permission:view-customer-details')->only(['show', 'showWithRelations', 'getRadiusStatus']);
        $this->middleware('permission:manage-customers|create-customers')->only(['store', 'update']);
        $this->middleware('permission:delete-customers')->only(['destroy']);
        $this->middleware('permission:manage-subscriptions')->only(['pauseSubscription', 'resumeSubscription']);
        $this->middleware('permission:flash-mac-binding')->only(['resetMacBinding']);

        $this->radiusService = $radiusService;
        $this->subscriptionService = $subscriptionService;
    }

    public function index(Request $request)
    {
        $organizationId = $request->user()->organization_id;
        $perPage = max(1, min((int) $request->query('per_page', 10), 200));
        $status = trim((string) $request->query('status', ''));
        $siteId = trim((string) $request->query('site_id', ''));
        $packageId = trim((string) $request->query('package_id', ''));
        $onlineStatus = strtolower(trim((string) $request->query('online_status', '')));
        $search = trim((string) $request->query('search', ''));

        // --- 1. OPTIMIZATION: Fetch Active RADIUS Usernames upfront ---
        // Instead of slow subqueries inside SQL, get a fast array of usernames 
        // currently marked as online in RADIUS.
        $allOrgUsernames = HotspotCustomer::where('organization_id', $organizationId)
            ->whereNotNull('radius_username')
            ->pluck('radius_username')
            ->toArray();

        $activeOnlineUsernames = [];
        if (!empty($allOrgUsernames)) {
            try {
                // This is lightning fast because it only queries active sessions (acctstoptime is null)
                $activeOnlineUsernames = DB::connection('radius')
                    ->table('radacct')
                    ->whereIn('username', $allOrgUsernames)
                    ->whereNull('acctstoptime')
                    ->pluck('username')
                    ->unique()
                    ->toArray();
            } catch (\Throwable $e) {
                Log::warning('Failed to fetch active sessions from RADIUS.', ['error' => $e->getMessage()]);
            }
        }

        // --- 2. Build the Base Query ---
        $query = HotspotCustomer::query()->where('organization_id', $organizationId);

        // Apply standard filters
        if ($status !== '') {
            $query->where('status', $status);
        }
        if ($siteId !== '') {
            $query->where('site_id', $siteId);
        }
        if ($packageId !== '') {
            $query->where('package_id', $packageId);
        }

        // --- 3. OPTIMIZATION: Fast PHP-driven Online/Offline filtering ---
        // No correlated subqueries or collation conversions!
        if ($onlineStatus === 'online') {
            $query->whereIn('radius_username', $activeOnlineUsernames);
        } elseif ($onlineStatus === 'offline') {
            $query->where(function ($q) use ($activeOnlineUsernames) {
                $q->whereNull('radius_username')
                ->orWhereNotIn('radius_username', $activeOnlineUsernames);
            });
        }

        if ($search !== '') {
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery->where('mac_address', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('host_name', 'like', "%{$search}%")
                    ->orWhereHas('package', function ($packageQuery) use ($search) {
                        $packageQuery->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('site', function ($siteQuery) use ($search) {
                        $siteQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // --- 4. OPTIMIZATION: Faster Stats Generation ---
        // Count stats BEFORE adding eager loads or ordering to save database cycles
        $stats = [
            'total'   => (clone $query)->count(),
            'active'  => (clone $query)->where('status', 'active')->count(),
            'expired' => (clone $query)->where('status', 'expired')->count(),
            'online'  => count($activeOnlineUsernames), // Calculated purely in memory now!
        ];

        // --- 5. Paginate ---
        $customersPaginator = $query
            ->with([
                'site:id,name,ip_address',
                'package:id,name,price,speed_down,speed_up',
            ])
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        // --- 6. Session Enrichment for Current Page (Max 50 or 200) ---
        $customersCollection = $customersPaginator->getCollection();
        $pageUsernames = $customersCollection->pluck('radius_username')->filter()->values()->toArray();
        $latestSessions = collect();

        if (!empty($pageUsernames)) {
            try {
                $latestSessions = DB::connection('radius')
                    ->table('radacct')
                    ->whereIn('username', $pageUsernames)
                    ->whereIn('radacctid', function ($subQuery) use ($pageUsernames) {
                        $subQuery->selectRaw('MAX(radacctid)')
                            ->from('radacct')
                            ->whereIn('username', $pageUsernames)
                            ->groupBy('username');
                    })
                    ->get(['username', 'nasipaddress', 'acctstoptime'])
                    ->keyBy('username');
            } catch (\Throwable $exception) {
                Log::warning('Failed to load session states from RADIUS.', ['error' => $exception->getMessage()]);
            }
        }

        // Fetch site maps based on active NAS IPs
        $sitesByIp = collect();
        $sessionNasIps = $latestSessions->pluck('nasipaddress')->filter()->unique()->values()->all();

        if (!empty($sessionNasIps)) {
            $sitesByIp = Site::query()
                ->where('organization_id', $organizationId)
                ->whereIn('ip_address', $sessionNasIps)
                ->get(['id', 'name', 'ip_address'])
                ->keyBy(fn ($site) => trim((string) $site->ip_address));
        }

        // Map attributes back to models
        $customersCollection->each(function ($customer) use ($latestSessions, $sitesByIp) {
            $session = $latestSessions->get($customer->radius_username);
            $isOnline = ($session && is_null($session->acctstoptime));
            $nasIpAddress = trim((string) ($session?->nasipaddress ?? ''));

            $customer->is_online = $isOnline ? 1 : 0;
            $customer->online_status = $isOnline ? 'online' : 'offline';
            $customer->radius_nas_ip = $nasIpAddress !== '' ? $nasIpAddress : null;

            if ($nasIpAddress !== '' && $sitesByIp->has($nasIpAddress)) {
                $matchedSite = $sitesByIp->get($nasIpAddress);
                $customer->site_id = $matchedSite->id;
                $customer->setRelation('site', $matchedSite);
            }
        });

        return response()->json([
            'data' => HotspotCustomerResource::collection($customersCollection),
            'meta' => [
                'current_page' => $customersPaginator->currentPage(),
                'last_page' => $customersPaginator->lastPage(),
                'per_page' => $customersPaginator->perPage(),
                'total' => $customersPaginator->total(),
                'from' => $customersPaginator->firstItem(),
                'to' => $customersPaginator->lastItem(),
            ],
            'stats' => $stats,
        ]);
    }

    public function store(Request $request)
    {
        $orgId = $request->user()->organization_id;
        $isChild = $request->filled('parent_id');

        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',

            // PHONE: Unique inside Org ONLY if it's a main account (not a child)
            'phone' => [
                'required', 'string',
                !$isChild ? Rule::unique('hotspot_customers')->where('organization_id', $orgId) : ''
            ],
            'location' => 'nullable|string',
            'package_id' => 'required|exists:packages,id',
            'custom_package_price' => 'nullable|numeric|min:0',
            'site_id' => [
                'nullable',
                Rule::exists('sites', 'id')->where(fn ($query) => $query->where('organization_id', $orgId)),
            ],
            'connection_type' => 'sometimes|in:Hotspot,Static IP',
            'installation_fee' => 'sometimes|numeric|min:0',
            'balance' => 'sometimes|numeric|min:0',
            'ip_address' => 'nullable|string',
            'mac_address' => 'nullable|string',
            'parent_id' => [
                'nullable',
                Rule::exists('hotspot_customers', 'id')->where(fn ($query) => $query->where('organization_id', $orgId)),
            ],
            'is_independent' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $customerData = $request->all();

            // Get organization for company acronym
            $organization = \App\Models\Organization::find($request->user()->organization_id);
            
            // Auto-generate RADIUS password
            $radiusPassword = $request->input('radius_password') 
                ?? HotspotCustomerRadiusService::generateRadiusPassword();

            // Use radius password as account password if none provided
            $accountPassword = $request->input('password') ?? $radiusPassword;

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

            // Enforce that parent account belongs to same organization
            if ($request->filled('parent_id')) {
                $parentInOrg = HotspotCustomer::where('organization_id', $orgId)->find($request->input('parent_id'));
                if (!$parentInOrg) {
                    return response()->json(['errors' => ['parent_id' => ['Selected parent account is invalid.']]], 422);
                }
            }

            // If creating a non-independent child, inherit the parent's expiry date
            $isIndependent = filter_var($request->input('is_independent', false), FILTER_VALIDATE_BOOLEAN);
            if ($isChild && !$isIndependent && !$request->filled('expiry_date')) {
                $parent = HotspotCustomer::where('organization_id', $orgId)->find($request->input('parent_id'));
                if ($parent && $parent->expiry_date) {
                    $defaultExpiry = $parent->expiry_date;
                }
            }

            // Create customer first with a temporary username to get the ID
            $tempUsername = 'temp_' . uniqid();
            $customer = HotspotCustomer::create(array_merge($customerData, [
                'organization_id' => $request->user()->organization_id,
                'status' => 'active',
                'radius_username' => $tempUsername,
                'radius_password' => $radiusPassword,
                'activated_at' => now(),
                'expiry_date' => $request->input('expiry_date', $defaultExpiry),
                'password' => Hash::make($accountPassword),
            ]));

            // Generate final RADIUS username using customer ID and organization acronym
            $radiusUsername = $request->input('radius_username') 
                ?? HotspotCustomerRadiusService::generateRadiusUsername(
                    $customer->id,
                    $organization->acronym ?? null
                );

            // Check if username already exists and modify if necessary
            $usernameModified = false;
            if (HotspotCustomer::where('radius_username', $radiusUsername)->where('id', '!=', $customer->id)->exists()) {
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
                if (HotspotCustomer::where('radius_username', $radiusUsername)->where('id', '!=', $customer->id)->exists()) {
                    $radiusUsername = $radiusUsername . '_' . $customer->id;
                    $usernameModified = true;
                }
            }

            // Update customer with the generated username
            $customer->radius_username = $radiusUsername;

            // If expiry is within 1 hour (e.g. trial accounts), pre-stamp the 1-hour warning flag
            // so the cron never fires that SMS for short-lived new accounts.
            $expiryCarbon = Carbon::parse($customer->expiry_date);
            if ($expiryCarbon->diffInMinutes(now(), false) >= -60) {
                $customer->expiry_one_hour_warning_sent_at = now();
            }

            $customer->save();
            // Sync to RADIUS
            $syncResult = $this->radiusService->syncCustomerToRadius($customer);

            // Send registration SMS (non-blocking; service logs failures internally)
            // app(CustomerMessagingService::class)->send(
            //     $customer,
            //     CustomerMessagingService::TYPE_REGISTRATION,
            //     [
            //         '{Expiry}' => $expiryCarbon->format('M d, Y h:i A'),
            //     ]
            // );

            $customerResource = new HotspotCustomerResource($customer);

            return response()->json([
                'message' => 'Customer created successfully',
                'customer' => $customerResource->load('package', 'site'),
                'radius_sync' => $syncResult,
                'username_modified' => $usernameModified,
                'username_message' => $usernameModified ? 'RADIUS username was modified to avoid conflicts' : null,
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Failed to create hotspot customer: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'message' => 'Failed to create customer',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function show(Request $request, $id)
    {
        $customer = HotspotCustomer::query()
            ->where('organization_id', $request->user()->organization_id)
            ->whereKey($id)
            ->with([
                'site:id,name,ip_address',
                'package:id,name,price,speed_down,speed_up',
            ])
            ->first();

        if (! $customer) {
            return response()->json(['message' => 'Hotspot customer not found'], 404);
        }

        return response()->json(['customer' => new HotspotCustomerResource($customer)]);
    }

    public function technicalSpecs(Request $request, $id)
    {
        return $this->radiusService->getTechnicalSpecs($request, $id);
    }

    public function update(Request $request, $id)
    {
        if (($request->has('expiry_date') || $request->has('extension_date')) && !$request->user()->can('change-expiry')) {
            return response()->json(['message' => 'Unauthorized to change expiry dates'], 403);
        }

        if ($request->has('package_id') && !$request->user()->can('change-packages')) {
            return response()->json(['message' => 'Unauthorized to change customer packages'], 403);
        }

        if ($request->has('balance') && !$request->user()->can('adjust-balances')) {
            return response()->json(['message' => 'Unauthorized to adjust customer balances'], 403);
        }

        $customer = HotspotCustomer::where('organization_id', $request->user()->organization_id)->find($id);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'first_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => 'nullable|string|email',
            'phone' => 'sometimes|string',
            'location' => 'nullable|string',
            'apartment' => 'nullable|string',
            'house_no' => 'nullable|string',
            'package_id' => 'sometimes|exists:packages,id',
            'custom_package_price' => 'nullable|numeric|min:0',
            'site_id' => [
                'nullable',
                Rule::exists('sites', 'id')->where(fn ($query) => $query->where('organization_id', $customer->organization_id)),
            ],
            'connection_type' => 'sometimes|in:Hotspot,Static IP',
            'radius_username' => 'sometimes|string|max:255', // Uniqueness handled by conflict resolution logic
            'installation_fee' => 'sometimes|numeric|min:0',
            'status' => 'sometimes|in:active,expired,suspended',
            'expiry_date' => 'sometimes|date',
            'extension_date' => 'nullable|date',
            'balance' => 'sometimes|numeric|min:0',
            'ip_address' => 'nullable|string',
            'mac_address' => 'nullable|string',
            'parent_id' => [
                'nullable',
                Rule::exists('hotspot_customers', 'id')->where(fn ($query) => $query->where('organization_id', $customer->organization_id)),
            ],
            'is_independent' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $updateData = $request->all();
        $newIndependent = $request->has('is_independent')
            ? filter_var($request->input('is_independent'), FILTER_VALIDATE_BOOLEAN)
            : $customer->is_independent;
        $newParentId = $request->filled('parent_id') ? $request->input('parent_id') : $customer->parent_id;

        if ($customer->is_independent && !$newIndependent && $newParentId) {
            $parent = HotspotCustomer::where('organization_id', $customer->organization_id)->find($newParentId);
            if ($parent && $parent->expiry_date) {
                $updateData['expiry_date'] = $parent->expiry_date;
                $updateData['extension_date'] = $parent->extension_date;
            }
        }

        $oldUsername = $customer->radius_username;
        
        // Track if we need to modify the username
        $usernameModified = false;
        $newUsername = $request->input('radius_username');
        
        // If username is being changed, check for conflicts
        if ($newUsername && $newUsername !== $oldUsername) {
            // Check if new username already exists
            if (HotspotCustomer::where('radius_username', $newUsername)->where('id', '!=', $customer->id)->exists()) {
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
                if (HotspotCustomer::where('radius_username', $newUsername)->where('id', '!=', $customer->id)->exists()) {
                    $newUsername = $newUsername . '_' . $customer->id;
                    $usernameModified = true;
                }
                
                // Update request and payload data with modified username
                $request->merge(['radius_username' => $newUsername]);
                $updateData['radius_username'] = $newUsername;
            }
        }

        $customer->update($updateData);

        app(HotspotCustomerRadiusService::class)->disconnectCustomer($customer->radius_username, $customer->organization_id);


        // Re-sync to RADIUS if critical fields changed
        if ($customer->wasChanged(['package_id', 'ip_address', 'status', 'radius_password', 'radius_username'])) {
            $syncResult = $this->radiusService->syncCustomerToRadius($customer, $oldUsername);
            if ($syncResult['success']) {
                // Force the router to kick the user so they reconnect with new settings
                $this->radiusService->disconnectCustomer($oldUsername ?? $customer->radius_username, $customer->organization_id);
            }else {
                \Log::error('RADIUS sync failed for customer ' . $customer->id . ': ' . $syncResult['message']);
            }
        }

        if ($customer->wasChanged(['expiry_date', 'extension_date'])) {
                $newExpiry = $this->subscriptionService->getEffectiveExpiryDate($customer);

                $customer->expiry_warning_sent_at = null;
                $customer->expiry_one_hour_warning_sent_at = null;

                if ($newExpiry->isFuture()) {
                    $customer->status = 'active';
                    $customer->save();
                    $this->subscriptionService->applyActiveStatus($customer);
                } else {
                    $customer->save();
                    $this->subscriptionService->syncSubscription($customer);
                }

                $dependentChildren = $customer->subAccounts()->where('is_independent', false)->get();
                foreach ($dependentChildren as $child) {
                    $child->expiry_date = $customer->expiry_date;
                    $child->expiry_warning_sent_at = null;
                    $child->expiry_one_hour_warning_sent_at = null;

                    if ($newExpiry->isFuture()) {
                        $child->status = 'active';
                        $child->save();
                        $this->subscriptionService->applyActiveStatus($child);
                    } else {
                        $child->save();
                        $this->subscriptionService->syncSubscription($child);
                    }
                }
        }

        return response()->json([
            'message' => 'Customer updated successfully',
            'customer' => $customer->load('package', 'site'),
            'username_modified' => $usernameModified,
            'username_message' => $usernameModified ? 'RADIUS username was modified to avoid conflicts' : null,
        ]);
    }

    public function pauseSubscription(Request $request, HotspotCustomer $customer)
    {
        if ((int) $customer->organization_id !== (int) $request->user()->organization_id) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

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

    public function resumeSubscription(Request $request, HotspotCustomer $customer)
    {
        if ((int) $customer->organization_id !== (int) $request->user()->organization_id) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

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
            $customer->expiry_warning_sent_at = null; // Reset warning flag for new expiry
            $customer->expiry_one_hour_warning_sent_at = null;
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

    public function destroy(Request $request, $id)
    {
        // Load subAccounts to check for existence
        $customer = HotspotCustomer::with('subAccounts')
            ->where('organization_id', $request->user()->organization_id)
            ->findOrFail($id);

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
                $this->radiusService->disconnectCustomer($subAccount->radius_username, $subAccount->organization_id);
                
                // Delete from MySQL
                $subAccount->delete();
            }

            // 2. Clean up the Master Account
            $this->radiusService->removeCustomerFromRadius($customer->radius_username);
            $this->radiusService->disconnectCustomer($customer->radius_username, $customer->organization_id);
            $customer->delete();

            return response()->json(['message' => 'Master and sub-accounts deleted successfully']);
        });
    }

    public function showWithRelations(Request $request, $id)
    {
        $customer = HotspotCustomer::query()
            ->where('organization_id', $request->user()->organization_id)
            ->whereKey($id)
            ->with([
                'site:id,name,ip_address',
                'package:id,name,price,speed_down,speed_up',
                'parent:id,organization_id,site_id,mac_address,phone,parent_id,host_name,status,ip_address,activated_at,expiry_date,expiry_one_hour_warning_sent_at,expiry_ten_minutes_warning_sent_at,radius_username,radius_password',
                'children:id,organization_id,site_id,mac_address,phone,parent_id,host_name,status,ip_address,activated_at,expiry_date,expiry_one_hour_warning_sent_at,expiry_ten_minutes_warning_sent_at,radius_username,radius_password',
            ])
            ->first();

        if (! $customer) {
            return response()->json(['message' => 'Hotspot customer not found'], 404);
        }

        return response()->json([
            'customer' => new HotspotCustomerResource($customer)
        ]);
    }

    public function resetMacBinding(Request $request, $id)
    {
        $customer = HotspotCustomer::where('organization_id', $request->user()->organization_id)->find($id);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        try {
            // Remove MAC lock only for this organization
            // $this->radiusService->flushMacOnly($customer->radius_username, $customer->organization_id);
            // Disconnect any active sessions for this username
            $this->radiusService->disconnectCustomer($customer->radius_username, $customer->organization_id);
                        
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

    public function syncDevice(Request $request)
    {
        // Validate the incoming data from MikroTik
        $validated = $request->validate([
            'username'  => 'required|string',
            'mac'       => 'required|string',
            'hostname'  => 'nullable|string',
        ]);

        // Find the hotspot customer by their login username/voucher
        $customer = HotspotCustomer::where('mac_address', $validated['mac'])->first();

        if ($customer) {
            $customer->update([
                'mac_address' => $validated['mac'],
                // Fallback to "Unknown Device" if DHCP Option 12 wasn't sent
                'host_name' => $validated['hostname'] ?: 'Unknown Device', 
            ]);

            return response()->json(['status' => 'success', 'message' => 'Device mapped.']);
        }

        return response()->json(['status' => 'error', 'message' => 'Customer not found.'], 404);
    }
}
