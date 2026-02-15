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
            ->select('a.username', 'a.callingstationid')
            // Only look at the latest session for each user
            ->whereIn('a.radacctid', function($query) {
                $query->select(DB::raw('MAX(radacctid)'))
                    ->from('radacct')
                    ->groupBy('username');
            })
            // Join to check if they ALREADY have a MAC lock
            ->leftJoin('radcheck as c', function($join) {
                $join->on('a.username', '=', 'c.username')
                    ->where('c.attribute', '=', 'Calling-Station-Id');
            })
            ->whereNull('c.id') // Ensure no lock exists yet
            ->whereNotNull('a.callingstationid')
            ->where('a.callingstationid', '!=', '')
            ->get();

        if ($sessions->isEmpty()) {
            $this->info("No new users to bind.");
            return;
        }

        foreach ($sessions as $session) {
            // Double check to prevent race conditions during loop
            $exists = DB::connection('radius')->table('radcheck')
                ->where('username', $session->username)
                ->where('attribute', 'Calling-Station-Id')
                ->exists();

            if (!$exists) {
                DB::connection('radius')->table('radcheck')->insert([
                    'username'  => $session->username,
                    'attribute' => 'Calling-Station-Id',
                    'op'        => '==',
                    'value'     => $session->callingstationid,
                ]);

                $this->info("Successfully locked {$session->username} to MAC: {$session->callingstationid}");
            }
        }
    }
}
