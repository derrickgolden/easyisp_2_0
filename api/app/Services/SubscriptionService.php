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
            $this->applySuspendedStatus($customer);
            return; 
        }

        $effectiveDate = $this->getEffectiveExpiryDate($customer);

        $past = $effectiveDate->isPast() ? "true": "false";
       
        if ($effectiveDate->isPast()) {
            // Customer is expired - check if they have enough balance to auto-renew
            $packagePrice = $customer->package->price; // Assuming relationship exists

            if ($customer->balance >= $packagePrice) {
                $isOnline = DB::connection('radius')->table('radacct')
                    ->where('username', $customer->radius_username)
                    ->whereNull('acctstoptime')
                    ->exists();

                if (!$isOnline) {
                    Log::info("Auto-Activation skipped for {$customer->radius_username}: user is offline.");

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

        // 2. Load validity days from the package (default to 30 if null)
        $validityDays = $customer->package->validity_days ?? 30;

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

        // 4. Calculate final days to add (Validity - Borrowed Days)
        // We use max(0, ...) to ensure we never subtract more days than the package has
        $daysToAdd = max(0, $validityDays - $extensionDays); 
        
        // 5. Set new expiry date starting from NOW
        $customer->expiry_date = Carbon::now()->addDays($daysToAdd)->endOfDay();
        
        // 6. Reset extension fields and status
        $customer->extension_date = null; 
        $customer->status = 'active';
        $customer->save();

        \Log::info("Auto-Activation for {$customer->radius_username}: 
            Package Validity: {$validityDays}, 
            Extension Deducted: {$extensionDays}, 
            Final Days Added: {$daysToAdd}");

        return $this->applyActiveStatus($customer);
    }

    private function applyExpiredStatus(Customer $customer)
    {
        // 1. Update Laravel Database
        $customer->update(['status' => 'expired']);

        // 2. Update RADIUS to "Expired" group for redirection
        DB::connection('radius')->table('radusergroup')
            ->updateOrInsert(
                ['username' => $customer->radius_username],
                ['groupname' => 'Expired_Redirect', 'priority' => 1] // ensure record exists and has priority
            ); // Match your MikroTik/Radius profile

        // Disconnect user to force re-auth into redirect group
        app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username);
        
    }
        
    private function applyActiveStatus(Customer $customer)
    {
        $customer->update(['status' => 'active']);

        // 2. Check RADIUS group
        $currentGroup = DB::connection('radius')->table('radusergroup')
            ->where('username', $customer->radius_username)
            ->first();

        $packageName = "package_" . $customer->package->id;

        // 3. ONLY update and kick if they are in the wrong group (like Suspended or Expired)
        if (!$currentGroup || $currentGroup->groupname !== $packageName) {
            DB::connection('radius')->table('radusergroup')
                ->updateOrInsert(
                    ['username' => $customer->radius_username],
                    ['groupname' => $packageName]
                );

            // This is where the magic happens: User is moved from Suspended -> Package
            app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username);
            Log::info("User {$customer->radius_username} resumed and RADIUS group updated.");
        }
    }

    public function applySuspendedStatus(Customer $customer)
    {
        // Use a specific RADIUS group for suspended users
        // This group should have NO IP pool or a "Blocked" pool
        $targetGroup = 'Suspended_Group'; 

        $radiusRecord = DB::connection('radius')->table('radusergroup')
            ->where('username', $customer->radius_username)
            ->first();

        if (!$radiusRecord || $radiusRecord->groupname !== $targetGroup) {
            DB::connection('radius')->table('radusergroup')
                ->updateOrInsert(
                    ['username' => $customer->radius_username],
                    ['groupname' => $targetGroup, 'priority' => 1]
                );

            // Kick the session immediately
            app(CustomerRadiusService::class)->disconnectCustomer($customer->radius_username);
            
            \Log::warning("User {$customer->radius_username} has been SUSPENDED.");
        }
    }
}