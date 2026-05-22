<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class IncomingPaymentService
{
    public function __construct(
        private readonly SubscriptionService $subscriptionService,
        private readonly CustomerMessagingService $customerMessagingService,
    ) {
    }

    /**
     * Process a C2B payment with idempotency and optional customer auto-application.
     *
     * @return array{duplicate: bool, payment: ?Payment}
     */
    public function processC2BPayment(
        Organization $organization,
        ?Customer $customer,
        string $mpesaCode,
        float $amount,
        ?string $billRef,
        ?string $phone,
        ?string $senderName,
    ): array {
        if (Payment::where('mpesa_code', $mpesaCode)->exists()) {
            Log::info('C2B Confirmation duplicate payment ignored', [
                'mpesa_code' => $mpesaCode,
            ]);

            return [
                'duplicate' => true,
                'payment' => null,
            ];
        }

        $payment = DB::transaction(function () use ($organization, $customer, $mpesaCode, $amount, $billRef, $phone, $senderName) {
            $payment = Payment::create([
                'organization_id' => $organization->id,
                'customer_id' => $customer?->id,
                'mpesa_code' => $mpesaCode,
                'amount' => $amount,
                'bill_ref' => $billRef,
                'phone' => $phone,
                'sender_name' => $senderName,
                'status' => $customer ? 'completed' : 'pending',
            ]);

            if ($customer) {
                $balanceBefore = (float) $customer->balance;
                $customer->increment('balance', $amount);
                $customer->refresh();

                Transaction::create([
                    'organization_id' => $organization->id,
                    'customer_id' => $customer->id,
                    'amount' => $amount,
                    'type' => 'credit',
                    'category' => 'payment',
                    'method' => 'mpesa',
                    'description' => 'C2B Paybill Payment',
                    'balance_before' => $balanceBefore,
                    'balance_after' => $customer->balance,
                    'reference_id' => $mpesaCode,
                ]);

                // If expired and balance is sufficient, this auto-activates.
                $this->subscriptionService->syncSubscription($customer);
            }

            return $payment;
        });

        if ($customer) {
            try {
                $this->customerMessagingService->send(
                    $customer,
                    CustomerMessagingService::TYPE_PAYMENT,
                    ['{PaidAmount}' => number_format($amount, 2)]
                );
            } catch (\Exception $e) {
                Log::warning('Payment SMS notification failed', [
                    'customer_id' => $customer->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return [
            'duplicate' => false,
            'payment' => $payment,
        ];
    }
}
