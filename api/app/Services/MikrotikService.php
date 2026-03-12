<?php

namespace App\Services;

use App\Models\Site;
use RouterOS\Client;
use RouterOS\Query;
use RuntimeException;
use Illuminate\Support\Facades\Log;

class MikrotikService
{
    private function buildClient(array $config): Client
    {
        return new Client($config);
    }

    private function mapSiteConfig(Site $site): array
    {
        Log::debug("Mapping MikroTik config for site {$site->id}", [
                    'host' => $site->ip_address,
                    'user' => $site->mikrotik_username,
                    'port' => $site->mikrotik_port,
                ]);
        if (!$site->ip_address || !$site->mikrotik_username || !$site->mikrotik_password || !$site->mikrotik_port) {
            throw new RuntimeException("Site {$site->id} is missing MikroTik connection settings");
        }
        return [
            'host' => $site->ip_address,
            'user' => $site->mikrotik_username,
            'pass' => $site->mikrotik_password,
            'port' => (int) $site->mikrotik_port,
        ];
    }

    private function resolveConfigForNasIp(string $nasIpAddress): ?array
    {
        $siteByNas = Site::query()->where('ip_address', $nasIpAddress)->first();
        if (!$siteByNas) {
            return null;
        }

        return $this->mapSiteConfig($siteByNas);
    }

    private function noConfigPayload(string $username): array
    {
        return [
            'username' => $username,
            'ip' => null,
            'rx' => 0,
            'tx' => 0,
            'rx_bytes' => 0,
            'tx_bytes' => 0,
            'status' => 'No Config Found',
        ];
    }

    private function getConfiguredSites()
    {
        $sites = Site::query()
            ->whereNotNull('ip_address')
            ->whereNotNull('mikrotik_username')
            ->whereNotNull('mikrotik_password')
            ->whereNotNull('mikrotik_port')
            ->get();

        if ($sites->isEmpty()) {
            throw new RuntimeException('No sites with MikroTik credentials configured in database');
        }

        return $sites;
    }

    public function getOnlineUsers()
    {
        $users = [];

        foreach ($this->getConfiguredSites() as $site) {
            $client = $this->buildClient($this->mapSiteConfig($site));
            $query = new Query('/ppp/active/print');

            $siteUsers = $client->query($query)->read();
            $users = array_merge($users, $siteUsers);
        }

        return $users;
    }

    public function getUsersTraffic()
    {
        $users = [];

        foreach ($this->getConfiguredSites() as $site) {
            $client = $this->buildClient($this->mapSiteConfig($site));
            $query = new Query('/ppp/active/print');
            $results = $client->query($query)->read();

            foreach ($results as $user) {
                [$rateRx, $rateTx] = $this->extractPair(
                    $user['rate']
                        ?? $user['rate-bps']
                        ?? $user['rate-bits-per-second']
                        ?? null
                );

                [$bytesRx, $bytesTx] = $this->extractPair(
                    $user['bytes']
                        ?? $user['byte']
                        ?? null
                );

                $rxBytes = (int) ($user['bytes-in'] ?? $user['rx-byte'] ?? $bytesRx ?? 0);
                $txBytes = (int) ($user['bytes-out'] ?? $user['tx-byte'] ?? $bytesTx ?? 0);

                $rx = (int) ($user['rx-bits-per-second'] ?? $rateRx ?? 0);
                $tx = (int) ($user['tx-bits-per-second'] ?? $rateTx ?? 0);

                // Some RouterOS responses omit current rate; fallback to byte counters so value is not always 0.
                if ($rx === 0 && $tx === 0 && ($rxBytes > 0 || $txBytes > 0)) {
                    $rx = $rxBytes;
                    $tx = $txBytes;
                }

                $users[] = [
                    'name' => $user['name'],
                    'ip'   => $user['address'] ?? null,
                    'rx'   => (int) $rx,
                    'tx'   => (int) $tx,
                    'rx_bytes' => $rxBytes,
                    'tx_bytes' => $txBytes,
                ];
            }
        }

        return $users;
    }

    public function getUserTraffic(string $username, ?string $nasIpAddress = null): array
    {
        if (!$nasIpAddress || $nasIpAddress === 'N/A') {
            return $this->noConfigPayload($username);
        }

        $config = $this->resolveConfigForNasIp($nasIpAddress);
        if (!$config) {
            return $this->noConfigPayload($username);
        }

        $client = $this->buildClient($config);

        $active = $client->query(
            (new Query('/ppp/active/print'))
                ->equal('.proplist', 'name,address')
        )->read();

        $session = null;
        foreach ($active as $row) {
            if (($row['name'] ?? null) === $username) {
                $session = $row;
                break;
            }
        }

        if (!$session) {
            return [
                'username' => $username,
                'ip' => null,
                'rx' => 0,
                'tx' => 0,
                'rx_bytes' => 0,
                'tx_bytes' => 0,
                'status' => 'offline',
            ];
        }

        $interfaceName = "<pppoe-{$username}>";
        $interfaces = $client->query(
            (new Query('/interface/print'))
                ->equal('.proplist', 'name,type,rx-byte,tx-byte,running,dynamic')
        )->read();

        $iface = null;
        foreach ($interfaces as $row) {
            if (($row['name'] ?? null) === $interfaceName) {
                $iface = $row;
                break;
            }
        }

        $rxBytes = (int) ($iface['rx-byte'] ?? 0);
        $txBytes = (int) ($iface['tx-byte'] ?? 0);

        $monitor = $client->query(
            (new Query('/interface/monitor-traffic'))
                ->equal('interface', $interfaceName)
                ->equal('once', '')
        )->read();

        $monitorRow = is_array($monitor) && isset($monitor[0]) ? $monitor[0] : [];
        $rxBps = (int) ($monitorRow['rx-bits-per-second'] ?? 0);
        $txBps = (int) ($monitorRow['tx-bits-per-second'] ?? 0);

        // If instantaneous rate is currently 0, expose cumulative byte counters in rx/tx as fallback.
        $rx = $rxBps > 0 ? $rxBps : $rxBytes;
        $tx = $txBps > 0 ? $txBps : $txBytes;

        return [
            'username' => $username,
            'ip' => $session['address'] ?? null,
            'rx' => $rx,
            'tx' => $tx,
            'rx_bps' => $rxBps,
            'tx_bps' => $txBps,
            'rx_bytes' => $rxBytes,
            'tx_bytes' => $txBytes,
            'status' => 'online',
        ];
    }

    private function extractPair($value): array
    {
        if (!is_string($value) || strpos($value, '/') === false) {
            return [0, 0];
        }

        [$left, $right] = explode('/', $value, 2);

        return [(int) $left, (int) $right];
    }
}