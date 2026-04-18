<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Facades\DB;

class OrganizationLicenseStatusService
{
    /**
     * Sync organization status based on whether any unpaid (billed) license snapshots exist.
     */
    public function syncStatuses(): array
    {
        return DB::transaction(function () {
            $suspendedIds = DB::table('organization_license_snapshots')
                ->where('status', 'billed')
                ->distinct()
                ->pluck('organization_id')
                ->all();

            $suspendedCount = 0;
            $activeCount = 0;

            if (!empty($suspendedIds)) {
                $suspendedCount = Organization::whereIn('id', $suspendedIds)
                    ->update(['status' => 'suspended']);
            }

            $activeQuery = Organization::query();
            if (!empty($suspendedIds)) {
                $activeQuery->whereNotIn('id', $suspendedIds);
            }

            $activeCount = $activeQuery->update(['status' => 'active']);

            return [
                'suspended' => $suspendedCount,
                'active' => $activeCount,
                'organizations_with_unpaid_snapshots' => count($suspendedIds),
            ];
        });
    }
}
