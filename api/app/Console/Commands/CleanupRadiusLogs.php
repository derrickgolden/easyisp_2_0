<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupRadiusLogs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'radius:cleanup-logs';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete old RADIUS logs, keeping only the 6 most recent for each user';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting RADIUS logs cleanup...');

        try {
            $radiusDb = DB::connection('radius');

            // Clean radacct table - keep 6 latest per user
            $this->info('Cleaning radacct table...');
            $deletedRadacct = $radiusDb->statement("
                DELETE FROM radacct
                WHERE radacctid IN (
                    SELECT radacctid FROM (
                        SELECT radacctid,
                               ROW_NUMBER() OVER (
                                   PARTITION BY username 
                                   ORDER BY acctstarttime DESC
                               ) AS rn
                        FROM radacct
                    ) t
                    WHERE t.rn > 6
                )
            ");

            $this->info('radacct cleanup executed successfully.');

            // Clean radpostauth table - keep 6 latest per user
            $this->info('Cleaning radpostauth table...');
            $deletedRadpostauth = $radiusDb->statement("
                DELETE FROM radpostauth
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id,
                               ROW_NUMBER() OVER (
                                   PARTITION BY username 
                                   ORDER BY authdate DESC
                               ) AS rn
                        FROM radpostauth
                    ) t
                    WHERE t.rn > 6
                )
            ");

            $this->info('radpostauth cleanup executed successfully.');

            $this->info('✓ RADIUS logs cleanup completed successfully!');
            $this->info('Kept 6 most recent logs per user from radacct and radpostauth tables.');

        } catch (\Exception $e) {
            $this->error('Error during RADIUS logs cleanup: ' . $e->getMessage());
            return 1;
        }

        return 0;
    }
}
