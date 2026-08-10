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
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    // app/Console/Commands/AutoBindMacAddress.php

    public function handle()
    {
        // 1. Get the latest callingstationid for each user session.
        $sessions = DB::connection('radius')
            ->table('radacct as a')
            ->select('a.username', 'a.callingstationid', 'a.nasipaddress')
            // Only look at the latest session for each user
            ->whereIn('a.radacctid', function ($query) {
                $query->select(DB::raw('MAX(radacctid)'))
                    ->from('radacct')
                    ->groupBy('username');
            })
            ->whereNotNull('a.callingstationid')
            ->where('a.callingstationid', '!=', '')
            ->get();

        if ($sessions->isEmpty()) {
            $this->info("No new users to bind.");
            return;
        }

        foreach ($sessions as $session) {
            if (empty($session->callingstationid)) {
                $this->info("Skipping auto-bind for {$session->username}; session has empty MAC.");
                continue;
            }

            $organizationId = DB::table('sites')
                ->where('ip_address', $session->nasipaddress)
                ->value('organization_id');

            if (empty($organizationId)) {
                $this->info("Skipping auto-bind for {$session->username}; no matching site organization found.");
                continue;
            }

            $organizationClientType = DB::table('organizations')
                ->where('id', $organizationId)
                ->value('client_type') ?? 'Both';

            $targetClientType = null;

            if ($organizationClientType === 'PPPoE') {
                $isPppoeUser = DB::table('customers')
                    ->where('radius_username', $session->username)
                    ->where('organization_id', $organizationId)
                    ->exists();

                if (!$isPppoeUser) {
                    $this->info("Skipping auto-bind for {$session->username}; not found in PPPoE customers for org {$organizationId}.");
                    continue;
                }

                $targetClientType = 'pppoe';
            } elseif ($organizationClientType === 'Hotspot') {
                $isHotspotUser = DB::table('hotspot_customers')
                    ->where('radius_username', $session->username)
                    ->where('organization_id', $organizationId)
                    ->exists();

                if (!$isHotspotUser) {
                    $this->info("Skipping auto-bind for {$session->username}; not found in hotspot customers for org {$organizationId}.");
                    continue;
                }

                $targetClientType = 'hotspot';
            } elseif ($organizationClientType === 'Both') {
                $checkClientType = DB::connection('radius')->table('radcheck')
                    ->where('username', $session->username)
                    ->where('attribute', 'Cleartext-Password')
                    ->whereIn('client_type', ['pppoe', 'hotspot'])
                    ->value('client_type');

                if (!empty($checkClientType)) {
                    $targetClientType = $checkClientType;
                } else {
                    $isPppoeUser = DB::table('customers')
                        ->where('radius_username', $session->username)
                        ->where('organization_id', $organizationId)
                        ->exists();

                    $isHotspotUser = DB::table('hotspot_customers')
                        ->where('radius_username', $session->username)
                        ->where('organization_id', $organizationId)
                        ->exists();

                    if ($isPppoeUser && !$isHotspotUser) {
                        $targetClientType = 'pppoe';
                    } elseif ($isHotspotUser && !$isPppoeUser) {
                        $targetClientType = 'hotspot';
                    } else {
                        $this->info("Skipping auto-bind for {$session->username}; unable to resolve client type in org {$organizationId}.");
                        continue;
                    }
                }
            } else {
                // DHCP mode is currently unsupported for MAC auto-bind in radcheck.
                $this->info("Skipping auto-bind for {$session->username}; org {$organizationId} client_type {$organizationClientType} is unsupported.");
                continue;
            }

            // Double check to prevent race conditions during loop
            $exists = DB::connection('radius')->table('radcheck')
                ->where('username', $session->username)
                ->where('attribute', 'Calling-Station-Id')
                ->where('client_type', $targetClientType)
                ->exists();

            if (!$exists) {
                // Only bind MAC if there is still an auth row for the same user and client type.
                $hasAuthRecord = DB::connection('radius')->table('radcheck')
                    ->where('username', $session->username)
                    ->where('organization_id', $organizationId)
                    ->where('client_type', $targetClientType)
                    ->where('attribute', 'Cleartext-Password')
                    ->exists();

                if (!$hasAuthRecord) {
                    $this->info("Skipping auto-bind for {$session->username}; missing Cleartext-Password row for {$targetClientType}.");
                    continue;
                }

                DB::connection('radius')->table('radcheck')->insert([
                    'username' => $session->username,
                    'attribute' => 'Calling-Station-Id',
                    'op' => '==',
                    'value' => $session->callingstationid,
                    'organization_id' => $organizationId,
                    'client_type' => $targetClientType,
                ]);

                $this->info("Successfully locked {$session->username} ({$targetClientType}) to MAC: {$session->callingstationid}");
            }
        }
    }
}
