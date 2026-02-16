<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

use App\Models\Customer;
use App\Services\SubscriptionService;

class HandleExpiringUsers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'isp:check-expirations';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Checks for expired users and handles auto-renewal or redirection';

    /**
     * Execute the console command.
     */
    public function handle(SubscriptionService $service)
    {
        $this->info("Starting expiration check...");

        // Iterate through all active customers
        Customer::whereIn('status', ['active', 'expired'])->chunkById(100, function ($customers) use ($service) {
            foreach ($customers as $customer) {
                $service->syncSubscription($customer);
            }
        });

        $this->info("Expiration check complete.");
    }
}
