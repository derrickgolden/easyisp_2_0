<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AutoBindMacAddress extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'radius:auto-bind';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automatically bind MAC addresses (Calling-Station-Id) for PPPoE customers.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // 1. Fetch PPPoE customers mapping from application DB (easyisp_2_0)
        $pppoeCustomers = DB::table('customers')
            ->whereNotNull('radius_username')
            ->where('radius_username', '!=', '')
            ->pluck('organization_id', 'radius_username')
            ->toArray();

        if (empty($pppoeCustomers)) {
            $this->info("No PPPoE customers found.");
            return;
        }

        $pppoeUsernames = array_keys($pppoeCustomers);

        // 2. Fetch site organization map from application DB
        $siteOrgMap = DB::table('sites')
            ->whereNotNull('ip_address')
            ->pluck('organization_id', 'ip_address')
            ->toArray();

        // 3. Query RADIUS database purely internally for candidate PPPoE sessions
        $sessions = DB::connection('radius')
            ->table('radacct')
            ->select('username', 'callingstationid', 'nasipaddress')
            ->whereIn('username', $pppoeUsernames)
            ->whereNull('acctstoptime')
            ->whereNotNull('callingstationid')
            ->where('callingstationid', '!=', '')
            ->orderBy('radacctid', 'desc')
            ->get()
            ->unique('username');

        if ($sessions->isEmpty()) {
            $this->info("No active PPPoE sessions to evaluate.");
            return;
        }

        // 4. Pre-fetch existing radcheck rules to avoid queries inside the loop
        $boundUsers = DB::connection('radius')
            ->table('radcheck')
            ->whereIn('username', $sessions->pluck('username'))
            ->where('attribute', 'Calling-Station-Id')
            ->where('client_type', 'pppoe')
            ->pluck('username')
            ->flip()
            ->toArray();

        $authenticatedUsers = DB::connection('radius')
            ->table('radcheck')
            ->whereIn('username', $sessions->pluck('username'))
            ->where('attribute', 'Cleartext-Password')
            ->where('client_type', 'pppoe')
            ->pluck('username')
            ->flip()
            ->toArray();

        $recordsToInsert = [];

        // 5. Process in-memory
        foreach ($sessions as $session) {
            $username = $session->username;

            // Skip if user already has a bound MAC
            if (isset($boundUsers[$username])) {
                continue;
            }

            // Skip if user lacks a valid PPPoE Cleartext-Password row in radcheck
            if (!isset($authenticatedUsers[$username])) {
                $this->info("Skipping {$username}; missing Cleartext-Password row for pppoe.");
                continue;
            }

            // Resolve organization ID (Site NAS IP first, fallback to customer table)
            $organizationId = $siteOrgMap[$session->nasipaddress] ?? $pppoeCustomers[$username] ?? null;

            if (empty($organizationId)) {
                $this->info("Skipping {$username}; unable to resolve organization.");
                continue;
            }

            $recordsToInsert[] = [
                'username'        => $username,
                'attribute'       => 'Calling-Station-Id',
                'op'              => '==',
                'value'           => $session->callingstationid,
                'organization_id' => $organizationId,
                'client_type'     => 'pppoe',
            ];

            $this->info("Successfully locked PPPoE user {$username} to MAC: {$session->callingstationid}");
        }

        // 6. Batch insert missing MAC bindings
        if (!empty($recordsToInsert)) {
            DB::connection('radius')->table('radcheck')->insert($recordsToInsert);
            $this->info("Bulk bound " . count($recordsToInsert) . " PPPoE MAC address(es).");
        } else {
            $this->info("No new PPPoE MAC addresses needed binding.");
        }
    }
}