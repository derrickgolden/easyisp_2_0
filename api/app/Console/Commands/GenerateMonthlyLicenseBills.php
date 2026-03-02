<?php

namespace App\Console\Commands;

use App\Services\LicenseBillingService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateMonthlyLicenseBills extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'license:generate-monthly-bills {--month= : Snapshot month in YYYY-MM format}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate monthly license bills based on active users per organization';

    /**
     * Execute the console command.
     */
    public function handle(LicenseBillingService $licenseBillingService): int
    {
        $monthOption = $this->option('month');
        $snapshotMonth = null;

        if ($monthOption) {
            try {
                $snapshotMonth = Carbon::createFromFormat('Y-m', $monthOption)->startOfMonth();
            } catch (\Throwable $exception) {
                $this->error('Invalid --month format. Use YYYY-MM.');
                return self::FAILURE;
            }
        }

        $result = $licenseBillingService->generateMonthlySnapshots($snapshotMonth);

        $this->info('Monthly license billing snapshot completed.');
        $this->line('Month: ' . $result['snapshot_month']);
        $this->line('Price per active user: KES ' . number_format($result['price_per_user'], 2));
        $this->line('Created: ' . $result['created']);
        $this->line('Already existed: ' . $result['existing']);

        return self::SUCCESS;
    }
}
