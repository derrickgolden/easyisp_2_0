<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Transaction;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class PaymentController extends Controller
{
    public function c2bValidation(Request $request)
    {
        Log::info('C2B Validation endpoint called', [
            'payload' => $request->all(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        // Basic validation endpoint for M-Pesa C2B
        return response()->json([
            'ResultCode' => 0,
            'ResultDesc' => 'Accepted',
        ]);
    }

    public function c2bConfirmation(Request $request)
    {
        $payload = $request->all();

        Log::info('C2B Confirmation endpoint called', [
            'payload' => $payload,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $mpesaCode = $payload['TransID'] ?? $payload['TransactionID'] ?? $payload['MpesaReceiptNumber'] ?? null;
        $amount = $payload['TransAmount'] ?? $payload['Amount'] ?? null;
        $billRef = $payload['BillRefNumber'] ?? $payload['AccountReference'] ?? $payload['BillRef'] ?? null;
        $phone = $payload['MSISDN'] ?? $payload['PhoneNumber'] ?? $payload['SenderPhone'] ?? null;
        $shortCode = $payload['BusinessShortCode'] ?? $payload['ShortCode'] ?? $payload['PayBillNumber'] ?? null;

        $firstName = $payload['FirstName'] ?? '';
        $middleName = $payload['MiddleName'] ?? '';
        $lastName = $payload['LastName'] ?? '';
        $senderName = trim("{$firstName} {$middleName} {$lastName}") ?: null;

        Log::debug('C2B Confirmation parsed data', [
            'mpesa_code' => $mpesaCode,
            'amount' => $amount,
            'bill_ref' => $billRef,
            'phone' => $phone,
            'short_code' => $shortCode,
            'sender_name' => $senderName,
        ]);

        if (!$mpesaCode || !$amount || !$phone || !is_numeric($amount) || (float) $amount <= 0) {
            Log::warning('C2B Confirmation invalid payload', [
                'mpesa_code' => $mpesaCode,
                'amount' => $amount,
                'phone' => $phone,
            ]);
            return response()->json([
                'ResultCode' => 1,
                'ResultDesc' => 'Invalid payload',
            ], 400);
        }

        // Idempotency: if already processed, acknowledge
        if (Payment::where('mpesa_code', $mpesaCode)->exists()) {
            Log::info('C2B Confirmation duplicate payment ignored', [
                'mpesa_code' => $mpesaCode,
            ]);
            return response()->json([
                'ResultCode' => 0,
                'ResultDesc' => 'Duplicate ignored',
            ]);
        }

        // Resolve organization by paybill shortcode from settings
        $organization = null;
        if ($shortCode) {
            $organization = Organization::where('settings->payment-gateway->paybill', $shortCode)
                ->orWhere('settings->payment-gateway->paybill_short_code', $shortCode)
                ->first();
        }

        if (!$organization) {
            Log::warning('C2B payment received but paybill not configured or unmatched.', [
                'shortcode' => $shortCode,
                'mpesa_code' => $mpesaCode,
            ]);

            return response()->json([
                'ResultCode' => 1,
                'ResultDesc' => 'Paybill not configured',
            ], 400);
        }

        $customer = $this->resolveCustomer($organization->id, $billRef, $phone);

        Log::info('C2B Confirmation customer resolution', [
            'organization_id' => $organization->id,
            'customer_id' => $customer?->id,
            'customer_found' => $customer !== null,
            'bill_ref' => $billRef,
            'phone' => $phone,
        ]);

        try {
            DB::beginTransaction();

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
                $balanceBefore = $customer->balance;
                $customer->increment('balance', $amount);

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

                // If expired and balance is sufficient, this will auto-activate
                app(SubscriptionService::class)->syncSubscription($customer);
            }

            DB::commit();

            Log::info('C2B Confirmation payment processed successfully', [
                'payment_id' => $payment->id,
                'customer_id' => $customer?->id,
                'amount' => $amount,
                'mpesa_code' => $mpesaCode,
                'status' => $payment->status,
            ]);

            return response()->json([
                'ResultCode' => 0,
                'ResultDesc' => 'Accepted',
                'payment_id' => $payment->id,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('C2B payment processing failed', [
                'error' => $e->getMessage(),
                'mpesa_code' => $mpesaCode,
            ]);

            return response()->json([
                'ResultCode' => 1,
                'ResultDesc' => 'Processing error',
            ], 500);
        }
    }

    public function registerC2BUrls(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'paybill' => 'required|string',
            'consumer_key' => 'required|string',
            'consumer_secret' => 'required|string',
            'environment' => 'nullable|string',
            'response_type' => 'nullable|in:Completed,Cancelled',
            'confirmation_url' => 'nullable|url',
            'validation_url' => 'nullable|url',
        ]);

        if ($validator->fails()) {
            Log::warning('C2B URL registration validation failed', [
                'errors' => $validator->errors()->toArray(),
            ]);
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $environment = strtolower($request->input('environment', 'production'));
        $baseUrl = str_contains($environment, 'sandbox')
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

        $appUrl = rtrim(config('app.url') ?: $request->getSchemeAndHttpHost(), '/');
        $confirmationUrl = $request->input('confirmation_url', $appUrl . '/api/payments/c2b/confirmation');
        $validationUrl = $request->input('validation_url', $appUrl . '/api/payments/c2b/validation');

        Log::info('C2B URL registration initiated', [
            'paybill' => $request->paybill,
            'environment' => $environment,
            'base_url' => $baseUrl,
            'confirmation_url' => $confirmationUrl,
            'validation_url' => $validationUrl,
            'response_type' => $request->input('response_type', 'Completed'),
            'custom_urls_provided' => $request->has('confirmation_url') || $request->has('validation_url'),
        ]);

        try {
            Log::debug('Requesting M-Pesa OAuth token', [
                'endpoint' => $baseUrl . '/oauth/v1/generate',
                'consumer_key_prefix' => substr($request->consumer_key, 0, 8) . '...',
            ]);

            $tokenResponse = Http::withBasicAuth(
                $request->consumer_key,
                $request->consumer_secret
            )->get($baseUrl . '/oauth/v1/generate', [
                'grant_type' => 'client_credentials',
            ]);

            if (!$tokenResponse->ok()) {
                return response()->json([
                    'message' => 'Failed to generate M-Pesa access token',
                    'details' => $tokenResponse->json() ?? $tokenResponse->body(),
                ], $tokenResponse->status());
            }

            $accessToken = $tokenResponse->json('access_token');
            if (!$accessToken) {
                Log::error('Missing access token in M-Pesa response', [
                    'response' => $tokenResponse->json(),
                ]);
                return response()->json([
                    'message' => 'Missing access token from M-Pesa response',
                ], 500);
            }

            Log::debug('Registering C2B URLs with M-Pesa', [
                'endpoint' => $baseUrl . '/mpesa/c2b/v1/registerurl',
                'short_code' => $request->paybill,
            ]);

            $registerResponse = Http::withToken($accessToken)
                ->post($baseUrl . '/mpesa/c2b/v1/registerurl', [
                    'ShortCode' => $request->paybill,
                    'ResponseType' => $request->input('response_type', 'Completed'),
                    'ConfirmationURL' => $confirmationUrl,
                    'ValidationURL' => $validationUrl,
                ]);

            Log::info('M-Pesa C2B URL registration response received', [
                'status' => $registerResponse->status(),
                'success' => $registerResponse->ok(),
                'response' => $registerResponse->json() ?? $registerResponse->body(),
            ]);

            if (!$registerResponse->ok()) {
                Log::error('Failed to register C2B URLs', [
                    'status' => $registerResponse->status(),
                    'response' => $registerResponse->json() ?? $registerResponse->body(),
                ]);
                return response()->json([
                    'message' => 'Failed to register C2B URLs',
                    'details' => $registerResponse->json() ?? $registerResponse->body(),
                ], $registerResponse->status());
            }

            Log::info('C2B URLs registered successfully', [
                'paybill' => $request->paybill,
                'confirmation_url' => $confirmationUrl,
                'validation_url' => $validationUrl,
            ]);

            return response()->json([
                'message' => 'C2B URLs registered successfully',
                'confirmation_url' => $confirmationUrl,
                'validation_url' => $validationUrl,
                'response' => $registerResponse->json(),
            ]);
        } catch (\Exception $e) {
            Log::error('C2B URL registration failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'paybill' => $request->paybill,
                'environment' => $environment,
                'confirmation_url' => $confirmationUrl,
                'validation_url' => $validationUrl,
            ]);

            return response()->json([
                'message' => 'Error registering C2B URLs: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function pending(Request $request)
    {
        $payments = Payment::where('organization_id', $request->user()->organization_id)
            ->where('status', 'pending')
            ->orderByDesc('created_at')
            ->paginate(15);

        return PaymentResource::collection($payments);
    }

    public function resolvePending(Request $request, $paymentId)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $payment = Payment::where('organization_id', $request->user()->organization_id)
            ->where('id', $paymentId)
            ->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($payment->status !== 'pending') {
            return response()->json(['message' => 'Only pending payments can be resolved'], 400);
        }

        $customer = Customer::where('organization_id', $request->user()->organization_id)
            ->where('id', $request->customer_id)
            ->first();

        if (!$customer) {
            return response()->json(['message' => 'Customer not found in organization'], 404);
        }

        try {
            DB::beginTransaction();

            $payment->update([
                'customer_id' => $customer->id,
                'status' => 'completed',
            ]);

            $balanceBefore = $customer->balance;
            $customer->increment('balance', $payment->amount);

            Transaction::create([
                'organization_id' => $request->user()->organization_id,
                'customer_id' => $customer->id,
                'amount' => $payment->amount,
                'type' => 'credit',
                'category' => 'payment',
                'method' => 'mpesa',
                'description' => 'Resolved pending payment',
                'balance_before' => $balanceBefore,
                'balance_after' => $customer->balance,
                'reference_id' => $payment->mpesa_code,
            ]);

            app(SubscriptionService::class)->syncSubscription($customer);

            DB::commit();

            return response()->json([
                'message' => 'Payment resolved and applied',
                'payment' => new PaymentResource($payment->fresh()),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error resolving payment: ' . $e->getMessage()], 500);
        }
    }

    private function resolveCustomer(int $organizationId, ?string $billRef, ?string $phone): ?Customer
    {
        $query = Customer::where('organization_id', $organizationId);

        if ($billRef) {
            if (is_numeric($billRef)) {
                $customer = (clone $query)->where('id', (int) $billRef)->first();
                if ($customer) {
                    return $customer;
                }
            }

            $customer = (clone $query)->where('radius_username', $billRef)->first();
            if ($customer) {
                return $customer;
            }
        }

        if ($phone) {
            $candidates = $this->normalizePhoneCandidates($phone);
            foreach ($candidates as $candidate) {
                $customer = (clone $query)->where('phone', $candidate)->first();
                if ($customer) {
                    return $customer;
                }
            }
        }

        return null;
    }

    private function normalizePhoneCandidates(string $phone): array
    {
        $digits = preg_replace('/\D+/', '', $phone);
        $candidates = [$phone];

        if ($digits) {
            $candidates[] = $digits;

            if (str_starts_with($digits, '0')) {
                $candidates[] = '254' . ltrim($digits, '0');
                $candidates[] = '+254' . ltrim($digits, '0');
            }

            if (str_starts_with($digits, '254')) {
                $candidates[] = '0' . substr($digits, 3);
                $candidates[] = '+'.$digits;
            }
        }

        return array_values(array_unique(array_filter($candidates)));
    }

    public function index(Request $request)
    {
        $payments = Payment::where('organization_id', $request->user()->organization_id)
            ->orderByDesc('created_at')
            ->paginate(15);
        return PaymentResource::collection($payments);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'nullable|exists:customers,id',
            'mpesa_code' => 'required|string|unique:payments',
            'amount' => 'required|numeric|min:0.01',
            'bill_ref' => 'nullable|string',
            'phone' => 'required|string',
            'sender_name' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $payment = Payment::create(array_merge($request->all(), [
                'organization_id' => $request->user()->organization_id,
                'status' => 'completed',
            ]));

            // Update customer balance if customer_id is provided
            if ($request->customer_id) {
                $customer = Customer::find($request->customer_id);
                $balanceBefore = $customer->balance;
                $customer->increment('balance', $request->amount);

                Transaction::create([
                    'organization_id' => $request->user()->organization_id,
                    'customer_id' => $request->customer_id,
                    'amount' => $request->amount,
                    'type' => 'credit',
                    'category' => 'payment',
                    'method' => 'mpesa',
                    'description' => 'Payment via M-Pesa',
                    'balance_before' => $balanceBefore,
                    'balance_after' => $customer->balance,
                    'reference_id' => $request->mpesa_code,
                ]);

                app(SubscriptionService::class)->syncSubscription($customer);
            }

            DB::commit();

            return response()->json([
                'message' => 'Payment recorded successfully',
                'payment' => new PaymentResource($payment),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error processing payment: ' . $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        $payment = Payment::find($id);
        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }
        return new PaymentResource($payment);
    }

    public function update(Request $request, $id)
    {
        $payment = Payment::find($id);
        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'sometimes|in:completed,pending,reversed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $payment->update($request->all());

        return response()->json([
            'message' => 'Payment updated successfully',
            'payment' => new PaymentResource($payment),
        ]);
    }

    public function getByCustomer($customerId)
    {
        $payments = Payment::where('customer_id', $customerId)
            ->orderByDesc('created_at')
            ->paginate(15);
        return PaymentResource::collection($payments);
    }
}
