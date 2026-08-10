<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

use App\Models\HotspotCustomer;
use App\Services\HotspotSubscriptionService;

class HotspotHandleExpiringUsers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'isp:check-hotspot-expirations';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Checks for expired users and handles auto-renewal or redirection';

    /**
     * Execute the console command.
     */
    public function handle(HotspotSubscriptionService $service)
    {
        $this->info("Starting hotspot expiration check...");

        // Iterate through all active customers
        HotspotCustomer::whereIn('status', ['active', 'expired'])->chunkById(100, function ($customers) use ($service) {
            foreach ($customers as $customer) {
                $service->syncSubscription($customer);
            }
        });

        $this->info("Hotspot expiration check complete.");
    }
}
