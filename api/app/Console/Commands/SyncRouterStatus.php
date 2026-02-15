<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Site;
use Illuminate\Support\Facades\Process;

class SyncRouterStatus extends Command
{
    protected $signature = 'router:sync-status';
    protected $description = 'Ping routers and update their online status in the sites table';

    public function handle()
    {
        $sites = Site::all();

        foreach ($sites as $site) {
            // Ping: -c 1 (1 packet), -W 2 (2 second timeout)
            $result = Process::run("ping -c 1 -W 2 " . escapeshellarg($site->ip_address));

            $isOnline = $result->successful();

            $site->update([
                'is_online' => $isOnline,
                'last_seen' => $isOnline ? now() : $site->last_seen,
            ]);

            $statusText = $isOnline ? 'ONLINE' : 'OFFLINE';
            $this->info("Site: {$site->name} | IP: {$site->ip_address} | Status: {$statusText}");
        }
    }
}