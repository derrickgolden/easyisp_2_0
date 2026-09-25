<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\OrganizationPaymentGateway;
use Illuminate\Console\Command;

class ImportPaymentGateways extends Command
{
    protected $signature = 'import:payment-gateways';

    protected $description = 'Import existing organization payment-gateway settings into organization_payment_gateways table';

    public function handle()
    {
        $this->info('Starting import of payment gateways...');

        $count = 0;
        Organization::chunk(100, function ($orgs) use (&$count) {
            foreach ($orgs as $org) {
                $raw = $org->settings ?? [];
                $payment = data_get($raw, 'payment-gateway');
                if (empty($payment)) {
                    continue;
                }

                if (is_string($payment)) {
                    $decoded = json_decode($payment, true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        $payment = $decoded;
                    }
                }

                if (!is_array($payment)) {
                    continue;
                }

                $provider = data_get($payment, 'provider') ?: data_get($payment, 'name') ?: 'mpesa';
                if (!$provider) {
                    // If no explicit provider, skip creating a row - keep legacy settings
                    continue;
                }

                $superAdmin = $org->users()
                    ->where('is_super_admin', true)
                    ->orderBy('id')
                    ->first();

                $gateway = OrganizationPaymentGateway::firstOrNew([
                    'organization_id' => $org->id,
                    'provider' => $provider,
                ]);

                $gateway->fill([
                    'config' => $payment,
                    'is_default' => true,
                    'active' => true,
                    'created_by' => $superAdmin?->id,
                ]);

                $gateway->save();

                $count++;
            }
        });

        $this->info("Imported {$count} payment gateway(s).");
        return 0;
    }
}
