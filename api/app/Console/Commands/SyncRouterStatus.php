<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Site;
use Illuminate\Support\Facades\Process;
use RouterOS\Client;

class SyncRouterStatus extends Command
{
    protected $signature = 'router:sync-status';
    protected $description = 'Ping routers and update their online status in the sites table';

    private const PING_ATTEMPTS = 3;
    private const PING_TIMEOUT_SECONDS = 2;
    private const OFFLINE_GRACE_MINUTES = 2;
    private const MIKROTIK_CONNECT_TIMEOUT_SECONDS = 3;

    public function handle()
    {
        $sites = Site::all();

        foreach ($sites as $site) {
            [$isReachable, $probeMethod] = $this->probeReachability($site);
            $shouldBeOnline = $this->resolveStableOnlineState($site, $isReachable);

            $site->update([
                'is_online' => $shouldBeOnline,
                'last_seen' => $isReachable ? now() : $site->last_seen,
            ]);

            $statusText = $shouldBeOnline ? 'ONLINE' : 'OFFLINE';
            $reachabilityText = $isReachable ? 'reachable' : 'not-reachable';
            $this->info("Site: {$site->name} | IP: {$site->ip_address} | Probe: {$probeMethod} ({$reachabilityText}) | Status: {$statusText}");
        }
    }

    private function probeReachability(Site $site): array
    {
        if ($this->isSiteReachable($site->ip_address)) {
            return [true, 'ping'];
        }

        if ($this->isMikrotikFallbackConfigured($site) && $this->canConnectToMikrotik($site)) {
            return [true, 'mikrotik-api'];
        }

        return [false, 'ping'];
    }

    private function isSiteReachable(string $ipAddress): bool
    {
        for ($attempt = 1; $attempt <= self::PING_ATTEMPTS; $attempt++) {
            $result = Process::run(
                sprintf(
                    'ping -c 1 -W %d %s',
                    self::PING_TIMEOUT_SECONDS,
                    escapeshellarg($ipAddress)
                )
            );

            if ($result->successful()) {
                return true;
            }
        }

        return false;
    }

    private function isMikrotikFallbackConfigured(Site $site): bool
    {
        return !empty($site->ip_address)
            && !empty($site->mikrotik_username)
            && !empty($site->mikrotik_password)
            && !empty($site->mikrotik_port);
    }

    private function canConnectToMikrotik(Site $site): bool
    {
        try {
            $client = new Client([
                'host' => $site->ip_address,
                'user' => $site->mikrotik_username,
                'pass' => $site->mikrotik_password,
                'port' => (int) $site->mikrotik_port,
                'timeout' => self::MIKROTIK_CONNECT_TIMEOUT_SECONDS,
            ]);

            return $client !== null;
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function resolveStableOnlineState(Site $site, bool $isReachable): bool
    {
        if ($isReachable) {
            return true;
        }

        if (!$site->is_online) {
            return false;
        }

        if (!$site->last_seen) {
            return false;
        }

        return now()->diffInMinutes($site->last_seen) < self::OFFLINE_GRACE_MINUTES;
    }
}