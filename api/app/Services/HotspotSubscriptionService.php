<?php

namespace App\Services;

use App\Models\HotspotCustomer;
use App\Models\HotspotPackage;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class HotspotSubscriptionService
{
    /**
     * Process a single hotspot customer - can be called by Cron or on Payment
     */
    public function syncSubscription(HotspotCustomer $hotspot_customer)
    {        
        // 1. If the user is manually suspended, ensure they are blocked and STOP logic
        if ($hotspot_customer->status === 'suspended') {
            $this->applySuspendedStatus($hotspot_customer);
            return; 
        }

        $effectiveDate = $this->getEffectiveExpiryDate($hotspot_customer);

        // Check and send pre-expiry warnings (48-hour and 1-hour)
        // $this->checkAndSendExpiryWarnings($hotspot_customer, $effectiveDate);
       
        if ($effectiveDate->isPast()) {
            // Customer is expired - check if they have enough balance to auto-renew
            $packagePrice = $hotspot_customer->effective_package_price;

            if ($packagePrice !== null && $hotspot_customer->balance >= $packagePrice) {
                return $this->activatePackage($hotspot_customer, $packagePrice);
            }

            // No balance - Move to Redirect/Expired Group in RADIUS
            if ($hotspot_customer->status !== 'expired') {
                $this->applyExpiredStatus($hotspot_customer, $effectiveDate);
            }
        } else {
            $this->applyActiveStatus($hotspot_customer);
        }
    }

    /**
     * Requirement 1 & 2: Calculate date based on Extensions and Parent logic
     */
    public function getEffectiveExpiryDate(HotspotCustomer $hotspot_customer)
    {
        // Determine who the "Provider" of the expiry date is
        $provider = $hotspot_customer;

        // If sub-account and NOT independent, use parent's dates
        if ($hotspot_customer->parent_id && !$hotspot_customer->is_independent) {
            $provider = HotspotCustomer::find($hotspot_customer->parent_id) ?? $hotspot_customer;
        }

        $expiry = Carbon::parse($provider->expiry_date);
        $extension = $provider->extension_date ? Carbon::parse($provider->extension_date) : null;

        // Requirement 1: If extension is in the future relative to expiry, use it
        if ($extension && $extension->gt($expiry)) {
            return $extension;
        }

        return $expiry;
    }

    public function applyActiveStatus(HotspotCustomer $customer)
    {
        $package = $this->resolveEffectivePackage($customer);
        if ($customer->expiry_date === null) {
            $packageSeconds = $this->resolveSessionTimeoutSeconds($package);
            if ($packageSeconds > 0) {
                $customer->expiry_date = Carbon::now()->addSeconds($packageSeconds);
                $customer->save();
            }
        }

        $updates = ['status' => 'active'];
        if ($customer->status !== 'active') {
            $updates['activated_at'] = now();
        }
        $customer->update($updates);

        // Remove explicit deny flag if user was previously suspended.
        DB::connection('radius')->table('radcheck')
            ->where('username', $customer->radius_username)
            ->where('attribute', 'Auth-Type')
            ->delete();

        DB::connection('radius')->table('radcheck')->updateOrInsert(
            [
                'username' => $customer->radius_username,
                'attribute' => 'Cleartext-Password',
            ],
            [
                'op' => ':=',
                'value' => $customer->radius_password,
                'organization_id' => $customer->organization_id,
                'client_type' => 'hotspot',
            ]
        );

        $simultaneousUse = (int) data_get($package, 'max_connections', 0);

        DB::connection('radius')->table('radcheck')
            ->where('username', $customer->radius_username)
            ->where('attribute', 'Simultaneous-Use')
            ->delete();

        if ($simultaneousUse > 0) {
            DB::connection('radius')->table('radcheck')->insert([
                'username' => $customer->radius_username,
                'attribute' => 'Simultaneous-Use',
                'op' => ':=',
                'value' => $simultaneousUse,
                'organization_id' => $customer->organization_id,
                'client_type' => 'hotspot',
            ]);
        }

        $downloadSpeed = data_get($package, 'download_speed') ?? data_get($package, 'speed_down');
        $uploadSpeed = data_get($package, 'upload_speed') ?? data_get($package, 'speed_up');
        $rateLimit = $this->buildMikrotikRateLimit($downloadSpeed, $uploadSpeed);

        if ($rateLimit !== null) {
            DB::connection('radius')->table('radreply')->updateOrInsert(
                [
                    'username' => $customer->radius_username,
                    'attribute' => 'Mikrotik-Rate-Limit',
                ],
                [
                    'op' => ':=',
                    'value' => $rateLimit,
                ]
            );
        }

        $seconds = $this->resolveSessionTimeoutSeconds($customer);

        if ($seconds > 0) {
            DB::connection('radius')->table('radreply')->updateOrInsert(
                [
                    'username' => $customer->radius_username,
                    'attribute' => 'Session-Timeout',
                ],
                [
                    'op' => ':=',
                    'value' => (string) $seconds,
                ]
            );
        }

        return [$customer, $seconds];
    }

    public function applySuspendedStatus(HotspotCustomer $customer)
    {
        if (empty($customer->radius_username)) {
            Log::warning('Cannot apply hotspot suspension without radius username', [
                'customer_id' => $customer->id,
                'organization_id' => $customer->organization_id,
            ]);
            return;
        }

        $customer->update(['status' => 'suspended']);

        // Keep credentials but enforce explicit authentication rejection.
        DB::connection('radius')->table('radcheck')->updateOrInsert(
            [
                'username' => $customer->radius_username,
                'attribute' => 'Auth-Type',
            ],
            [
                'op' => ':=',
                'value' => 'Reject',
                'organization_id' => $customer->organization_id,
                'client_type' => 'hotspot',
            ]
        );

        // Remove policy grants so the suspended state is deterministic after reactivation.
        DB::connection('radius')->table('radreply')
            ->where('username', $customer->radius_username)
            ->delete();

        DB::connection('radius')->table('radusergroup')
            ->where('username', $customer->radius_username)
            ->delete();

        app(HotspotCustomerRadiusService::class)->disconnectCustomer(
            $customer->radius_username,
            $customer->organization_id
        );

        Log::warning("User {$customer->radius_username} has been SUSPENDED.");
    }

    private function applyExpiredStatus(HotspotCustomer $customer, Carbon $expiryDate)
    {
        // 1. Update Laravel Database
        $customer->update(['status' => 'expired']);

        // 2. Send expiry notification (account expired) SMS
        // $messagingService = new CustomerMessagingService();
        // $messagingService->send(
        //     $customer,
        //     CustomerMessagingService::TYPE_EXPIRY_NOTIFICATION,
        //     ['{Expiry}' => $expiryDate->format('M d, Y h:i A')]
        // );

        // 3. delete the user from the RADIUS table to force re-auth into redirect group
        DB::connection('radius')->table('radcheck')
            ->where('username', $customer->radius_username)
            ->delete();
        DB::connection('radius')->table('radusergroup')
            ->where('username', $customer->radius_username)
            ->delete();
        DB::connection('radius')->table('radreply')
            ->where('username', $customer->radius_username)
            ->delete();

        // Disconnect user to force re-auth into redirect group
        app(HotspotCustomerRadiusService::class)->disconnectCustomer($customer->radius_username, $customer->organization_id);
        
    }

    private function activatePackage(HotspotCustomer $customer, $price)
    {
        // 1. Deduct balance from the customer
        $customer->decrement('balance', $price);

        // 2. Resolve package session validity in seconds (supports minutes/hours/days/months)
        $package = $this->resolveEffectivePackage($customer);
        $sessionSeconds = $this->resolveSessionTimeoutSeconds($package);

        if ($sessionSeconds > 0) {
            // 3. Requirement 4: Calculate borrowed extension time in seconds
            $extensionSeconds = 0;
            $expiry = Carbon::parse($customer->expiry_date);

            if ($customer->extension_date) {
                $extension = Carbon::parse($customer->extension_date);

                // If extension was in the future relative to expiry, they "borrowed" time
                if ($extension->gt($expiry)) {
                    // Subtract borrowed extension duration from the newly purchased session duration
                    $extensionSeconds = $expiry->diffInSeconds($extension);
                }
            }

            // 4. Set new expiry date from NOW using second-precision session timeout.
            $effectiveSeconds = max(0, $sessionSeconds - $extensionSeconds);
            $customer->expiry_date = Carbon::now()->addSeconds($effectiveSeconds);
        }
        
        // 6. Reset extension fields and status
        $customer->extension_date = null; 
        $customer->expiry_warning_sent_at = null; // Reset 48-hour warning flag for new period
        $customer->expiry_one_hour_warning_sent_at = null; // Reset 1-hour warning flag for new period
        $customer->status = 'active';
        $customer->activated_at = now();
        $customer->save();

        // Cascade new expiry to dependent (non-independent) sub-accounts
        $customer->subAccounts()->where('is_independent', false)->each(function ($child) use ($customer) {
            $child->expiry_date = $customer->expiry_date;
            $child->extension_date = null;
            $child->expiry_warning_sent_at = null;
            $child->expiry_one_hour_warning_sent_at = null;
            $child->status = 'active';
            $child->activated_at = now();
            $child->save();
            $this->applyActiveStatus($child);
        });

        return $this->applyActiveStatus($customer);
    }

    private function resolveEffectivePackage(HotspotCustomer $customer): ?HotspotPackage
    {
        if ($customer->relationLoaded('package')) {
            return $customer->getRelationValue('package');
        }

        if (!$customer->package_id) {
            return null;
        }

        return $customer->package()->first();
    }

    public function resolveSessionTimeoutSeconds(HotspotCustomer|HotspotPackage|null $subject): int
    {
        if ($subject instanceof HotspotCustomer) {
            return max(0, Carbon::now()->diffInSeconds(Carbon::parse($subject->expiry_date), false));
        }

        if ($subject === null) {
            return 0;
        }

        $sessionTimeout = (int) data_get($subject, 'session_timeout', 0);
        if ($sessionTimeout > 0) {
            return $sessionTimeout;
        }

        $durationHours = (int) data_get($subject, 'duration_hours', 0);
        if ($durationHours > 0) {
            return $durationHours * 3600;
        }

        $validity = (int) data_get($subject, 'validity', 0);
        if ($validity <= 0) {
            return 0;
        }

        $validityType = strtolower((string) data_get($subject, 'validity_type', 'days'));

        return match ($validityType) {
            'minutes' => $validity * 60,
            'hours' => $validity * 3600,
            'months' => $validity * 30 * 86400,
            default => $validity * 86400,
        };
    }

    private function buildMikrotikRateLimit(mixed $downloadSpeed, mixed $uploadSpeed): ?string
    {
        $download = $this->normalizeRateSpeedToken($downloadSpeed);
        $upload = $this->normalizeRateSpeedToken($uploadSpeed);

        if (!$download || !$upload) {
            return null;
        }

        return $download . '/' . $upload;
    }

    private function normalizeRateSpeedToken(mixed $speed): ?string
    {
        $raw = strtoupper(trim((string) ($speed ?? '')));
        if ($raw === '') {
            return null;
        }

        $compact = preg_replace('/\s+/', '', $raw) ?? '';
        if ($compact === '') {
            return null;
        }

        $compact = str_replace(['MBPS', 'MPS'], 'M', $compact);
        $compact = str_replace(['KBPS', 'KPS'], 'K', $compact);
        $compact = str_replace(['GBPS', 'GPS'], 'G', $compact);

        if (preg_match('/^\d+(\.\d+)?$/', $compact)) {
            return $compact . 'M';
        }

        if (preg_match('/^\d+(\.\d+)?[KMG]$/', $compact)) {
            return $compact;
        }

        return null;
    }

}