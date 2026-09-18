<?php

namespace Tests\Unit;

use App\Models\Customer;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Mockery;
use Tests\TestCase;

class ExpiryWarningSyncTest extends TestCase
{
    public function test_sync_subscription_updates_warning_flag_for_active_customer_with_future_expiry(): void
    {
        $customer = Mockery::mock(Customer::class)->makePartial();
        $customer->id = 42;
        $customer->status = 'active';
        $customer->parent_id = null;
        $customer->is_independent = true;
        $customer->expiry_date = Carbon::now()->addHours(47)->format('Y-m-d H:i:s');
        $customer->expiry_warning_sent_at = null;
        $customer->expiry_one_hour_warning_sent_at = null;
        $customer->phone = '254712345678';
        $customer->balance = 0;
        $customer->organization = (object) [
            'id' => 7,
            'name' => 'Test ISP',
            'settings' => [
                'sms-gateway' => [
                    'provider' => 'Unsupported',
                    'api_key' => 'fake-key',
                ],
            ],
        ];

        $customer->shouldReceive('update')
            ->once()
            ->with(Mockery::on(function (array $updates): bool {
                return array_key_exists('expiry_warning_sent_at', $updates);
            }))
            ->andReturnTrue();

        $service = new SubscriptionService();
        $service->syncSubscription($customer);

        $customer->shouldHaveReceived('update')->once();
    }
}
