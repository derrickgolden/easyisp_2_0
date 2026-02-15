<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Services\RadiusService;
use Illuminate\Console\Command;

class SyncCustomersToRadius extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'radius:sync-customers {--force : Force sync even if user exists}';

    /**
     * The description of the console command.
     *
     * @var string
     */
    protected $description = 'Sync EasyISP customers to RADIUS database';

    protected $radiusService;

    public function __construct(RadiusService $radiusService)
    {
        parent::__construct();
        $this->radiusService = $radiusService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $force = $this->option('force');
        $synced = 0;
        $skipped = 0;
        $failed = 0;

        $this->info('Starting RADIUS customer synchronization...');
        $this->newLine();

        // Get all active customers
        $customers = Customer::where('status', 'active')
            ->whereNotNull('radius_username')
            ->whereNotNull('radius_password')
            ->get();

        $this->line("Found " . $customers->count() . " customers to sync");
        $this->newLine();

        foreach ($customers as $customer) {
            $this->output->write("Syncing {$customer->radius_username}... ");

            try {
                // Check if user already exists
                $exists = $this->radiusService->userExists($customer->radius_username);

                if ($exists && !$force) {
                    $this->line("<fg=yellow>SKIPPED</> (already exists)");
                    $skipped++;
                    continue;
                }

                // Delete if exists and force is set
                if ($exists && $force) {
                    $this->radiusService->deleteUser($customer->radius_username);
                }

                // Create user with check attributes
                $result = $this->radiusService->createUser(
                    $customer->radius_username,
                    $customer->radius_password,
                    [
                        'check' => [
                            [
                                'attribute' => 'Framed-IP-Address',
                                'op' => '==',
                                'value' => $customer->ip_address ?? '',
                            ],
                        ],
                        'reply' => [
                            [
                                'attribute' => 'Framed-IP-Address',
                                'op' => ':=',
                                'value' => $customer->ip_address ?? '',
                            ],
                            [
                                'attribute' => 'Framed-IP-Netmask',
                                'op' => ':=',
                                'value' => '255.255.255.0',
                            ],
                            [
                                'attribute' => 'Service-Type',
                                'op' => ':=',
                                'value' => 'Framed-User',
                            ],
                        ],
                    ]
                );

                if ($result['success']) {
                    // Assign to group based on package
                    if ($customer->package) {
                        $groupName = strtolower(str_replace(' ', '_', $customer->package->name));
                        $this->radiusService->assignUserToGroup($customer->radius_username, $groupName);
                    }

                    $this->line("<fg=green>✓ SYNCED</>");
                    $synced++;
                } else {
                    $this->line("<fg=red>✗ FAILED</> - {$result['message']}");
                    $failed++;
                }
            } catch (\Exception $e) {
                $this->line("<fg=red>✗ ERROR</> - {$e->getMessage()}");
                $failed++;
            }
        }

        $this->newLine();
        $this->info("Synchronization complete!");
        $this->line("Synced: <fg=green>$synced</>");
        $this->line("Skipped: <fg=yellow>$skipped</>");
        $this->line("Failed: <fg=red>$failed</>");

        return 0;
    }
}
