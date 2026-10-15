<?php

namespace App\Console\Commands;

use App\Models\HotspotCustomer;
use App\Models\Site;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

class PurgeExpiredHotspotCustomers extends Command
{
    protected $signature = 'hotspot:purge-expired';

    protected $description = 'Purge hotspot customers expired for more than one month, retaining payments';

    public function handle(): int
    {
        $purged = 0;
        $failed = 0;
        $expiryCutoff = now()->subMonth();

        HotspotCustomer::query()
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<', $expiryCutoff)
            ->orderBy('id')
            ->chunkById(100, function (Collection $customers) use (&$purged, &$failed, $expiryCutoff) {
                foreach ($customers as $customer) {
                    if (! HotspotCustomer::query()->whereKey($customer->id)->exists()) {
                        continue;
                    }

                    try {
                        $customersToDelete = $this->collectDependentCustomers($customer, $expiryCutoff);
                        $this->deleteRadiusData($customersToDelete);
                        $this->deleteCustomerData($customersToDelete);
                        $purged += count($customersToDelete);
                    } catch (Throwable $exception) {
                        $failed++;
                        $this->error("Unable to purge hotspot customer {$customer->id}: {$exception->getMessage()}");
                        Log::error('Failed to purge expired hotspot customer.', [
                            'customer_id' => $customer->id,
                            'exception' => $exception,
                        ]);
                    }
                }
            });

        $this->info("Purged {$purged} expired hotspot customer(s).");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function collectDependentCustomers(HotspotCustomer $customer, Carbon $expiryCutoff): Collection
    {
        $customers = collect();
        $pending = collect([$customer]);

        while ($pending->isNotEmpty()) {
            /** @var HotspotCustomer $current */
            $current = $pending->shift();

            if ($customers->has($current->id)) {
                continue;
            }

            $customers->put($current->id, $current);

            $current->children()
                ->where('is_independent', false)
                ->whereNotNull('expiry_date')
                ->where('expiry_date', '<', $expiryCutoff)
                ->get()
                ->each(fn (HotspotCustomer $child) => $pending->push($child));
        }

        return $customers->values();
    }

    private function deleteRadiusData(Collection $customers): void
    {
        $radius = DB::connection('radius');
        $radiusSchema = Schema::connection('radius');

        foreach ($customers->groupBy('organization_id') as $organizationId => $organizationCustomers) {
            $nasIps = Site::query()
                ->where('organization_id', $organizationId)
                ->get(['ip_address', 'backup_ip_address'])
                ->flatMap(fn (Site $site) => [$site->ip_address, $site->backup_ip_address])
                ->map(fn ($ip) => trim((string) $ip))
                ->filter(fn (string $ip) => $ip !== '')
                ->unique()
                ->values()
                ->all();

            if ($nasIps === []) {
                throw new \RuntimeException(
                    "Organization {$organizationId} has no NAS IPs configured; RADIUS session records cannot be safely scoped."
                );
            }

            $radius->transaction(function () use ($radius, $radiusSchema, $organizationCustomers, $organizationId, $nasIps) {
                foreach ($organizationCustomers as $customer) {
                    $radcheckColumns = $radiusSchema->getColumnListing('radcheck');
                    $radcheckQuery = $radius->table('radcheck');

                    if (in_array('organization_id', $radcheckColumns, true)) {
                        $radcheckQuery->where('organization_id', $organizationId);
                    }

                    if (in_array('sub_group_id', $radcheckColumns, true)) {
                        $radcheckQuery->where('sub_group_id', $customer->id);
                    } elseif ($customer->radius_username !== null && $customer->radius_username !== '') {
                        $radcheckQuery->where('username', $customer->radius_username);
                    } else {
                        $radcheckQuery->whereRaw('1 = 0');
                    }

                    $usernames = $radcheckQuery->pluck('username')
                        ->push($customer->radius_username)
                        ->filter(fn ($username) => is_string($username) && $username !== '')
                        ->unique()
                        ->values()
                        ->all();

                    $deleteCustomerPolicy = function (string $table) use ($radius, $radiusSchema, $customer, $organizationId, $usernames) {
                        $columns = $radiusSchema->getColumnListing($table);
                        $query = $radius->table($table)
                            ->when(in_array('organization_id', $columns, true), function ($query) use ($organizationId) {
                                $query->where('organization_id', $organizationId);
                            });

                        $hasSubGroupId = in_array('sub_group_id', $columns, true);
                        if (! $hasSubGroupId && $usernames === []) {
                            return;
                        }

                        $query->where(function ($query) use ($customer, $usernames, $hasSubGroupId) {
                            if ($hasSubGroupId) {
                                $query->where('sub_group_id', $customer->id);
                            }

                            if ($usernames !== []) {
                                if ($hasSubGroupId) {
                                    $query->orWhereIn('username', $usernames);
                                } else {
                                    $query->whereIn('username', $usernames);
                                }
                            }
                        })->delete();
                    };

                    $deleteCustomerPolicy('radcheck');
                    $deleteCustomerPolicy('radreply');
                    $deleteCustomerPolicy('radusergroup');

                    if ($usernames !== []) {
                        $radius->table('radacct')
                            ->whereIn('username', $usernames)
                            ->whereIn('nasipaddress', $nasIps)
                            ->delete();

                        $radius->table('radpostauth')
                            ->whereIn('username', $usernames)
                            ->whereIn('nasipaddress', $nasIps)
                            ->delete();
                    }
                }
            });
        }
    }

    private function deleteCustomerData(Collection $customers): void
    {
        DB::transaction(function () use ($customers) {
            $customerIds = $customers->pluck('id')->all();

            DB::table('hotspot_customers')
                ->whereIn('parent_id', $customerIds)
                ->whereNotIn('id', $customerIds)
                ->update(['parent_id' => null]);

            DB::table('hotspot_transactions')->whereIn('customer_id', $customerIds)->delete();
            DB::table('hotspot_devices')->whereIn('customer_id', $customerIds)->delete();
            DB::table('hotspot_customers')->whereIn('id', $customerIds)->delete();
        });
    }
}
