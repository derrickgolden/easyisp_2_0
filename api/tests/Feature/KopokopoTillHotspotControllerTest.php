<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Payments\KopokopoTillHotspotController;
use App\Models\Customer;
use App\Models\HotspotCustomer;
use App\Models\HotspotPackage;
use App\Models\HotspotPayment;
use App\Models\Organization;
use App\Models\OrganizationPaymentGateway;
use App\Models\Package;
use App\Models\Site;
use Illuminate\Http\Request;
use Tests\TestCase;

class KopokopoTillHotspotControllerTest extends TestCase
{
    public function test_it_reads_kopokopo_settings_from_organization_payment_gateways(): void
    {
        $organization = Organization::create([
            'name' => 'Test Org',
            'acronym' => 'T' . substr(md5(uniqid('', true)), 0, 4),
            'status' => 'active',
            'subscription_tier' => 'lite',
        ]);

        OrganizationPaymentGateway::create([
            'organization_id' => $organization->id,
            'provider' => 'kopokopo',
            'config' => [
                'api_key' => 'test-api-key',
                'callback_url' => 'https://example.com/kopokopo/callback',
            ],
            'active' => true,
            'is_default' => true,
        ]);

        $controller = app(KopokopoTillHotspotController::class);
        $settings = $controller->resolveGatewaySettings(new Request(), $organization);

        $this->assertSame('test-api-key', data_get($settings, 'api_key'));
        $this->assertSame('https://example.com/kopokopo/callback', data_get($settings, 'callback_url'));
    }

    public function test_it_processes_a_successful_kopokopo_hotspot_callback_and_activates_the_customer(): void
    {
        $organization = Organization::create([
            'name' => 'Hotspot Org',
            'acronym' => 'HO' . substr(md5(uniqid('', true)), 0, 2),
            'status' => 'active',
            'subscription_tier' => 'pro',
            'callback_token' => 'hotspot-token-' . uniqid('', true),
        ]);

        $site = Site::create([
            'organization_id' => $organization->id,
            'name' => 'Main Site',
            'location' => 'Test Location',
            'ip_address' => '10.0.0.1',
        ]);

        $package = HotspotPackage::create([
            'organization_id' => $organization->id,
            'name' => 'Week Pass',
            'price' => 200,
            'validity' => 7,
            'validity_type' => 'days',
            'status' => 'hotspot',
            'speed_up' => 512,
            'speed_down' => 1024,
            'radius_group' => 'week-pass',
        ]);

        $invoiceNumber = 'HS-' . $organization->id . '-PKG-' . $package->id . '-MAC-B6:67:6E:47:D7:DF';

        $payment = HotspotPayment::create([
            'organization_id' => $organization->id,
            'site_id' => $site->id,
            'package_id' => $package->id,
            'phone' => '254712345678',
            'mac_address' => 'B6:67:6E:47:D7:DF',
            'ip_address' => '192.168.88.10',
            'amount' => 200,
            'account_reference' => $invoiceNumber,
            'checkout_request_id' => 'abc-123',
            'status' => 'pending',
        ]);

        $response = $this->postJson('/api/payments/kopokopo/hotspot/' . $organization->callback_token . '/callback', [
            'data' => [
                'attributes' => [
                    'status' => 'success',
                    'event' => [
                        'resource' => [
                            'amount' => 200,
                            'id' => 'KPO-RECEIPT-001',
                            'sender_phone_number' => '0712345678',
                        ],
                    ],
                    'metadata' => [
                        'invoiceNumber' => $invoiceNumber,
                        'mac' => 'B6:67:6E:47:D7:DF',
                    ],
                ],
            ],
        ]);

        $response->assertStatus(200);

        $payment->refresh();
        $this->assertSame('paid', $payment->status);
        $this->assertSame('KPO-RECEIPT-001', $payment->mpesa_receipt);

        $customer = HotspotCustomer::where('organization_id', $organization->id)
            ->where('phone', '254712345678')
            ->first();

        $this->assertNotNull($customer);
        $this->assertSame('active', $customer->status);
    }
}
