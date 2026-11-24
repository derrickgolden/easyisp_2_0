<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\PaymentController;
use App\Models\Organization;
use App\Models\OrganizationPaymentGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DarajaTransactionStatusTest extends TestCase
{
    public function test_it_queries_daraja_and_exposes_the_async_transaction_result(): void
    {
        $organization = Organization::create([
            'name' => 'Status Test ISP',
            'acronym' => 'S' . strtoupper(substr(uniqid(), -3)),
            'subscription_tier' => 'lite',
            'status' => 'active',
            'client_type' => 'PPPoE',
            'balance' => 0,
            'callback_token' => 'status-test-' . uniqid(),
        ]);

        OrganizationPaymentGateway::create([
            'organization_id' => $organization->id,
            'provider' => 'mpesa',
            'active' => true,
            'config' => [
                'paybill' => '123456',
                'consumer_key' => 'consumer-key',
                'consumer_secret' => 'consumer-secret',
                'initiator_name' => 'api-initiator',
                'security_credential' => 'encrypted-credential',
                'environment' => 'Production',
            ],
        ]);

        Http::fake([
            'api.safaricom.co.ke/oauth/*' => Http::response(['access_token' => 'daraja-token']),
            'api.safaricom.co.ke/mpesa/transactionstatus/v1/query' => Http::response([
                'ResponseCode' => '0',
                'OriginatorConversationID' => 'origin-123',
                'ResponseDescription' => 'Accepted',
            ]),
        ]);

        $request = Request::create('/api/payments/daraja/transaction-status', 'POST', [
            'receipt' => 'QAB12CD34E',
        ]);
        $request->setUserResolver(fn () => (object) [
            'organization' => $organization,
            'organization_id' => $organization->id,
        ]);

        $controller = app(PaymentController::class);
        $submitted = $controller->checkDarajaTransactionStatus($request);

        $this->assertSame(202, $submitted->getStatusCode());
        $this->assertSame('pending', $submitted->getData(true)['status']);

        Http::assertSent(function ($request) use ($organization): bool {
            return str_ends_with($request->url(), '/mpesa/transactionstatus/v1/query')
                && $request['TransactionID'] === 'QAB12CD34E'
                && $request['ResultURL'] === url(
                    '/api/payments/daraja/' . $organization->callback_token . '/transaction-status/callback'
                );
        });

        $callback = Request::create('/api/payments/daraja/callback', 'POST', [
            'Result' => [
                'OriginatorConversationID' => 'origin-123',
                'ResultCode' => 0,
                'ResultDesc' => 'The service request is processed successfully.',
                'ResultParameters' => [
                    'ResultParameter' => [
                        ['Key' => 'TransactionStatus', 'Value' => 'Completed'],
                    ],
                ],
            ],
        ]);
        $controller->darajaTransactionStatusCallback($callback, $organization->callback_token);

        $poll = Request::create('/api/payments/daraja/transaction-status/origin-123', 'GET');
        $poll->setUserResolver(fn () => (object) [
            'organization_id' => $organization->id,
        ]);
        $result = $controller->getDarajaTransactionStatusResult($poll, 'origin-123')->getData(true);

        $this->assertSame('Completed', $result['status']);
        $this->assertSame('completed', $result['query_status']);
        $this->assertSame('QAB12CD34E', $result['receipt']);
        $this->assertSame('Completed', $result['transaction_status']);

        Cache::forget("daraja.transaction-status.{$organization->id}.origin-123");
    }
}
