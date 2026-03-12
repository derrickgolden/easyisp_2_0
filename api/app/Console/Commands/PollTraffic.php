<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\MikrotikService;
use App\Events\CustomerTrafficUpdated;
use Illuminate\Support\Facades\Log;

class PollTraffic extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:poll-traffic';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Polls Mikrotik router for traffic data and broadcasts updates';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        //
        $mikrotik = resolve(MikrotikService::class);
        $users = $mikrotik->getUsersTraffic();

        foreach ($users as $user) {

            $rxMbps = $user['rx'] / 1000000;
            $txMbps = $user['tx'] / 1000000;

            broadcast(new CustomerTrafficUpdated(
                $user['name'],
                $rxMbps,
                $txMbps
            ));
        }
    }
}
