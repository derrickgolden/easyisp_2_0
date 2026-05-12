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
    public function __construct()
    {
        $this->middleware('permission:manage-payments')->except([
            'index',
            'show',
            'pending',
            'getByCustomer',
            'c2bValidation',
            'c2bConfirmation',
        ]);
        $this->middleware('permission:view-payments')->only([
            'index',
            'show',
            'pending',
            'getByCustomer',
        ]);
    }

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

        $paybill = trim((string) $request->input('paybill'));
        $consumerKey = trim((string) $request->input('consumer_key'));
        $consumerSecret = trim((string) $request->input('consumer_secret'));
        $environment = strtolower(trim((string) $request->input('environment', 'production')));
        $baseUrl = str_contains($environment, 'sandbox')
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

        $appUrl = rtrim(config('app.url') ?: $request->getSchemeAndHttpHost(), '/');
        $confirmationUrl = trim((string) $request->input('confirmation_url', $appUrl . '/api/payments/c2b/confirmation'));
        $validationUrl = trim((string) $request->input('validation_url', $appUrl . '/api/payments/c2b/validation'));
        $responseType = $request->input('response_type', 'Completed');

        Log::info('C2B URL registration initiated', [
            'paybill' => $paybill,
            'environment' => $environment,
            'base_url' => $baseUrl,
            'confirmation_url' => $confirmationUrl,
            'validation_url' => $validationUrl,
            'response_type' => $responseType,
            'custom_url_provided' => $request->has('confirmation_url') || $request->has('validation_url'),
        ]);

        try {
            // Validate credentials format
            if (strlen($consumerKey) < 10 || strlen($consumerSecret) < 5) {
                return response()->json([
                    'message' => 'Invalid consumer credentials format. Ensure they are correctly copied from Daraja API.',
                    'hint' => 'Consumer key should be at least 10 characters, consumer secret at least 5 characters.',
                ], 422);
            }

            $tokenUrl = $baseUrl . '/oauth/v1/generate?grant_type=client_credentials';
            
            Log::debug('Requesting M-Pesa OAuth token', [
                'url' => $tokenUrl,
                'consumer_key_prefix' => substr($consumerKey, 0, 8) . '...',
                'consumer_key_suffix' => '...' . substr($consumerKey, -4),
                'consumer_key_length' => strlen($consumerKey),
                'consumer_secret_length' => strlen($consumerSecret),
                'paybill' => $paybill,
                'environment' => $environment,
            ]);

            $tokenResponse = Http::acceptJson()
                ->timeout(30)
                ->withBasicAuth($consumerKey, $consumerSecret)
                ->get($tokenUrl);

            Log::debug('M-Pesa OAuth response received', [
                'status' => $tokenResponse->status(),
                'content_type' => $tokenResponse->header('content-type'),
                'body_length' => strlen($tokenResponse->body()),
                'body_preview' => substr($tokenResponse->body(), 0, 200),
                'request_id' => $tokenResponse->header('x-request-id'),
            ]);

            if (!$tokenResponse->ok()) {
                $responseBody = $tokenResponse->body();
                $tokenError = [];
                
                // Try to parse as JSON first
                $jsonParsed = $tokenResponse->json();
                if (is_array($jsonParsed) && !empty($jsonParsed)) {
                    $tokenError = $jsonParsed;
                } else {
                    // Fall back to raw body
                    $tokenError = ['raw_body' => $responseBody];
                }

                $errorMessage = data_get($tokenError, 'errorMessage')
                    ?? data_get($tokenError, 'error_description')
                    ?? data_get($tokenError, 'error')
                    ?? data_get($tokenError, 'raw_body')
                    ?? 'Empty response from OAuth endpoint';

                // Provide helpful hints based on error pattern
                $hint = '';
                if ($tokenResponse->status() === 400 && empty($responseBody)) {
                    $hint = 'This usually means: (1) Consumer key and secret do not match this paybill, (2) Sandbox credentials are being used in Production mode (or vice versa), or (3) The credentials are invalid or expired. Verify in the Daraja dashboard that these credentials belong to the correct app and environment.';
                } elseif ($tokenResponse->status() === 401) {
                    $hint = 'Authentication failed. Verify that your consumer key and secret are correct and match the selected environment (Production vs Sandbox).';
                } elseif ($tokenResponse->status() === 403) {
                    $hint = 'Permission denied. This app may not have C2B registration permissions enabled. Contact Safaricom support to verify.';
                }

                Log::error('Failed to generate M-Pesa access token', [
                    'status' => $tokenResponse->status(),
                    'response' => $tokenError,
                    'paybill' => $paybill,
                    'environment' => $environment,
                    'consumer_key_prefix' => substr($consumerKey, 0, 8) . '...',
                ]);

                return response()->json([
                    'message' => 'Failed to generate M-Pesa access token: ' . $errorMessage,
                    'hint' => $hint,
                    'details' => $tokenError,
                ], $tokenResponse->status());
            }

            $accessToken = $tokenResponse->json('access_token')
                ?? $tokenResponse->json('accessToken');

            if (!$accessToken && str_contains($tokenResponse->body(), 'access_token=')) {
                parse_str($tokenResponse->body(), $parsedTokenResponse);
                $accessToken = $parsedTokenResponse['access_token'] ?? null;
            }

            if (!$accessToken) {
                Log::error('Missing access token in M-Pesa response', [
                    'response' => $tokenResponse->json() ?: $tokenResponse->body(),
                ]);
                return response()->json([
                    'message' => 'Missing access token from M-Pesa response',
                ], 500);
            }

            Log::debug('Registering C2B URLs with M-Pesa', [
                'endpoint' => $baseUrl . '/mpesa/c2b/v2/registerurl',
                'short_code' => $request->paybill,
            ]);

            $registerResponse = Http::acceptJson()
                ->timeout(30)
                ->withToken($accessToken)
                ->post($baseUrl . '/mpesa/c2b/v2/registerurl', [
                    'ShortCode' => $paybill,
                    'ResponseType' => $responseType,
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

            Log::info('C2B URL registered successfully', [
                'paybill' => $paybill,
                'confirmation_url' => $confirmationUrl,
                'validation_url' => $validationUrl,
            ]);

            return response()->json([
                'message' => 'C2B confirmation and validation URLs registered successfully',
                'confirmation_url' => $confirmationUrl,
                'validation_url' => $validationUrl,
                'response' => $registerResponse->json(),
            ]);
        } catch (\Exception $e) {
            Log::error('C2B URL registration failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'paybill' => $paybill,
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
