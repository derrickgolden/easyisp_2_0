<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Facades\DB;

class OrganizationLicenseStatusService
{
    /**
    * Sync organization and NAS status based on unpaid (billed) license snapshots.
     */
    public function syncStatuses(): array
    {
        return DB::transaction(function () {
            $suspendedIds = DB::table('organization_license_snapshots')
                ->where('status', 'billed')
                ->distinct()
                ->pluck('organization_id')
                ->all();

            $organizationIds = Organization::query()->pluck('id')->all();
            $suspendedOrganizationIds = array_values(array_intersect($suspendedIds, $organizationIds));
            $activeOrganizationIds = array_values(array_diff($organizationIds, $suspendedOrganizationIds));

            $suspendedCount = 0;
            if (!empty($suspendedOrganizationIds)) {
                $suspendedCount = Organization::whereIn('id', $suspendedOrganizationIds)
                    ->update(['status' => 'suspended']);
            }

            $activeCount = 0;
            if (!empty($activeOrganizationIds)) {
                $activeCount = Organization::whereIn('id', $activeOrganizationIds)
                    ->update(['status' => 'active']);
            }

            $nasSuspendedCount = 0;
            if (!empty($suspendedOrganizationIds)) {
                $nasSuspendedCount = DB::connection('radius')->table('nas')
                    ->whereIn('organization_id', $suspendedOrganizationIds)
                    ->update(['status' => 'suspended']);
            }

            $nasActiveCount = 0;
            if (!empty($activeOrganizationIds)) {
                $nasActiveCount = DB::connection('radius')->table('nas')
                    ->whereIn('organization_id', $activeOrganizationIds)
                    ->update(['status' => 'active']);
            }

            return [
                'suspended' => $suspendedCount,
                'active' => $activeCount,
                'nas_suspended' => $nasSuspendedCount,
                'nas_active' => $nasActiveCount,
                'organizations_with_unpaid_snapshots' => count($suspendedIds),
            ];
        });
    }
}
