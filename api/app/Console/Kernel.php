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
        // Use the $schedule variable provided in the function arguments
        $schedule->command('router:sync-status')->everyMinute();

        $schedule->command('radius:auto-bind')->everyFiveMinutes()->withoutOverlapping();

        $schedule->command('isp:check-expirations')->everyMinute();

        $schedule->call(function () {
            DB::connection('radius')->table('radpostauth')
                ->where('authdate', '<', now()->subDays(30))
                ->delete();
        })->daily();
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
