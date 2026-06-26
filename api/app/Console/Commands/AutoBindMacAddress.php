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
        // 1. Get the latest callingstationid for users who don't have a 'Calling-Station-Id' attribute in radcheck
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
            $organizationId = DB::table('sites')
                ->where('ip_address', $session->nasipaddress)
                ->value('organization_id');

            if (empty($organizationId)) {
                $this->info("Skipping auto-bind for {$session->username}; no matching site organization found.");
                continue;
            }

            // Double check to prevent race conditions during loop
            $exists = DB::connection('radius')->table('radcheck')
                ->where('username', $session->username)
                ->where('attribute', 'Calling-Station-Id')
                ->exists();

            if (!$exists) {
                // Only auto-bind if the username still exists in local customers for this organization.
                $customer = DB::table('customers')
                    ->where('radius_username', $session->username)
                    ->where('organization_id', $organizationId)
                    ->first();

                if (!$customer) {
                    $this->info("Skipping auto-bind for deleted or unknown user {$session->username} in org {$organizationId}");
                    continue;
                }

                DB::connection('radius')->table('radcheck')->insert([
                    'username' => $session->username,
                    'attribute' => 'Calling-Station-Id',
                    'op' => '==',
                    'value' => $session->callingstationid,
                    'organization_id' => $organizationId,
                    'client_type' => 'pppoe',
                ]);

                $this->info("Successfully locked {$session->username} to MAC: {$session->callingstationid}");
            }
        }
    }
}
