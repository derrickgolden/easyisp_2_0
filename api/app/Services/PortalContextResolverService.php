<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\HotspotCustomer;
use App\Models\Organization;
use App\Models\Site;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class PortalContextResolverService
{
    public function resolve(array $input): array
    {
        $clientIp = trim((string) ($input['client_ip'] ?? ''));
        $nasIp = trim((string) ($input['nas_ip'] ?? ''));
        $siteInput = trim((string) ($input['site_id'] ?? ''));
        $identity = trim((string) ($input['identity'] ?? ''));
        $mac = $this->normalizeMacAddress((string) ($input['mac'] ?? ''));

        if ($clientIp === '') {
            throw new InvalidArgumentException('client_ip is required.');
        }

        if ($nasIp === '' && $siteInput === '' && $identity === '') {
            throw new InvalidArgumentException('At least one of nas_ip, site_id, or identity is required.');
        }

        $site = $this->resolveSite($siteInput, $nasIp, $identity);
        if (!$site) {
            throw new InvalidArgumentException('Site could not be resolved from provided context.');
        }

        $organization = Organization::query()->find($site->organization_id);
        if (!$organization) {
            throw new InvalidArgumentException('Organization not found for resolved site.');
        }

        $effectiveNasIp = trim((string) ($site->ip_address ?? $nasIp));
        $session = $this->resolveRadiusSession($clientIp, $effectiveNasIp, $mac);

        $subscriber = $this->resolveSubscriber(
            organizationId: (int) $organization->id,
            radiusUsername: (string) ($session?->username ?? ''),
            mac: $mac
        );

        $contextToken = $this->issueContextToken([
            'organization_id' => (int) $organization->id,
            'site_id' => (int) $site->id,
            'subscriber_type' => $subscriber['type'],
            'subscriber_id' => $subscriber['id'],
            'radius_username' => (string) ($session?->username ?? ''),
            'client_ip' => $clientIp,
            'nas_ip' => $effectiveNasIp,
            'mac' => $mac,
            'issued_at' => now()->timestamp,
            'expires_at' => now()->addMinutes(15)->timestamp,
        ]);

        return [
            'context_token' => $contextToken,
            'tenant' => [
                'id' => (int) $organization->id,
                'name' => (string) $organization->name,
                'acronym' => (string) ($organization->acronym ?? ''),
            ],
            'site' => [
                'id' => (int) $site->id,
                'name' => (string) $site->name,
                'location' => (string) ($site->location ?? ''),
                'ip_address' => (string) ($site->ip_address ?? ''),
            ],
            'session' => [
                'username' => $session?->username,
                'framed_ip' => $session?->framedipaddress,
                'nas_ip' => $session?->nasipaddress,
                'calling_station_id' => $session?->callingstationid,
                'acct_session_id' => $session?->acctsessionid,
                'is_active' => $session ? is_null($session->acctstoptime) : false,
            ],
            'subscriber' => [
                'type' => $subscriber['type'],
                'id' => $subscriber['id'],
                'status' => $subscriber['status'],
                'phone' => $subscriber['phone'],
                'expiry_date' => $subscriber['expiry_date'],
                'radius_username' => $subscriber['radius_username'],
            ],
            'payment' => [
                'has_callback_token' => !empty($organization->mpesa_callback_token),
                'gateway' => $this->extractSafePaymentGatewayConfig($organization->settings),
            ],
        ];
    }

    public function resolveFromToken(string $token): array
    {
        $payload = $this->decryptContextToken($token);

        if (($payload['expires_at'] ?? 0) < now()->timestamp) {
            throw new InvalidArgumentException('Context token has expired.');
        }

        $organization = Organization::query()->find((int) ($payload['organization_id'] ?? 0));
        if (!$organization) {
            throw new InvalidArgumentException('Organization from context token no longer exists.');
        }

        $site = Site::query()
            ->where('id', (int) ($payload['site_id'] ?? 0))
            ->where('organization_id', $organization->id)
            ->first();

        if (!$site) {
            throw new InvalidArgumentException('Site from context token no longer exists.');
        }

        $subscriberType = (string) ($payload['subscriber_type'] ?? '');
        $subscriberId = (int) ($payload['subscriber_id'] ?? 0);

        $subscriber = null;
        if ($subscriberType === 'pppoe' && $subscriberId > 0) {
            $subscriber = Customer::query()
                ->where('organization_id', $organization->id)
                ->whereKey($subscriberId)
                ->first();
        }

        if ($subscriberType === 'hotspot' && $subscriberId > 0) {
            $subscriber = HotspotCustomer::query()
                ->where('organization_id', $organization->id)
                ->whereKey($subscriberId)
                ->first();
        }

        return [
            'token_payload' => $payload,
            'organization' => [
                'id' => (int) $organization->id,
                'name' => (string) $organization->name,
            ],
            'site' => [
                'id' => (int) $site->id,
                'ip_address' => (string) ($site->ip_address ?? ''),
            ],
            'subscriber' => [
                'type' => $subscriberType,
                'id' => $subscriber?->id,
                'status' => $subscriber?->status,
                'radius_username' => $subscriber?->radius_username,
                'phone' => $subscriber?->phone,
            ],
        ];
    }

    private function resolveSite(string $siteInput, string $nasIp, string $identity): ?Site
    {
        if ($siteInput !== '') {
            $site = Site::query()
                ->where('id', $siteInput)
                ->orWhere('ip_address', $siteInput)
                ->first();

            if ($site) {
                if ($nasIp !== '' && trim((string) $site->ip_address) !== $nasIp) {
                    Log::warning('Portal context mismatch: provided site does not match nas_ip', [
                        'site_id' => $site->id,
                        'site_ip' => $site->ip_address,
                        'nas_ip' => $nasIp,
                    ]);
                    return null;
                }

                return $site;
            }
        }

        if ($nasIp !== '') {
            $site = Site::query()->where('ip_address', $nasIp)->first();
            if ($site) {
                return $site;
            }
        }

        if ($identity !== '') {
            return Site::query()->where('name', $identity)->first();
        }

        return null;
    }

    private function resolveRadiusSession(string $clientIp, string $nasIp, ?string $mac): ?object
    {
        try {
            $query = DB::connection('radius')
                ->table('radacct')
                ->where('framedipaddress', $clientIp)
                ->where('nasipaddress', $nasIp)
                ->orderByDesc('radacctid');

            $activeQuery = (clone $query)->whereNull('acctstoptime');
            if ($activeQuery->count() > 1) {
                Log::warning('Multiple active RADIUS sessions found for client IP and NAS IP; resolving as unknown client', [
                    'client_ip' => $clientIp,
                    'nas_ip' => $nasIp,
                ]);
                return null;
            }

            $active = $activeQuery->first([
                'radacctid',
                'username',
                'framedipaddress',
                'nasipaddress',
                'callingstationid',
                'acctsessionid',
                'acctstoptime',
                'acctstarttime',
            ]);

            if ($active) {
                return $active;
            }

            $latest = $query->first([
                'radacctid',
                'username',
                'framedipaddress',
                'nasipaddress',
                'callingstationid',
                'acctsessionid',
                'acctstoptime',
                'acctstarttime',
            ]);

            if ($latest) {
                return $latest;
            }

            if ($mac) {
                return DB::connection('radius')
                    ->table('radacct')
                    ->where('nasipaddress', $nasIp)
                    ->where('callingstationid', $mac)
                    ->orderByDesc('radacctid')
                    ->first([
                        'radacctid',
                        'username',
                        'framedipaddress',
                        'nasipaddress',
                        'callingstationid',
                        'acctsessionid',
                        'acctstoptime',
                        'acctstarttime',
                    ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to resolve RADIUS session for portal context', [
                'client_ip' => $clientIp,
                'nas_ip' => $nasIp,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    private function resolveSubscriber(int $organizationId, string $radiusUsername, ?string $mac): array
    {
        $radiusUsername = trim($radiusUsername);

        if ($radiusUsername !== '') {
            $pppoe = Customer::query()
                ->where('organization_id', $organizationId)
                ->where('radius_username', $radiusUsername)
                ->first();

            if ($pppoe) {
                return [
                    'type' => 'pppoe',
                    'id' => (int) $pppoe->id,
                    'status' => $pppoe->status,
                    'phone' => $pppoe->phone,
                    'expiry_date' => $pppoe->expiry_date,
                    'radius_username' => $pppoe->radius_username,
                    'model' => $pppoe,
                ];
            }

            $hotspot = HotspotCustomer::query()
                ->where('organization_id', $organizationId)
                ->where('radius_username', $radiusUsername)
                ->first();

            if ($hotspot) {
                return [
                    'type' => 'hotspot',
                    'id' => (int) $hotspot->id,
                    'status' => $hotspot->status,
                    'phone' => $hotspot->phone,
                    'expiry_date' => $hotspot->expiry_date,
                    'radius_username' => $hotspot->radius_username,
                    'model' => $hotspot,
                ];
            }
        }

        if ($mac) {
            $hotspot = HotspotCustomer::query()
                ->where('organization_id', $organizationId)
                ->where('mac_address', $mac)
                ->first();

            if ($hotspot) {
                return [
                    'type' => 'hotspot',
                    'id' => (int) $hotspot->id,
                    'status' => $hotspot->status,
                    'phone' => $hotspot->phone,
                    'expiry_date' => $hotspot->expiry_date,
                    'radius_username' => $hotspot->radius_username,
                    'model' => $hotspot,
                ];
            }

            $pppoe = Customer::query()
                ->where('organization_id', $organizationId)
                ->where('mac_address', $mac)
                ->first();

            if ($pppoe) {
                return [
                    'type' => 'pppoe',
                    'id' => (int) $pppoe->id,
                    'status' => $pppoe->status,
                    'phone' => $pppoe->phone,
                    'expiry_date' => $pppoe->expiry_date,
                    'radius_username' => $pppoe->radius_username,
                    'model' => $pppoe,
                ];
            }
        }

        return [
            'type' => null,
            'id' => null,
            'status' => null,
            'phone' => null,
            'expiry_date' => null,
            'radius_username' => $radiusUsername !== '' ? $radiusUsername : null,
            'model' => null,
        ];
    }

    private function issueContextToken(array $payload): string
    {
        return Crypt::encryptString(json_encode($payload, JSON_UNESCAPED_SLASHES));
    }

    private function decryptContextToken(string $token): array
    {
        try {
            $decoded = json_decode((string) Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($decoded)) {
                throw new InvalidArgumentException('Context token payload is invalid.');
            }

            return $decoded;
        } catch (\Throwable $e) {
            throw new InvalidArgumentException('Invalid context token.');
        }
    }

    private function normalizeMacAddress(string $mac): ?string
    {
        $raw = strtoupper(trim($mac));
        if ($raw === '') {
            return null;
        }

        $hexOnly = preg_replace('/[^A-F0-9]/', '', $raw) ?? '';
        if (strlen($hexOnly) !== 12) {
            return null;
        }

        return implode(':', str_split($hexOnly, 2));
    }

    private function extractSafePaymentGatewayConfig(mixed $rawSettings): array
    {
        if (!is_array($rawSettings)) {
            return [];
        }

        $paymentGateway = data_get($rawSettings, 'payment-gateway');
        if (is_string($paymentGateway)) {
            $decoded = json_decode($paymentGateway, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $paymentGateway = $decoded;
            }
        }

        if (!is_array($paymentGateway)) {
            return [];
        }

        return [
            'paybill' => (string) ($paymentGateway['paybill'] ?? ''),
            'environment' => (string) ($paymentGateway['environment'] ?? ''),
            'supports_stk' => !empty($paymentGateway['consumer_key']) && !empty($paymentGateway['consumer_secret']) && !empty($paymentGateway['passkey']),
        ];
    }
}
