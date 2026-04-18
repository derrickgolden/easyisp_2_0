<?php

namespace App\Console\Commands;

use App\Services\OrganizationLicenseStatusService;
use Illuminate\Console\Command;

class SyncOrganizationLicenseStatuses extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'license:sync-organization-statuses';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Set organization status to suspended if unpaid license snapshots exist, otherwise active';

    /**
     * Execute the console command.
     */
    public function handle(OrganizationLicenseStatusService $statusService): int
    {
        $result = $statusService->syncStatuses();

        $this->info('Organization license statuses synced successfully.');
        $this->line('Suspended: ' . $result['suspended']);
        $this->line('Active: ' . $result['active']);
        $this->line('Organizations with unpaid snapshots: ' . $result['organizations_with_unpaid_snapshots']);

        return self::SUCCESS;
    }
}
