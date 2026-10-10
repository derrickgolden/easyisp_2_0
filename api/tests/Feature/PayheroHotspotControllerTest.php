<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Payments\PayheroPaymentController;
use App\Http\Controllers\Api\Payments\PayheroHotspotController;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Package;
use Illuminate\Http\Request;
use Tests\TestCase;

class PayheroHotspotControllerTest extends TestCase
{
    public function test_it_maps_invalid_channel_errors_to_actionable_message(): void
    {
        $response = new class {
            public function json(): array
            {
                return [
                    'error_code' => 'invalid_argument',
                    'error_message' => 'The passed channel does not belong to the account',
                ];
            }

            public function body(): string
            {
                return json_encode([
                    'error_code' => 'invalid_argument',
                    'error_message' => 'The passed channel does not belong to the account',
                ]);
            }
        };

        $controller = app(PayheroHotspotController::class);
        $message = $controller->resolvePayheroErrorMessage($response);

        $this->assertStringContainsString('channel ID', $message);
        $this->assertStringContainsString('same Payhero account', $message);
    }

    public function test_it_applies_a_successful_pppoe_payhero_callback_to_the_customer_balance(): void
    {
        $organization = Organization::create([
            'name' => 'Test ISP',
            'acronym' => 'T' . substr(uniqid(), -3),
            'subscription_tier' => 'lite',
            'status' => 'active',
            'client_type' => 'PPPoE',
            'balance' => 0.00,
            'callback_token' => 'pppoe-token-' . substr(uniqid(), -4),
        ]);

        $package = Package::create([
            'organization_id' => $organization->id,
            'name' => 'Silver',
            'speed_up' => '10M',
            'speed_down' => '10M',
            'price' => 1000.00,
            'validity_days' => 30,
            'type' => 'time',
            'status' => 'pppoe',
        ]);

        $customer = Customer::create([
            'organization_id' => $organization->id,
            'package_id' => $package->id,
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'jane@example.com',
            'phone' => '254714475702',
            'location' => 'Nairobi',
            'connection_type' => 'PPPoE',
            'status' => 'active',
            'balance' => 10.00,
            'radius_username' => 'jane_user',
            'radius_password' => 'secret123',
            'password' => 'secret123',
        ]);

        $receiptNumber = 'PAYHERO-' . strtoupper(substr(md5(uniqid('', true)), 0, 10));

        $request = Request::create('/api/payments/payhero/' . $organization->callback_token . '/stk/callback', 'POST', [
            'status' => true,
            'response' => [
                'ResultCode' => 0,
                'Amount' => 5,
                'MpesaReceiptNumber' => $receiptNumber,
                'Phone' => '254714475702',
                'ExternalReference' => 'ORG-' . $organization->id . '-INV-1791532369',
                'ResultDesc' => 'The service request is processed successfully.',
            ],
        ]);

        $controller = app(PayheroPaymentController::class);
        $response = $controller->stkCallback($request, $organization->callback_token);

        $this->assertSame(200, $response->getStatusCode());

        $customer->refresh();
        $this->assertSame('15.00', (string) $customer->balance);

        $this->assertDatabaseHas('payments', [
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'mpesa_code' => $receiptNumber,
            'amount' => '5.00',
            'phone' => '254714475702',
            'status' => 'completed',
        ]);

        $this->assertDatabaseHas('transactions', [
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'type' => 'credit',
            'category' => 'payment',
            'method' => 'mpesa',
            'reference_id' => $receiptNumber,
        ]);
    }
}
