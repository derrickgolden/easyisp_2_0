<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\HotspotPayment;
use App\Models\OrganizationLicenseSnapshot;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class LicenseBillingService
{
    public const PPPOE_PRICE_PER_ACTIVE_USER = 15.00;
    public const HOTSPOT_PRICING_PERCENTAGE  = 3;
    public const MINIMUM_PAYABLE_AMOUNT = 500.00;

    public function generateMonthlySnapshots(?Carbon $snapshotMonth = null): array
    {
        $month = ($snapshotMonth ?: now())->copy()->startOfMonth();
        $created = 0;
        $existing = 0;

        Organization::query()
            ->where('status', 'active')
            ->select('id', 'client_type')
            ->chunkById(100, function ($organizations) use ($month, &$created, &$existing) {

            foreach ($organizations as $organization) {
                $pppoeAmount = 0;
                $hotspotAmount = 0;
                $activeUsersCount = 0;
                $pricePerUser = self::PPPOE_PRICE_PER_ACTIVE_USER;
                $hotspotPayments = 0;

                # PPPoE Calculations
                if($organization->client_type === 'PPPoE' || $organization->client_type === 'Both'){
                    $activeUsersCount = Customer::where('organization_id', $organization->id)
                        ->where('status', 'active')
                        ->count();
                        if($organization->id <= 3) {
                            $pricePerUser = 5.00;
                            } 
                            
                        $calculatedAmount = round($activeUsersCount * $pricePerUser, 2);
                        $pppoeAmount = max($calculatedAmount, self::MINIMUM_PAYABLE_AMOUNT);

                        Log::info("Organization ID: {$organization->id}, Active Users Count: {$activeUsersCount}", [
                            'calculated_amount' => $calculatedAmount,
                            'pppoe_amount' => $pppoeAmount,
                            'price_per_user' => $pricePerUser,
                        ]);

                }

                # Hotspot Calculations
                if($organization->client_type === 'Hotspot' || $organization->client_type === 'Both'){
                    $startDate = $month->copy()->subMonth()->day(28)->startOfDay();
                    $endDate = $month->copy()->day(28)->startOfDay();
    
                    $hotspotPayments = HotspotPayment::where('organization_id', $organization->id)
                        ->where('created_at', '>=', $startDate)
                        ->where('created_at', '<', $endDate)
                        ->sum('amount');
    
                    $calculatedAmount = round($hotspotPayments * (self::HOTSPOT_PRICING_PERCENTAGE / 100), 2);
                    $hotspotAmount = max($calculatedAmount, self::MINIMUM_PAYABLE_AMOUNT);
                    Log::info("Organization ID: {$organization->id}, Hotspot Payments: {$hotspotPayments}", [
                        'calculated_amount' => $calculatedAmount,
                        'hotspot_amount' => $hotspotAmount,
                        'hotspot_percentage' => self::HOTSPOT_PRICING_PERCENTAGE,
                    ]);
                }


                $totalAmount = $pppoeAmount + $hotspotAmount;

                $snapshot = OrganizationLicenseSnapshot::firstOrCreate(
                    [
                        'organization_id' => $organization->id,
                        'snapshot_month' => $month->toDateString(),
                    ],
                    [
                        'active_pppoe_users_count' => $activeUsersCount,
                        'price_per_pppoe_user' => $pricePerUser,
                        'pppoe_amount' => $pppoeAmount,
                        'hotspot_payments' => $hotspotPayments,
                        'hotspot_percentage' => self::HOTSPOT_PRICING_PERCENTAGE,
                        'hotspot_amount' => $hotspotAmount,
                        'status' => 'billed',
                        'total_amount' => $totalAmount,
                        'billed_at' => now(),
                        'meta' => [
                            'pricing_model' => 'per_active_user for PPPoE and percentage-based Hotspot payments',
                            'note' => 'Monthly snapshot billing at ' . now()->toDateTimeString(),
                        ],
                    ]
                );

                if ($snapshot->wasRecentlyCreated) {
                    $created++;
                } else {
                    $existing++;
                }
            }
        });

        return [
            'snapshot_month' => $month->toDateString(),
            'created' => $created,
            'existing' => $existing,
            'price_per_user' => self::PPPOE_PRICE_PER_ACTIVE_USER,
            'hotspot_percentage' => self::HOTSPOT_PRICING_PERCENTAGE,
        ];
    }
}
