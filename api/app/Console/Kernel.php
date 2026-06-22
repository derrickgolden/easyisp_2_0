<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // $schedule->command('mikrotik:poll-users')->everySecond();
        // $schedule->command('app:poll-traffic')->everySecond();

        if ((bool) env('REVERB_RANDOM_TEST_ENABLED', false)) {
            $schedule->command('reverb:broadcast-random')->everySecond();
        }

        // Use the $schedule variable provided in the function arguments
        $schedule->command('router:sync-status')->everyMinute();

        $schedule->command('radius:auto-bind')->everyFiveMinutes()->withoutOverlapping();

        $schedule->command('radius:close-stale-sessions')->everyFiveMinutes()->withoutOverlapping();

        $schedule->command('isp:check-expirations')->everyMinute()->withoutOverlapping();

        $schedule->command('license:generate-monthly-bills')->monthlyOn(28, '02:36')->withoutOverlapping();

        $schedule->command('license:sync-organization-statuses')->monthlyOn(5, '10:00')->withoutOverlapping();

        $schedule->command('radius:cleanup-logs')->daily()->withoutOverlapping();

        // Demo payment for organization_id = 5 every morning at 09:00 (production: org_5, local: org_2)
        $schedule->command('demo:create-payment', ['--organization-id' => env('DEMO_ORG_ID', 2)])
            ->dailyAt('09:00')
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
