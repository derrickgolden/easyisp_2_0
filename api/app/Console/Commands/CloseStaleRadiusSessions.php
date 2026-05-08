<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CloseStaleRadiusSessions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'radius:close-stale-sessions';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Close stale RADIUS accounting sessions that stopped sending updates';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Closing stale RADIUS sessions...');

        try {
            $affectedRows = DB::connection('radius')->affectingStatement("
                UPDATE radacct
                SET
                    acctstoptime = NOW(),
                    acctterminatecause = 'Stale-Session'
                WHERE
                    acctstoptime IS NULL
                    AND acctupdatetime IS NOT NULL
                    AND acctupdatetime < (NOW() - INTERVAL 10 MINUTE)
                    AND acctstarttime < (NOW() - INTERVAL 15 MINUTE)
            ");
        } catch (\Throwable $exception) {
            $this->error('Failed to close stale RADIUS sessions: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Closed {$affectedRows} stale RADIUS session(s).");

        return self::SUCCESS;
    }
}