<?php

namespace App\Services;

use App\Models\Customer;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SubscriptionService
{

    /**
     * Process a single customer - can be called by Cron or on Payment
     */
    public function syncSubscription(Customer $customer)
    {        
        // 1. If the user is manually suspended, ensure they are blocked and STOP logic
        if ($customer->status === 'suspended') {
            // $this->applySuspendedStatus($customer);
            return; 
        }

        // Temporary workaround: do not force active users back into a RADIUS group.
        // This prevents the cron from re-inserting radusergroup rows after a manual delete.
        if ($customer->status === 'active') {
            return;
        }

        $effectiveDate = $this->getEffectiveExpiryDate($customer);

        // Check and send pre-expiry warnings (48-hour and 1-hour)
        $this->checkAndSendExpiryWarnings($customer, $effectiveDate);
       
        if ($effectiveDate->isPast()) {
            // Customer is expired - check if they have enough balance to auto-renew
            $packagePrice = $customer->effective_package_price;

            if ($packagePrice !== null && $customer->balance >= $packagePrice) {
                $isOnline = DB::connection('radius')->table('radacct')
                    ->where('username', $customer->radius_username)
                    ->whereNull('acctstoptime')
                    ->exists();

                if (!$isOnline) {
                    if ($customer->status !== 'expired') {
                        $this->applyExpiredStatus($customer);
                    }

                    return;
                }

                return $this->activatePackage($customer, $packagePrice);
            }

            // No balance - Move to Redirect/Expired Group in RADIUS
            if ($customer->status !== 'expired') {
                $this->applyExpiredStatus($customer);
            }
        } else {
            $this->applyActiveStatus($customer);
        }
    }

    /**
     * Requirement 1 & 2: Calculate date based on Extensions and Parent logic
     */
    public function getEffectiveExpiryDate(Customer $customer)
    {
        // Determine who the "Provider" of the expiry date is
        $provider = $customer;

        // If sub-account and NOT independent, use parent's dates
        if ($customer->parent_id && !$customer->is_independent) {
            $provider = Customer::find($customer->parent_id) ?? $customer;
        }

        $expiry = Carbon::parse($provider->expiry_date);
        $extension = $provider->extension_date ? Carbon::parse($provider->extension_date) : null;

        // Requirement 1: If extension is in the future relative to expiry, use it
        if ($extension && $extension->gt($expiry)) {
            return $extension;
        }

        return $expiry;
    }

    /**
     * Requirement 3 & 4: Activation Logic
     */
    private function activatePackage(Customer $customer, $price)
    {
        // 1. Deduct balance from the customer
        $customer->decrement('balance', $price);

        // 2. Load validity from the package
        $validityDays = $customer->package->validity ?? 30;
        $validityType = $customer->package->validity_type ?? 'days';

        // 3. Requirement 4: Calculate borrowed extension days
        $extensionDays = 0;
        $expiry = Carbon::parse($customer->expiry_date);
        
        if ($customer->extension_date) {
            $extension = Carbon::parse($customer->extension_date);
            
            // If extension was in the future relative to expiry, they "borrowed" time
            if ($extension->gt($expiry)) {
                // We calculate days between expiry and extension to subtract from new period
                $extensionDays = $expiry->diffInDays($extension);
            }
        }

        // 4. Set new expiry date starting from NOW, accounting for borrowed extension days
        // Keep exact timestamp instead of forcing end-of-day cutoffs.
        if ($validityType === 'months') {
            $customer->expiry_date = Carbon::now()->addMonthsNoOverflow($validityDays)->subDays($extensionDays);
        } else {
            $daysToAdd = max(0, $validityDays - $extensionDays);
            $customer->expiry_date = Carbon::now()->addDays($daysToAdd);
        }
        
        // 6. Reset extension fields and status
        $customer->extension_date = null; 
        $customer->expiry_warning_sent_at = null; // Reset 48-hour warning flag for new period
        $customer->expiry_one_hour_warning_sent_at = null; // Reset 1-hour warning flag for new period
        $customer->status = 'active';
        $customer->save();

        // Cascade new expiry to dependent (non-independent) sub-accounts
        $customer->subAccounts()->where('is_independent', false)->each(function ($child) use ($customer) {
            $child->expiry_date = $customer->expiry_date;
            $child->extension_date = null;
            $child->expiry_warning_sent_at = null;
            $child->expiry_one_hour_warning_sent_at = null;
            $child->status = 'active';
            $child->save();
            $this->applyActiveStatus($child);
        });

        return $this->applyActiveStatus($customer);
    }

    private function applyExpiredStatus(Customer $customer, bool $sendNotification = true)
    {
        // 1. Update Laravel Database
        $customer->update(['status' => 'expired']);

        // 2. Send expiry notification (account expired) SMS
        if ($sendNotification) {
            $expiryDate = $this->getEffectiveExpiryDate($customer);
            $messagingService = new CustomerMessagingService();
            $messagingService->send(
                $customer,
                CustomerMessagingService::TYPE_EXPIRY_NOTIFICATION,
                ['{Expiry}' => $expiryDate->format('M d, Y h:i A')]
            );
        }

        $radius = DB::connection('radius');

        if ($customer->package?->queue_type === 'pcq') {
            // PCQ users receive the redirect group as a reply attribute.
            $radius->table('radreply')->updateOrInsert(
                [
                    'username' => $customer->radius_username,
                    'attribute' => 'Mikrotik-Group',
                ],
                [
                    'op' => ':=',
                    'value' => 'Expired_Redirect',
                ]
            );

            // Do not leave the active PCQ address list attached to an expired user.
            $radius->table('radreply')
                ->where('username', $customer->radius_username)
                ->where('attribute', 'Mikrotik-Address-List')
                ->delete();

            $radius->table('radusergroup')
                ->where('username', $customer->radius_username)
                ->delete();
        } else {
            // FIFO users continue using the existing RADIUS group flow.
            $radius->table('radreply')
                ->where('username', $customer->radius_username)
                ->whereIn('attribute', ['Mikrotik-Group', 'Mikrotik-Address-List'])
                ->delete();

            $radius->table('radusergroup')
                ->updateOrInsert(
                    ['username' => $customer->radius_username],
                    ['groupname' => 'Expired_Redirect', 'priority' => 1]
                );
        }

        // Disconnect user to force re-auth into redirect group
        app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username, $customer->organization_id);
        
    }
        
    public function syncRadiusAssignment(Customer $customer): void
    {
        if ($customer->status === 'suspended') {
            $this->applySuspendedStatus($customer);
            return;
        }

        if ($customer->status === 'expired') {
            $this->applyExpiredStatus($customer, false);
            return;
        }

        $this->applyActiveStatus($customer);
    }

    public function applyActiveStatus(Customer $customer)
    {

        $customer->update(['status' => 'active']);

        $radius = DB::connection('radius');
        $package = $customer->package;

        if ($package->queue_type === 'pcq') {
            $companyAcronym = strtoupper(preg_replace('/[^A-Za-z0-9_-]/', '', (string) $customer->organization->acronym));
            $packageName = preg_replace('/\s+/', '-', trim((string) $package->name));
            $upload = trim((string) $package->speed_up);
            $download = trim((string) $package->speed_down);
            $addressList = "PCQ-{$companyAcronym}-{$packageName}-{$upload}-{$download}";

            $pcqReplies = [
                'Mikrotik-Group' => "ppp-{$companyAcronym}-pcq",
                'Mikrotik-Address-List' => $addressList,
            ];
            $requiresDisconnect = false;

            foreach ($pcqReplies as $attribute => $value) {
                $existingReply = $radius->table('radreply')
                    ->where('username', $customer->radius_username)
                    ->where('attribute', $attribute)
                    ->first();

                if (!$existingReply || $existingReply->op !== ':=' || $existingReply->value !== $value) {
                    $requiresDisconnect = true;
                }

                $radius->table('radreply')->updateOrInsert(
                    [
                        'username' => $customer->radius_username,
                        'attribute' => $attribute,
                    ],
                    [
                        'op' => ':=',
                        'value' => $value,
                    ]
                );
            }

            // Prevent an old FIFO, expired, or suspended group from overriding PCQ replies.
            $radius->table('radusergroup')
                ->where('username', $customer->radius_username)
                ->delete();

            if ($requiresDisconnect) {
                app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username, $customer->organization_id);
                Log::info("User {$customer->radius_username} resumed with PCQ RADIUS replies.");
            }

            return;
        }

        // FIFO users use the existing RADIUS group flow.
        $radius->table('radreply')
            ->where('username', $customer->radius_username)
            ->whereIn('attribute', ['Mikrotik-Group', 'Mikrotik-Address-List'])
            ->delete();

        $packageName = "package_" . $package->id;
        $currentGroup = $radius->table('radusergroup')
            ->where('username', $customer->radius_username)
            ->first();

        if (!$currentGroup || $currentGroup->groupname !== $packageName) {
            $radius->table('radusergroup')
                ->updateOrInsert(
                    ['username' => $customer->radius_username],
                    ['groupname' => $packageName]
                );

            app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username, $customer->organization_id);
            Log::info("User {$customer->radius_username} resumed and RADIUS group updated.");
        }
    }

    public function applySuspendedStatus(Customer $customer)
    {
        // Use a specific RADIUS group for suspended users
        // This group should have NO IP pool or a "Blocked" pool
        $targetGroup = 'Suspended_Group'; 
        $radius = DB::connection('radius');

        if ($customer->package?->queue_type === 'pcq') {
            // PCQ users receive the suspended group as a reply attribute.
            $radius->table('radreply')->updateOrInsert(
                [
                    'username' => $customer->radius_username,
                    'attribute' => 'Mikrotik-Group',
                ],
                [
                    'op' => ':=',
                    'value' => $targetGroup,
                ]
            );

            // Do not leave the active PCQ address list attached to a suspended user.
            $radius->table('radreply')
                ->where('username', $customer->radius_username)
                ->where('attribute', 'Mikrotik-Address-List')
                ->delete();

            // Prevent an old FIFO group from overriding the PCQ reply attributes.
            $radius->table('radusergroup')
                ->where('username', $customer->radius_username)
                ->delete();

            app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username, $customer->organization_id);
            Log::warning("User {$customer->radius_username} has been SUSPENDED with PCQ RADIUS replies.");

            return;
        }

        $radius->table('radreply')
            ->where('username', $customer->radius_username)
            ->whereIn('attribute', ['Mikrotik-Group', 'Mikrotik-Address-List'])
            ->delete();

        $radiusRecord = $radius->table('radusergroup')
            ->where('username', $customer->radius_username)
            ->first();

        if (!$radiusRecord || $radiusRecord->groupname !== $targetGroup) {
            $radius->table('radusergroup')
                ->updateOrInsert(
                    ['username' => $customer->radius_username],
                    ['groupname' => $targetGroup, 'priority' => 1]
                );

            // Kick the session immediately
            app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username, $customer->organization_id);
            
            \Log::warning("User {$customer->radius_username} has been SUSPENDED.");
        }
    }

    /**
     * Check and send pre-expiry warnings (48-hour and 1-hour) once each.
     */
    private function checkAndSendExpiryWarnings(Customer $customer, Carbon $effectiveDate)
    {
        // Skip dependent sub-accounts — their parent handles billing notifications
        if ($customer->parent_id && !$customer->is_independent) {
            return;
        }

        $now = Carbon::now();
        $minutesUntilExpiry = $now->diffInMinutes($effectiveDate, false);

        // Already expired or exactly at expiry time.
        if ($minutesUntilExpiry <= 0) {
            return;
        }

        $updates = [];
        $messagingService = new CustomerMessagingService();

        // Send 48-hour warning only in the window (48h, 1h] and only once.
        if (!$customer->expiry_warning_sent_at && $minutesUntilExpiry > 60 && $minutesUntilExpiry <= (48 * 60)) {
                $hoursUntilExpiry = max(1, (int) ceil($minutesUntilExpiry / 60));

            $messagingService->send(
                $customer,
                CustomerMessagingService::TYPE_EXPIRY_WARNING,
                [
                    '{Expiry}' => $effectiveDate->format('M d, Y h:i A'),
                        '{HoursUntilExpiry}' => (string) $hoursUntilExpiry,
                ]
            );

            $updates['expiry_warning_sent_at'] = $now;
        }

        // Send 1-hour warning in the last hour and only once.
        if (!$customer->expiry_one_hour_warning_sent_at && $minutesUntilExpiry <= 60) {
            $hoursUntilExpiry = max(1, (int) ceil($minutesUntilExpiry / 60));

            $messagingService->send(
                $customer,
                CustomerMessagingService::TYPE_EXPIRY_ONE_HOUR_WARNING,
                [
                    '{Expiry}' => $effectiveDate->format('M d, Y h:i A'),
                    '{HoursUntilExpiry}' => (string) $hoursUntilExpiry,
                ]
            );

            $updates['expiry_one_hour_warning_sent_at'] = $now;
        }

        if (!empty($updates)) {
            $customer->update($updates);
        }
    }

    /**
     * Central command for sending SMS messages to customers
     * Uses the dedicated CustomerMessagingService for all message types
     *
     * @deprecated Use CustomerMessagingService::send() directly
     * This method is kept for backwards compatibility during transition
     */
    public function sendMessageToCustomer(Customer $customer, string $messageType, array $customReplacements = [], array $options = []): bool
    {
        $messagingService = new CustomerMessagingService();
        return $messagingService->send($customer, $messageType, $customReplacements, $options);
    }
}