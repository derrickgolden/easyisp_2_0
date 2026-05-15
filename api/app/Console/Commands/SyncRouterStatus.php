<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Site;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;
use App\Services\SmsProviderService;
use RouterOS\Client;

class SyncRouterStatus extends Command
{
    protected $signature = 'router:sync-status';
    protected $description = 'Ping routers and update their online status in the sites table';

    private const PING_ATTEMPTS = 3;
    private const PING_TIMEOUT_SECONDS = 2;
    private const OFFLINE_GRACE_MINUTES = 3;
    private const MIKROTIK_CONNECT_TIMEOUT_SECONDS = 3;

    public function handle()
    {
        $sites = Site::all();

        foreach ($sites as $site) {
            $wasOnline = $site->is_online;

            [$isReachable, $probeMethod] = $this->probeReachability($site);
            $shouldBeOnline = $this->resolveStableOnlineState($site, $isReachable);

            $site->update([
                'is_online' => $shouldBeOnline,
                'last_seen' => $isReachable ? now() : $site->last_seen,
            ]);

            $statusText = $shouldBeOnline ? 'ONLINE' : 'OFFLINE';
            $reachabilityText = $isReachable ? 'reachable' : 'not-reachable';
            $this->info("Site: {$site->name} | IP: {$site->ip_address} | Probe: {$probeMethod} ({$reachabilityText}) | Status: {$statusText}");

            // Notify if site transitioned from online to offline
            // if ($wasOnline && !$shouldBeOnline && $site->notify_on_down) {
            //     $this->notifySiteDown($site);
            // }
        }
    }

    private function probeReachability(Site $site): array
    {
        if ($this->isSiteReachable($site->ip_address)) {
            return [true, 'ping'];
        }

        // if ($this->isMikrotikFallbackConfigured($site) && $this->canConnectToMikrotik($site)) {
        //     return [true, 'mikrotik-api'];
        // }

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

    private function notifySiteDown(Site $site): void
    {
        try {
            $organization = $site->organization;
            if (!$organization) {
                return;
            }

            $users = $organization->users()->get();
            if ($users->isEmpty()) {
                return;
            }

            // Get SMS configuration if available
            $smsConfig = $this->getSmsConfiguration($organization);

            foreach ($users as $user) {
                try {
                    // Send SMS if provider is configured and user has phone
                    if ($smsConfig && $user->phone) {
                        $this->sendSiteDownSms($user, $site, $smsConfig, $organization);
                    }
                } catch (\Throwable $e) {
                    Log::warning("Failed to notify user {$user->id} about site down: {$e->getMessage()}", [
                        'site_id' => $site->id,
                        'user_id' => $user->id,
                    ]);
                }
            }

            Log::info("Site down notifications sent for {$site->name}", [
                'site_id' => $site->id,
                'recipients' => $users->count(),
                'sms_enabled' => $smsConfig !== null,
            ]);
        } catch (\Throwable $e) {
            Log::error("Failed to send site-down notifications for {$site->name}", [
                'site_id' => $site->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function getSmsConfiguration($organization): ?array
    {
        if (!$organization || !$organization->settings) {
            return null;
        }

        $smsSettings = $organization->settings['sms-gateway'] ?? null;

        if (!$smsSettings || !$smsSettings['provider'] || !$smsSettings['api_key']) {
            return null;
        }

        return $smsSettings;
    }

    private function sendSiteDownSms($user, $site, $smsConfig, $organization): void
    {
        try {
            $message = "⚠️ ALERT: Site '{$site->name}' ({$site->ip_address}) is OFFLINE. "
                . "Location: {$site->location}. Last seen: {$site->last_seen}";

            $smsService = new SmsProviderService();
            $smsService->send(
                $user->phone,
                $message,
                $smsConfig['provider'],
                $smsConfig['api_key'],
                $smsConfig['sender_id'] ?? 'EASYTECH',
                $smsConfig['api_username'] ?? null,
                [
                    'organization_id' => $organization->id,
                    'type' => 'site-down-alert',
                ]
            );

            Log::info("Site down SMS sent to {$user->phone}", [
                'site_id' => $site->id,
                'user_id' => $user->id,
            ]);
        } catch (\Throwable $e) {
            Log::warning("Failed to send site-down SMS to {$user->phone}", [
                'site_id' => $site->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}