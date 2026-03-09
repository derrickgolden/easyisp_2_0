<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\MikrotikService;

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
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        //
        $client = resolve(MikrotikService::class);

        $queues = $client->query('/queue/simple/print')->read();

        foreach ($queues as $queue) {

            $username = $queue['name'];

            $rates = explode('/', $queue['rate'] ?? '0/0');

            $rx = ($rates[0] ?? 0) / 1000000;
            $tx = ($rates[1] ?? 0) / 1000000;

            broadcast(new CustomerTrafficUpdated($username,$rx,$tx));
        }
    }
}
