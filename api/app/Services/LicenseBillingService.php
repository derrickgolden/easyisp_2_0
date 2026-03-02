<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationLicenseSnapshot;
use Carbon\Carbon;

class LicenseBillingService
{
    public const DEFAULT_PRICE_PER_ACTIVE_USER = 15.00;

    public function generateMonthlySnapshots(?Carbon $snapshotMonth = null): array
    {
        $month = ($snapshotMonth ?: now())->copy()->startOfMonth();
        $created = 0;
        $existing = 0;

        Organization::query()
            ->where('status', 'active')
            ->select('id')
            ->chunkById(100, function ($organizations) use ($month, &$created, &$existing) {
            foreach ($organizations as $organization) {
                $activeUsersCount = Customer::where('organization_id', $organization->id)
                    ->where('status', 'active')
                    ->count();

                $pricePerUser = self::DEFAULT_PRICE_PER_ACTIVE_USER;
                $totalAmount = round($activeUsersCount * $pricePerUser, 2);

                $snapshot = OrganizationLicenseSnapshot::firstOrCreate(
                    [
                        'organization_id' => $organization->id,
                        'snapshot_month' => $month->toDateString(),
                    ],
                    [
                        'active_users_count' => $activeUsersCount,
                        'price_per_user' => $pricePerUser,
                        'total_amount' => $totalAmount,
                        'status' => 'billed',
                        'billed_at' => now(),
                        'meta' => [
                            'pricing_model' => 'per_active_user',
                            'note' => 'Monthly snapshot billing at start of month',
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
            'price_per_user' => self::DEFAULT_PRICE_PER_ACTIVE_USER,
        ];
    }
}
