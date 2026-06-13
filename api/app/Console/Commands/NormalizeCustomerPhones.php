<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Services\PhoneNumberService;
use Illuminate\Console\Command;

class NormalizeCustomerPhones extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'customers:normalize-phones {--dry-run : Show changes without saving} {--organization= : Filter by organization id} {--batch=500 : Process this many records at a time}';

    /**
     * The description of the console command.
     *
     * @var string
     */
    protected $description = 'Normalize customer phone numbers to 254XXXXXXXXX format';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $organizationId = $this->option('organization');
        $batchSize = (int) $this->option('batch');

        $query = Customer::query()
            ->whereNotNull('phone')
            ->where('phone', '!=', '');

        if ($organizationId) {
            $query->where('organization_id', $organizationId);
        }

        $total = $query->count();
        if ($total === 0) {
            $this->info('No customer phone records found to process.');
            return 0;
        }

        $this->info("Found {$total} customer phone records to inspect.");
        if ($dryRun) {
            $this->info('Running in dry-run mode; no changes will be saved.');
        }

        $updated = 0;
        $skipped = 0;
        $invalid = 0;
        $duplicates = 0;
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->orderBy('id')->chunk($batchSize, function ($customers) use (&$updated, &$skipped, &$invalid, &$duplicates, $dryRun, $bar) {
            foreach ($customers as $customer) {
                $original = trim((string) $customer->phone);
                $normalized = PhoneNumberService::normalizeToE164($original);

                if ($normalized === null) {
                    $invalid++;
                    $skipped++;
                    $this->line('');
                    $this->warn("Skipping customer {$customer->id}: invalid phone '{$original}'");
                    $bar->advance();
                    continue;
                }

                if ($normalized === $original) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }

                $existing = Customer::where('phone', $normalized)
                    ->where('id', '!=', $customer->id)
                    ->first();

                if ($existing) {
                    $duplicates++;
                    $skipped++;
                    $this->line('');
                    $this->warn("Skipping customer {$customer->id}: normalized phone '{$normalized}' already exists on customer {$existing->id}");
                    $bar->advance();
                    continue;
                }

                $updated++;
                $bar->advance();

                if (!$dryRun) {
                    $customer->phone = $normalized;
                    $customer->save();
                }
            }
        });

        $bar->finish();
        $this->line('');

        $this->info('Normalization complete.');
        $this->line("Updated: {$updated}");
        $this->line("Skipped (already normalized or invalid): {$skipped}");
        $this->line("Invalid phone values: {$invalid}");
        $this->line("Duplicate normalized values skipped: {$duplicates}");

        if ($dryRun) {
            $this->info('Dry-run complete; no database changes were made.');
        }

        return 0;
    }
}
