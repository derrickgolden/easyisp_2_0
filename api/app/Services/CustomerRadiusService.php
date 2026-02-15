<?php

namespace App\Services;

use Exception;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http; // You'll likely need this for the API call too
use Illuminate\Support\Facades\Log;

class CustomerRadiusService
{
    private $radiusConnection;

    public function __construct()
    {
        $this->radiusConnection = DB::connection('radius');
    }

    /**
     * Translates technical RADIUS reasons into human-readable labels.
     */
    protected function translateRadiusReason($reason, $reply, $customer = null)
    {
        if ($reply === 'Access-Accept') {
            // If we have customer info, check their current database status
            if ($customer) {
                if ($customer->status === 'suspended') {
                    return 'Paused';
                }
                if ($customer->status === 'expired') {
                    return 'Expired';
                }
            }
            return 'Auth Successful';
        }

        if (empty($reason)) {
            return 'Denied (No reason provided)';
        }

        // Match technical strings to friendly labels
        return match (true) {
            str_contains($reason, 'mschap: MS-CHAP2-Response is incorrect') => 'Invalid Password',
            str_contains($reason, 'User-Name is not found') => 'Username Not Found',
            str_contains($reason, 'Account has expired') => 'Subscription Expired',
            str_contains($reason, 'Multiple logins not allowed') => 'Device Limit Reached',
            str_contains($reason, 'Cleartext-Password is incorrect') => 'Invalid Password',
            default => $reason, // Fallback to the raw reason if no match
        };
    }

    public function syncCustomerToRadius(Customer $customer, $oldUsername = null)
    {
        try {
            // If username changed, remove old entry
            $usernameToClean = $oldUsername ?? $customer->radius_username;

            // 1. Clean slate for this username
            $this->removeCustomerFromRadius($usernameToClean);

            // 2. Add Authentication (radcheck)
            // Using 'Cleartext-Password' as the attribute for MS-CHAPv2 compatibility
            $this->addCheckAttribute($customer->radius_username, 'Cleartext-Password', ':=', $customer->radius_password);
            
            if ($customer->status !== 'active') {
                return [
                    'success' => true, 
                    'message' => 'User is inactive; removed from RADIUS.'
                ];
            }


            // 3. Add User-Specific Overrides (radreply)
            // ONLY add these if the customer has a specific custom override
            if ($customer->custom_rate_limit) {
                $this->addReplyAttribute($customer->radius_username, 'Mikrotik-Rate-Limit', ':=', $customer->custom_rate_limit);
            }

            // 4. Assign to Group (radusergroup)
            // log all customer data for debugging
            if ($customer->package) {
                // Consistency: Group Name is always 'package_' + ID
                $groupName = "package_" . $customer->package->id;
                if ($groupName) {
                    $this->addUserToGroup($customer->radius_username, $groupName);
                }
            }

            return [
                'success' => true,
                'message' => 'Customer synced to RADIUS successfully',
            ];
        } catch (Exception $e) {
            // Log the error
            return [
                'success' => false,
                'message' => 'Failed to sync: ' . $e->getMessage(),
            ];
        }
    }

    // public function disconnectCustomer($username)
    // {
    //     // 1. Sanitize inputs immediately
    //     $safeUsername = escapeshellarg($username);

    //     $sessions = DB::connection('radius')
    //         ->table('radacct')
    //         ->where('username', $username)
    //         ->whereNull('acctstoptime')
    //         ->get(['acctsessionid', 'nasipaddress']);

    //         Log::info("Attempting to disconnect user {$username}. Active sessions found: " . json_encode($sessions));
    //     if ($sessions->isEmpty()) {
    //         return ['status' => false, 'message' => "⚠️ No active session found."];
    //     }

    //     $responses = [];
    //     foreach ($sessions as $session) {
    //         $router = \App\Models\Site::where('ip_address', $session->nasipaddress)->first();

    //         if (!$router) {
    //             $responses[] = ['status' => false, 'message' => "❌ Router {$session->nasipaddress} not in DB."];
    //             continue;
    //         }
            
    //         // 2. Prepare CoA Request
    //         $coaRequest = "User-Name=$username,Acct-Session-Id={$session->acctsessionid}";
    //         $command = sprintf(
    //             'echo %s | radclient -x %s:%d disconnect %s 2>&1',
    //             escapeshellarg($coaRequest),
    //             escapeshellarg($router->ip_address),
    //             (int)$router->radius_coa_port,
    //             escapeshellarg($router->radius_secret)
    //         );

    //         $output = shell_exec($command);
    //         Log::info("CoA command executed: {$command}. Output: {$output}");
    //         // 3. Robust parsing
    //         if (strpos($output, 'Disconnect-ACK') !== false) {
    //             $responses[] = [
    //                 'status' => true,
    //                 'message' => "✅ {$username} disconnected from {$router->name}.",
    //                 'output' => $output,
    //             ];
    //             Log::info("Successfully disconnected {$username} from {$router->name}.");
    //         } elseif (strpos($output, 'Disconnect-NAK') !== false) {
    //             // The router is online but the session is already gone (Ghost Session)
    //             $this->forceCloseSession($username, $session->acctsessionid);
    //             Log::warning("Received Disconnect-NAK for {$username} on {$router->name}. Session likely already closed. Forcing local session termination.");
    //             $responses[] = [
    //                 'status' => true,
    //                 'message' => "👻 Ghost session cleared for {$username} (Router rejected request).",
    //             ];
    //         }   elseif (strpos($output, 'No reply') !== false) {
                
    //             // Check the boolean directly from the site model
    //             if ($router->is_online == false) {
    //                 $this->forceCloseSession($username, $session->acctsessionid);

    //                 $responses[] = [
    //                     'status' => true,
    //                     'message' => "⚡ {$router->name} is offline (Last seen: {$router->last_seen}). Session closed.",
    //                 ];
    //             } else {
    //                 $responses[] = [
    //                     'status' => false,
    //                     'message' => "🚫 Timeout: {$router->name} is reachable via Ping but RADIUS CoA failed.",
    //                 ];
    //             }
    //         }
    //     }

    //     Log::info("Disconnect responses for {$username}: " . json_encode($responses));

    //     return [
    //         'status' => !collect($responses)->contains('status', false),
    //         'details' => $responses,
    //     ];
    // }

    // private function forceCloseSession($username, $sessionId, $cause = 'NAS-Off') {
    //     return DB::connection('radius')->table('radacct')
    //         ->where('username', $username)
    //         ->where('acctsessionid', $sessionId)
    //         ->whereNull('acctstoptime') // Only update if it's actually still open
    //         ->update([
    //             'acctstoptime' => now(),
    //             'acctterminatecause' => $cause,
    //             'acctsessiontime' => DB::raw('UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(acctstarttime)')
    //         ]);
    // }

    public function disconnectCustomer($username)
    {
        // Use the 'radius' connection to fetch sessions
        $sessions = DB::connection('radius')
            ->table('radacct')
            ->where('username', $username)
            ->whereNull('acctstoptime')
            ->get(['acctsessionid', 'nasipaddress', 'radacctid']); 

        Log::info("--- START DISCONNECT: {$username} ---");

        if ($sessions->isEmpty()) {
            Log::info("No active sessions found in DB for {$username}.");
            return ['status' => false, 'message' => "⚠️ No active session found."];
        }

        $responses = [];
        foreach ($sessions as $session) {
            $router = \App\Models\Site::where('ip_address', $session->nasipaddress)->first();

            if (!$router) {
                Log::error("Router IP {$session->nasipaddress} not found in Sites table.");
                $responses[] = ['status' => false, 'message' => "❌ Router {$session->nasipaddress} not in DB."];
                continue;
            }

            // 1. Prepare CoA Request (Fixed the typo here: escapeshellarg)
            $coaRequest = "User-Name=$username,Acct-Session-Id={$session->acctsessionid}";
            $command = sprintf(
                'echo %s | radclient -x %s:%d disconnect %s 2>&1',
                escapeshellarg($coaRequest),
                escapeshellarg($router->ip_address),
                (int)$router->radius_coa_port,
                escapeshellarg($router->radius_secret)
            );

            $output = shell_exec($command);
            Log::info("CoA Output for {$username}: " . str_replace("\n", " ", $output));
            
            // 2. Parse Result
            if (strpos($output, 'Disconnect-ACK') !== false) {
                $this->forceCloseSession($session, 'Admin-Disconnect');
                $responses[] = ['status' => true, 'message' => "✅ Success."];
            } 
            elseif (strpos($output, 'Disconnect-NAK') !== false) {
                // This is your Ghost Session case
                $affected = $this->forceCloseSession($session, 'Ghost-NAK-Cleanup');
                Log::warning("Ghost cleared for {$username}. Rows updated: {$affected}");
                $responses[] = ['status' => true, 'message' => "👻 Ghost cleared."];
            } 
            else {
                // Timeout or No Reply
                if ($router->is_online == false) {
                    $this->forceCloseSession($session, 'Router-Offline-Cleanup');
                    $responses[] = ['status' => true, 'message' => "⚡ Router offline, closed locally."];
                } else {
                    $responses[] = ['status' => false, 'message' => "🚫 Timeout/Network Error."];
                }
            }
        }

        return ['status' => !collect($responses)->contains('status', false), 'details' => $responses];
    }

    private function forceCloseSession($session, $cause) {
        // We try to use radacctid first, fall back to acctsessionid if id is missing
        $query = DB::connection('radius')->table('radacct');

        if (isset($session->radacctid)) {
            $query->where('radacctid', $session->radacctid);
        } else {
            $query->where('acctsessionid', $session->acctsessionid);
        }

        $affected = $query->whereNull('acctstoptime')->update([
            'acctstoptime' => now(),
            'acctterminatecause' => $cause,
            'acctsessiontime' => DB::raw('UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(acctstarttime)')
        ]);

        return $affected;
    }

    public function removeCustomerFromRadius($username)
    {
        try {
            $this->radiusConnection->table('radcheck')->where('username', $username)->delete();
            $this->radiusConnection->table('radreply')->where('username', $username)->delete();
            $this->radiusConnection->table('radusergroup')->where('username', $username)->delete();
            $this->radiusConnection->table('radpostauth')->where('username', $username)->delete();
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    public function flushMacOnly($username) {
        return $this->radiusConnection->table('radcheck')
            ->where('username', $username)
            ->where('attribute', 'Calling-Station-Id')
            ->delete();
    }

    public function getTechnicalSpecs($id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            throw new Exception("Customer not found");
        }

        $username = $customer->radius_username;

        // Fetch technical specs from RADIUS DB
        // 1. Check if user exists in radcheck
        $userCheck = DB::connection('radius')->table('radcheck')
            ->where('username', $username)
            ->first();  
        if (!$userCheck) {
            throw new Exception("User not found in RADIUS");
        }

        // 1. Get current active session (if any)
        $activeSession = DB::connection('radius')->table('radacct')
            ->where('username', $username)
            ->whereNull('acctstoptime') // Still connected
            ->orderBy('acctstarttime', 'desc')
            ->first();

        $lastSession = DB::connection('radius')->table('radacct')
            ->where('username', $username)
            ->whereNotNull('acctstoptime') // Disconnected sessions
            ->orderBy('acctstoptime', 'desc')
            ->first();

        $sessions = DB::connection('radius')->table('radacct')
            ->where('username', $username)
            ->orderBy('acctstarttime', 'desc')
            ->take(5) // Limit the result to 5 rows
            ->get();

        $logs = DB::connection('radius')->table('radpostauth')
            ->where('username', $username)
            // Add 'id' here --------------------v
            ->select('id', 'reply', 'authdate', 'reason', 'pass') 
            ->orderBy('id', 'desc')
            ->paginate(3)
            ->through(function ($log) use ($customer) {
                return [
                    'id' => $log->id, // Now this will work!
                    'time' => Carbon::parse($log->authdate)->diffForHumans(),
                    'exact_time' => $log->authdate,
                    'reply' => $log->reply,
                    'password_attempted' => '********',
                    'status_label' => $this->translateRadiusReason($log->reason, $log->reply, $customer),
                    'is_success' => $log->reply === 'Access-Accept'
                ];
            });

        return [
            'is_online' => !is_null($activeSession),
            'uptime' => $activeSession ? $this->formatUptime($activeSession->acctsessiontime) : 'Offline',
            'last_uptime' => $lastSession ? $this->formatUptime($lastSession->acctsessiontime) : 'N/A',
            'start_time' => $activeSession 
                ? Carbon::parse($activeSession->acctstarttime)->toIso8601String() 
                : ($lastSession ? Carbon::parse($lastSession->acctstoptime)->toIso8601String() : null),
            'framed_ip' => $activeSession->framedipaddress ?? $lastSession->framedipaddress ?? 'N/A',
            'calling_station_id' => $activeSession->callingstationid ?? $lastSession->callingstationid ?? 'N/A',
            'device_vendor' => $this->getDeviceManufacturer($activeSession->callingstationid ?? $lastSession->callingstationid),
            'logs' => $logs,
            'sessions' => $sessions,
        ];
    }

    public function syncPackageToRadius($package)
    {
        // Consistency: Group Name is always 'package_' + ID
        $groupName = "package_" . $package->id;

        // 1. Format the Mikrotik Rate Limit string
        // Standard format: speed_up/speed_down
        $rateLimit = "{$package->speed_up}/{$package->speed_down}";

        // Add Bursting if available
        if ($package->burst_limit_up && $package->burst_limit_down) {
            $rateLimit .= " {$package->burst_limit_up}/{$package->burst_limit_down}";
            $rateLimit .= " {$package->burst_threshold_up}/{$package->burst_threshold_down}";
            $rateLimit .= " {$package->burst_time}/{$package->burst_time}";
        }

        try {
            // 2. Clear old group attributes
            DB::connection('radius')->table('radgroupreply')
                ->where('groupname', $groupName)
                ->where('attribute', 'Mikrotik-Rate-Limit')
                ->delete();

            // 3. Insert new rate limit
            DB::connection('radius')->table('radgroupreply')->insert([
                'groupname' => $groupName,
                'attribute' => 'Mikrotik-Rate-Limit',
                'op' => ':=',
                'value' => $rateLimit
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error("Package Sync Failed: " . $e->getMessage());
            return false;
        }
    }

    private function formatUptime($seconds) {
        if (!$seconds) return '0s';
        $h = floor($seconds / 3600);
        $m = floor(($seconds % 3600) / 60);
        return "{$h}h {$m}m";
    }

    public function getDeviceManufacturer($mac)
    {
        if (!$mac || $mac === 'N/A') return 'Unknown';

        // Create a unique cache key based on the first 6 chars (OUI)
        $oui = strtoupper(str_replace([':', '-'], '', substr($mac, 0, 8)));
        $cacheKey = "mac_vendor_{$oui}";

        return Cache::remember($cacheKey, now()->addMonths(3), function () use ($mac) {
            try {
                // We use the 3-byte prefix (OUI) for the lookup
                $response = Http::get("https://api.macvendors.com/" . urlencode($mac));

                if ($response->successful()) {
                    return $response->body();
                }

                // If rate limited (429), don't cache "Unknown", just return it for now
                if ($response->status() === 429) {
                    return 'Rate Limited (Retrying later)';
                }

            } catch (\Exception $e) {
                Log::error("MAC Vendor API Error: " . $e->getMessage());
            }

            return 'Generic Device';
        });
    }

    /**
     * Add User-Password to radcheck
     */
    private function addUserPassword($username, $password)
    {
        $this->radiusConnection->table('radcheck')->insert([
            'username' => $username,
            'attribute' => 'User-Password',
            'op' => ':=',
            'value' => $password,
        ]);
    }

    /**
     * Add check attribute to radcheck
     */
    private function addCheckAttribute($username, $attribute, $op, $value)
    {
        $this->radiusConnection->table('radcheck')->insert([
            'username' => $username,
            'attribute' => $attribute,
            'op' => $op,
            'value' => $value,
        ]);
    }

    /**
     * Add reply attribute to radreply
     */
    private function addReplyAttribute($username, $attribute, $op, $value)
    {
        $this->radiusConnection->table('radreply')->insert([
            'username' => $username,
            'attribute' => $attribute,
            'op' => $op,
            'value' => $value,
        ]);
    }

    /**
     * Add user to group
     */
    private function addUserToGroup($username, $groupname, $priority = 1)
    {
        Log::info("Adding user {$username} to group {$groupname} with priority {$priority}");
        $this->radiusConnection->table('radusergroup')->insert([
            'username' => $username,
            'groupname' => $groupname,
            'priority' => $priority,
        ]);
    }

    /**
     * Generate RADIUS username using organization acronym and customer ID
     */
    public static function generateRadiusUsername($customerId, $organizationAcronym = null)
    {
        // Base username is just the customer ID
        $username = strval($customerId);
        
        // Add organization acronym prefix if available
        if ($organizationAcronym && trim($organizationAcronym) !== '') {
            // Clean and lowercase the acronym
            $prefix = strtolower(trim($organizationAcronym));
            $prefix = preg_replace('/[^a-z0-9]/', '', $prefix);
            
            // Only add prefix if it's not empty after cleaning
            if ($prefix !== '') {
                $username = $prefix . '_' . $username;
            }
        }
        
        return $username;
    }

    /**
     * Generate RADIUS password
     */
    public static function generateRadiusPassword($length = 12)
    {
        $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        $password = '';
        
        for ($i = 0; $i < $length; $i++) {
            $password .= $characters[random_int(0, strlen($characters) - 1)];
        }
        
        return $password;
    }
}
