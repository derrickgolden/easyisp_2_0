<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\RadiusService;
use Illuminate\Http\Request;

class RadiusController extends Controller
{
    protected $radiusService;

    public function __construct(RadiusService $radiusService)
    {
        $this->radiusService = $radiusService;
    }

    /**
     * Authenticate a user via RADIUS database
     * Queries the actual RADIUS database configured in .env
     */
    public function authenticate(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        // Authenticate against RADIUS database
        $result = $this->radiusService->authenticate($request->username, $request->password);

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
                'status' => 'Access-Reject',
            ], 401);
        }

        // Get user attributes (IP, package info, etc)
        $userAttrs = $this->radiusService->getUserAttributes($request->username);
        $userReplyAttrs = $this->radiusService->getUserReplyAttributes($request->username);
        $userGroups = $result['groups'] ?? [];

        // Get group reply attributes (bandwidth, session timeout)
        $groupAttrs = [];
        if (!empty($userGroups)) {
            $groupAttrs = $this->radiusService->getGroupReplyAttributes($userGroups[0]['groupname'] ?? '');
        }

        // Try to match customer in local database for additional info
        $customer = Customer::where('radius_username', $request->username)->first();

        return response()->json([
            'message' => 'Authentication successful',
            'status' => 'Access-Accept',
            'user' => [
                'username' => $request->username,
                'groups' => $userGroups,
            ],
            'attributes' => [
                'check' => $userAttrs,
                'reply' => $userReplyAttrs,
                'group_reply' => $groupAttrs,
            ],
            'customer_info' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->first_name . ' ' . $customer->last_name,
                'ip_address' => $customer->ip_address,
                'mac_address' => $customer->mac_address,
                'package' => $customer->package ? [
                    'name' => $customer->package->name,
                    'speed_up' => $customer->package->speed_up,
                    'speed_down' => $customer->package->speed_down,
                ] : null,
                'connection_type' => $customer->connection_type,
            ] : null,
        ]);
    }

    /**
     * Get RADIUS configuration for a specific username
     */
    public function getConfig($username)
    {
        // Get user from RADIUS database
        $userAttrs = $this->radiusService->getUserAttributes($username);
        $userReplyAttrs = $this->radiusService->getUserReplyAttributes($username);

        if (empty($userAttrs) && empty($userReplyAttrs)) {
            // Try customer table
            $customer = Customer::where('radius_username', $username)->first();
            if (!$customer) {
                return response()->json(['message' => 'User not found'], 404);
            }

            return response()->json([
                'customer' => [
                    'username' => $customer->radius_username,
                    'ip_address' => $customer->ip_address,
                    'mac_address' => $customer->mac_address,
                ],
                'package' => $customer->package ? [
                    'name' => $customer->package->name,
                    'speed_up' => $customer->package->speed_up,
                    'speed_down' => $customer->package->speed_down,
                    'type' => $customer->package->type,
                    'validity_days' => $customer->package->validity_days,
                ] : null,
                'site' => $customer->site ? [
                    'name' => $customer->site->name,
                    'location' => $customer->site->location,
                    'ip_address' => $customer->site->ip_address,
                    'radius_secret' => $customer->site->radius_secret,
                ] : null,
            ]);
        }

        return response()->json([
            'username' => $username,
            'check_attributes' => $userAttrs,
            'reply_attributes' => $userReplyAttrs,
        ]);
    }

    /**
     * Verify RADIUS credentials
     */
    public function verify(Request $request, $username)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $result = $this->radiusService->authenticate($username, $request->password);

        return response()->json([
            'verified' => $result['success'],
            'message' => $result['message'],
            'status' => $result['status'],
        ]);
    }

    /**
     * Get WiFi access details for a RADIUS user
     */
    public function getWifiAccess(Request $request, $username)
    {
        // Get user attributes from RADIUS
        $userAttrs = $this->radiusService->getUserAttributes($username);
        $userReplyAttrs = $this->radiusService->getUserReplyAttributes($username);

        // Try to match with customer in local database
        $customer = Customer::where('radius_username', $username)->first();

        if (!$customer) {
            return response()->json([
                'has_access' => true,
                'radius_user' => $username,
                'attributes' => [
                    'check' => $userAttrs,
                    'reply' => $userReplyAttrs,
                ],
            ]);
        }

        // Check customer account status
        if ($customer->status !== 'active' || ($customer->expiry_date && strtotime($customer->expiry_date) < time())) {
            return response()->json([
                'has_access' => false,
                'reason' => $customer->status !== 'active' ? 'Account is ' . $customer->status : 'Subscription expired',
            ]);
        }

        return response()->json([
            'has_access' => true,
            'wifi_credentials' => [
                'username' => $customer->radius_username,
                'connection_type' => $customer->connection_type,
            ],
            'network_config' => [
                'ip_address' => $customer->ip_address,
                'mac_address' => $customer->mac_address,
                'site_ip' => $customer->site?->ip_address,
            ],
            'package_details' => $customer->package ? [
                'name' => $customer->package->name,
                'speed_up' => $customer->package->speed_up,
                'speed_down' => $customer->package->speed_down,
            ] : null,
            'attributes' => [
                'check' => $userAttrs,
                'reply' => $userReplyAttrs,
            ],
        ]);
    }

    /**
     * Create RADIUS user
     */
    public function createUser(Request $request)
    {
        $request->validate([
            'username' => 'required|string|unique:raduser,username',
            'password' => 'required|string|min:6',
            'group' => 'sometimes|string',
            'check_attributes' => 'sometimes|array',
            'reply_attributes' => 'sometimes|array',
        ]);

        $result = $this->radiusService->createUser(
            $request->username,
            $request->password,
            [
                'check' => $request->get('check_attributes', []),
                'reply' => $request->get('reply_attributes', []),
            ]
        );

        if (!$result['success']) {
            return response()->json($result, 422);
        }

        // Assign to group if provided
        if ($request->has('group')) {
            $this->radiusService->assignUserToGroup($request->username, $request->group);
        }

        return response()->json($result, 201);
    }

    /**
     * Update RADIUS user password
     */
    public function updatePassword(Request $request, $username)
    {
        $request->validate([
            'new_password' => 'required|string|min:6',
        ]);

        $result = $this->radiusService->updateUserPassword($username, $request->new_password);

        return response()->json($result);
    }

    /**
     * Get all RADIUS users
     */
    public function listUsers(Request $request)
    {
        $limit = $request->get('limit', 50);
        $offset = $request->get('offset', 0);

        $users = $this->radiusService->getAllUsers($limit, $offset);

        return response()->json([
            'total' => count($users),
            'limit' => $limit,
            'offset' => $offset,
            'users' => $users,
        ]);
    }

    /**
     * Get all RADIUS groups
     */
    public function listGroups()
    {
        $groups = $this->radiusService->getAllGroups();

        return response()->json([
            'total' => count($groups),
            'groups' => $groups,
        ]);
    }

    /**
     * Delete RADIUS user
     */
    public function deleteUser($username)
    {
        $result = $this->radiusService->deleteUser($username);

        return response()->json($result);
    }

    /**
     * Sync a customer to RADIUS database
     * Creates or updates customer in RADIUS tables
     */
    public function syncCustomer(Request $request, $customerId)
    {
        $this->authorize('manage', Customer::class);

        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        if (!$customer->radius_username || !$customer->radius_password) {
            return response()->json([
                'message' => 'Customer does not have RADIUS credentials',
            ], 422);
        }

        try {
            // Delete if exists
            if ($this->radiusService->userExists($customer->radius_username)) {
                $this->radiusService->deleteUser($customer->radius_username);
            }

            // Create user in RADIUS database
            $result = $this->radiusService->createUser(
                $customer->radius_username,
                $customer->radius_password,
                [
                    'check' => [
                        [
                            'attribute' => 'Framed-IP-Address',
                            'op' => '==',
                            'value' => $customer->ip_address ?? '',
                        ],
                    ],
                    'reply' => [
                        [
                            'attribute' => 'Framed-IP-Address',
                            'op' => ':=',
                            'value' => $customer->ip_address ?? '',
                        ],
                        [
                            'attribute' => 'Framed-IP-Netmask',
                            'op' => ':=',
                            'value' => '255.255.255.0',
                        ],
                        [
                            'attribute' => 'Service-Type',
                            'op' => ':=',
                            'value' => 'Framed-User',
                        ],
                    ],
                ]
            );

            if (!$result['success']) {
                return response()->json($result, 422);
            }

            // Assign to group based on package
            if ($customer->package) {
                $groupName = strtolower(str_replace(' ', '_', $customer->package->name));
                $this->radiusService->assignUserToGroup($customer->radius_username, $groupName);
            }

            return response()->json([
                'message' => 'Customer synced to RADIUS successfully',
                'customer_id' => $customerId,
                'radius_username' => $customer->radius_username,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error syncing customer: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sync all active customers to RADIUS database
     */
    public function syncAllCustomers(Request $request)
    {
        $this->authorize('manage', Customer::class);

        $force = $request->get('force', false);
        $synced = 0;
        $skipped = 0;
        $failed = 0;

        // Get all active customers with RADIUS credentials
        $customers = Customer::where('status', 'active')
            ->whereNotNull('radius_username')
            ->whereNotNull('radius_password')
            ->get();

        foreach ($customers as $customer) {
            try {
                // Check if exists
                $exists = $this->radiusService->userExists($customer->radius_username);

                if ($exists && !$force) {
                    $skipped++;
                    continue;
                }

                // Delete if force
                if ($exists && $force) {
                    $this->radiusService->deleteUser($customer->radius_username);
                }

                // Create in RADIUS
                $result = $this->radiusService->createUser(
                    $customer->radius_username,
                    $customer->radius_password,
                    [
                        'check' => [
                            [
                                'attribute' => 'Framed-IP-Address',
                                'op' => '==',
                                'value' => $customer->ip_address ?? '',
                            ],
                        ],
                        'reply' => [
                            [
                                'attribute' => 'Framed-IP-Address',
                                'op' => ':=',
                                'value' => $customer->ip_address ?? '',
                            ],
                            [
                                'attribute' => 'Framed-IP-Netmask',
                                'op' => ':=',
                                'value' => '255.255.255.0',
                            ],
                            [
                                'attribute' => 'Service-Type',
                                'op' => ':=',
                                'value' => 'Framed-User',
                            ],
                        ],
                    ]
                );

                if ($result['success']) {
                    // Assign to group
                    if ($customer->package) {
                        $groupName = strtolower(str_replace(' ', '_', $customer->package->name));
                        $this->radiusService->assignUserToGroup($customer->radius_username, $groupName);
                    }
                    $synced++;
                } else {
                    $failed++;
                }
            } catch (\Exception $e) {
                $failed++;
            }
        }

        return response()->json([
            'message' => 'Customer sync completed',
            'synced' => $synced,
            'skipped' => $skipped,
            'failed' => $failed,
            'total' => $customers->count(),
        ]);
    }

    /**
     * Get RADIUS status for a customer
     */
    public function getCustomerRadiusStatus($customerId)
    {
        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        if (!$customer->radius_username) {
            return response()->json([
                'customer_id' => $customerId,
                'status' => 'no_credentials',
                'message' => 'Customer does not have RADIUS credentials',
            ]);
        }

        $exists = $this->radiusService->userExists($customer->radius_username);
        $attributes = $this->radiusService->getUserAttributes($customer->radius_username);
        $replyAttrs = $this->radiusService->getUserReplyAttributes($customer->radius_username);
        $groups = [];

        try {
            $conn = $this->radiusService->getConnection();
            $groups = $conn->table('radusergroup')
                ->where('username', $customer->radius_username)
                ->get(['groupname', 'priority'])
                ->toArray();
        } catch (\Exception $e) {
            // Groups query failed
        }

        return response()->json([
            'customer_id' => $customerId,
            'radius_username' => $customer->radius_username,
            'synced_to_radius' => $exists,
            'check_attributes' => $attributes,
            'reply_attributes' => $replyAttrs,
            'groups' => $groups,
            'customer' => [
                'name' => $customer->first_name . ' ' . $customer->last_name,
                'status' => $customer->status,
                'expiry_date' => $customer->expiry_date,
                'package' => $customer->package ? $customer->package->name : null,
            ],
        ]);
    }
}
