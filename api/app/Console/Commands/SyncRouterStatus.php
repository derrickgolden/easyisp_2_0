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

            if ($wasOnline && !$shouldBeOnline && $site->notify_on_down) {
                $this->notifySiteStatus($site, false);
            } elseif (!$wasOnline && $shouldBeOnline && $site->notify_on_down) {
                $this->notifySiteStatus($site, true);
            }

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

    private function notifySiteStatus(Site $site, bool $isOnline): void
    {
        try {
            $organization = $site->organization;
            if (!$organization) {
                return;
            }

            $users = $organization->users()
                ->where('is_super_admin', true)
                ->whereNotNull('phone')
                ->where('phone', '!=', '')
                ->get();
            if ($users->isEmpty()) {
                return;
            }

            // Get SMS configuration if available
            $smsConfig = $this->getSmsConfiguration($organization);

            foreach ($users as $user) {
                try {
                    if ($smsConfig) {
                        $this->sendSiteStatusSms($user, $site, $smsConfig, $organization, $isOnline);
                    }
                } catch (\Throwable $e) {
                    Log::warning("Failed to notify user {$user->id} about site status: {$e->getMessage()}", [
                        'site_id' => $site->id,
                        'user_id' => $user->id,
                    ]);
                }
            }

            Log::info("Site status notifications sent for {$site->name}", [
                'site_id' => $site->id,
                'status' => $isOnline ? 'online' : 'offline',
                'recipients' => $users->count(),
                'sms_enabled' => $smsConfig !== null,
            ]);
        } catch (\Throwable $e) {
            Log::error("Failed to send site status notifications for {$site->name}", [
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

        if (
            !is_array($smsSettings)
            || empty($smsSettings['provider'])
            || empty($smsSettings['api_key'])
        ) {
            return null;
        }

        return $smsSettings;
    }

    private function sendSiteStatusSms($user, $site, $smsConfig, $organization, bool $isOnline): void
    {
        try {
            $message = $isOnline
                ? "✅ RECOVERY: Site '{$site->name}' ({$site->ip_address}) is back ONLINE."
                : "⚠️ ALERT: Site '{$site->name}' ({$site->ip_address}) is OFFLINE. "
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
                    'type' => $isOnline ? 'site-recovery-alert' : 'site-down-alert',
                ]
            );

            Log::info("Site status SMS sent to {$user->phone}", [
                'site_id' => $site->id,
                'user_id' => $user->id,
                'status' => $isOnline ? 'online' : 'offline',
            ]);
        } catch (\Throwable $e) {
            Log::warning("Failed to send site status SMS to {$user->phone}", [
                'site_id' => $site->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}