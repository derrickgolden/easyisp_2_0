<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Organization;
use App\Services\IncomingPaymentService;
use App\Services\PhoneNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DarajaPaymentController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:stk-push')->only(['stkPush']);
    }

    public function stkPush(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'amount' => 'required|numeric|min:1',
            'account_reference' => 'nullable|string|max:255',
            'transaction_desc' => 'nullable|string|max:255',
            'transaction_type' => 'nullable|in:CustomerPayBillOnline,CustomerBuyGoodsOnline',
        ]);


        $organization = $request->user()->organization;
        if (!$organization) {
            Log::error('Daraja STK: Organization not found for authenticated user', [
                'user_id' => $request->user()?->id,
                'request_ip' => $request->ip(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Organization not found for authenticated user.',
            ], 404);
        }

        if (empty($organization->mpesa_callback_token)) {
            Log::error('Daraja STK: Organization callback token missing', [
                'organization_id' => $organization->id,
                'user_id' => $request->user()?->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Organization callback token is missing. Generate callback token first.',
            ], 422);
        }

        $settings = $this->extractPaymentGatewaySettings($organization->settings);

        $consumerKey = trim((string) (data_get($settings, 'consumer_key') ?? ''));
        $consumerSecret = trim((string) (data_get($settings, 'consumer_secret') ?? ''));
        $shortCode = trim((string) ( data_get($settings, 'paybill')?? ''));
        $passkey = trim((string) (data_get($settings, 'passkey') ?? ''));
        $environment = strtolower(trim((string) (data_get($settings, 'environment') ?? 'production')));

        if (!$consumerKey || !$consumerSecret || !$shortCode || !$passkey) {
            Log::error('Daraja STK: Missing Daraja settings', [
                'organization_id' => $organization->id,
                'consumer_key' => $consumerKey,
                'consumer_secret_set' => !empty($consumerSecret),
                'paybill' => $shortCode,
                'passkey_set' => !empty($passkey),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Daraja settings are incomplete. Ensure paybill, consumer key, consumer secret and passkey are saved in payment gateway settings.',
            ], 422);
        }

        $normalizedPhone = PhoneNumberService::normalizeToE164((string) $request->input('phone'));
        if (!$normalizedPhone) {
            Log::warning('Daraja STK: Invalid phone format', [
                'organization_id' => $organization->id,
                'input_phone' => $request->input('phone'),
                'user_id' => $request->user()?->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid phone format. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.',
            ], 422);
        }


        $baseUrl = str_contains($environment, 'sandbox')
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

        // Strict mode: only one DB key is accepted for STK callback URL.
        $callbackUrl = trim((string) ($settings['stk_callback_url'] ?? ''));
        $callbackSource = 'stk_callback_url';

        if ($callbackUrl === '') {
            Log::error('Daraja STK: Missing required stk_callback_url', [
                'organization_id' => $organization->id,
                'required_setting_key' => 'payment-gateway.stk_callback_url',
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Daraja STK callback URL is missing. Set payment-gateway.stk_callback_url in Organization Settings.',
            ], 422);
        }

        if (!filter_var($callbackUrl, FILTER_VALIDATE_URL)) {
            Log::error('Daraja STK: Invalid stk_callback_url format', [
                'organization_id' => $organization->id,
                'stk_callback_url' => $callbackUrl,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Daraja STK callback URL is invalid. Set payment-gateway.stk_callback_url to a valid absolute URL (https://...).',
            ], 422);
        }

        $callbackPath = (string) parse_url($callbackUrl, PHP_URL_PATH);
        if (!preg_match('#/api/payments/daraja/([^/]+)/stk/callback$#', $callbackPath, $matches)) {
            return response()->json([
                'success' => false,
                'message' => 'Daraja STK callback URL path is invalid. Expected /api/payments/daraja/{mpesa_callback_token}/stk/callback.',
            ], 422);
        }

        $callbackTokenFromUrl = (string) ($matches[1] ?? '');
        $expectedToken = (string) $organization->mpesa_callback_token;
        if (!hash_equals($expectedToken, $callbackTokenFromUrl)) {
            return response()->json([
                'success' => false,
                'message' => 'Daraja STK callback URL token does not match the organization token. Update payment-gateway.stk_callback_url.',
            ], 422);
        }

        $timestamp = now()->format('YmdHis');
        $password = base64_encode($shortCode . $passkey . $timestamp);

        $amount = (int) round((float) $request->input('amount'));
        $amountString = (string) $amount;
        $partyB = (string) $shortCode;
        $accountReference = (string) ($request->input('account_reference') ?: ('ORG-' . $organization->id . '-INV-' . now()->timestamp));
        $transactionDesc = (string) ($request->input('transaction_desc') ?: 'STK payment');
        $transactionType = (string) ($request->input('transaction_type') ?: 'CustomerPayBillOnline');

        try {
            $tokenResponse = Http::acceptJson()
                ->timeout(30)
                ->withBasicAuth($consumerKey, $consumerSecret)
                ->get($baseUrl . '/oauth/v1/generate?grant_type=client_credentials');

            if (!$tokenResponse->ok()) {
                Log::error('Daraja STK token request failed', [
                    'organization_id' => $organization->id,
                    'status' => $tokenResponse->status(),
                    'body' => $tokenResponse->json() ?? $tokenResponse->body(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Failed to generate Daraja access token.',
                    'details' => $tokenResponse->json() ?? $tokenResponse->body(),
                ], $tokenResponse->status());
            }

            $accessToken = $tokenResponse->json('access_token') ?? $tokenResponse->json('accessToken');
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'message' => 'Missing access token from Daraja OAuth response.',
                ], 500);
            }

            $stkResponse = Http::acceptJson()
                ->timeout(30)
                ->withToken($accessToken)
                ->post($baseUrl . '/mpesa/stkpush/v1/processrequest', [
                    'BusinessShortCode' => $partyB,
                    'Password' => $password,
                    'Timestamp' => $timestamp,
                    'TransactionType' => $transactionType,
                    'Amount' => $amountString,
                    'PartyA' => $normalizedPhone,
                    'PartyB' => $partyB,
                    'PhoneNumber' => $normalizedPhone,
                    'CallBackURL' => $callbackUrl,
                    'AccountReference' => $normalizedPhone,
                    'TransactionDesc' => $transactionDesc,
                ]);

            $stkPayload = $stkResponse->json() ?? [];
            $stkResponseBody = $stkResponse->body();
            $responseCode = (string) ($stkPayload['ResponseCode'] ?? '');
            $isAccepted = $stkResponse->ok() && $responseCode === '0';
            $responseMessage = (string) (
                $stkPayload['errorMessage']
                ?? $stkPayload['ResponseDescription']
                ?? $stkPayload['error_description']
                ?? $stkPayload['message']
                ?? ''
            );

            Log::info('Daraja STK push response', [
                'organization_id' => $organization->id,
                'status' => $stkResponse->status(),
                'accepted' => $isAccepted,
                'response_code' => $responseCode,
                'response_message' => $responseMessage,
                'merchant_request_id' => $stkPayload['MerchantRequestID'] ?? null,
                'checkout_request_id' => $stkPayload['CheckoutRequestID'] ?? null,
                'phone' => $normalizedPhone,
                'amount' => $amount,
                'callback_url' => $callbackUrl,
                'callback_url_source' => $callbackSource,
                'response_body_preview' => mb_substr($stkResponseBody, 0, 600),
            ]);

            if (!$isAccepted) {
                return response()->json([
                    'success' => false,
                    'message' => $stkPayload['errorMessage'] ?? $stkPayload['ResponseDescription'] ?? 'Failed to initiate Daraja STK push.',
                    'data' => $stkPayload,
                ], $stkResponse->status() >= 400 ? $stkResponse->status() : 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'Daraja STK push initiated. Enter PIN to continue.',
                'data' => $stkPayload,
            ]);
        } catch (\Throwable $e) {
            Log::error('Daraja STK push error', [
                'organization_id' => $organization->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Server Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function stkCallback(Request $request, string $token)
    {
        $organization = Organization::where('mpesa_callback_token', $token)->first();

        if (!$organization) {
            Log::warning('Daraja STK callback invalid token', [
                'token' => $token,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid token',
            ], 401);
        }

        $payload = $request->all();

        Log::info('Daraja STK callback received', [
            'organization_id' => $organization->id,
            'payload' => $payload,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $stkCallback = data_get($payload, 'Body.stkCallback', []);
        $resultCode = (int) data_get($stkCallback, 'ResultCode', 1);
        $resultDesc = (string) data_get($stkCallback, 'ResultDesc', 'No description');

        if ($resultCode !== 0) {
            Log::warning('Daraja STK callback unsuccessful', [
                'organization_id' => $organization->id,
                'result_code' => $resultCode,
                'result_desc' => $resultDesc,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unsuccessful callback',
                'result_code' => $resultCode,
                'result_desc' => $resultDesc,
            ], 200);
        }

        $metadataItems = collect(data_get($stkCallback, 'CallbackMetadata.Item', []));

        $amount = (float) ($metadataItems->firstWhere('Name', 'Amount')['Value'] ?? 0);
        $mpesaReceiptNumber = (string) ($metadataItems->firstWhere('Name', 'MpesaReceiptNumber')['Value'] ?? '');
        $phoneRaw = (string) ($metadataItems->firstWhere('Name', 'PhoneNumber')['Value'] ?? '');
        $phone = PhoneNumberService::normalizeToE164($phoneRaw) ?: $phoneRaw;
        $accountReference = (string) (data_get($stkCallback, 'AccountReference')
            ?? data_get($payload, 'AccountReference')
            ?? data_get($payload, 'account_reference')
            ?? '');

        if ($amount <= 0 || !$phone) {
            Log::warning('Daraja STK callback missing required success fields', [
                'organization_id' => $organization->id,
                'amount' => $amount,
                'phone' => $phone,
                'receipt' => $mpesaReceiptNumber,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid callback payload',
            ], 400);
        }

        $resolvedOrganization = $this->resolveOrganizationFromCallback($accountReference, $phone, $organization);
        if (!$resolvedOrganization) {
            Log::warning('Daraja STK callback could not resolve organization', [
                'organization_id' => $organization->id,
                'account_reference' => $accountReference,
                'phone' => $phone,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Organization not resolved',
            ], 404);
        }

        if ($mpesaReceiptNumber === '') {
            Log::warning('Daraja STK callback missing receipt number', [
                'organization_id' => $resolvedOrganization->id,
                'account_reference' => $accountReference,
                'phone' => $phone,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid callback payload',
            ], 400);
        }

        $customer = $this->resolveCustomerFromCallback($resolvedOrganization->id, $accountReference, $phone);

        Log::info('Daraja STK callback customer resolution', [
            'organization_id' => $resolvedOrganization->id,
            'customer_id' => $customer?->id,
            'customer_found' => $customer !== null,
            'account_reference' => $accountReference,
            'phone' => $phone,
        ]);

        try {
            $result = app(IncomingPaymentService::class)->processC2BPayment(
                $resolvedOrganization,
                $customer,
                $mpesaReceiptNumber,
                $amount,
                $accountReference,
                $phone,
                null,
            );

            if ($result['duplicate']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Duplicate callback ignored',
                ], 200);
            }

            $payment = $result['payment'];

            Log::info('Daraja STK callback payment processed successfully', [
                'organization_id' => $resolvedOrganization->id,
                'payment_id' => $payment?->id,
                'customer_id' => $customer?->id,
                'amount' => $amount,
                'mpesa_receipt_number' => $mpesaReceiptNumber,
                'account_reference' => $accountReference,
                'status' => $payment?->status,
            ]);

            return response()->json(['success' => true], 200);
        } catch (\Throwable $e) {
            Log::error('Failed to process Daraja STK callback payment', [
                'error' => $e->getMessage(),
                'organization_id' => $resolvedOrganization->id,
                'amount' => $amount,
                'phone' => $phone,
                'mpesa_receipt_number' => $mpesaReceiptNumber,
            ]);

            return response()->json(['success' => false, 'message' => 'Server error'], 500);
        }
    }

    private function resolveCustomerFromCallback(int $organizationId, ?string $accountReference, string $phone): ?Customer
    {
        $query = Customer::where('organization_id', $organizationId);

        if (!empty($accountReference)) {
            $customer = (clone $query)
                ->whereRaw('LOWER(TRIM(radius_username)) = ?', [strtolower(trim($accountReference))])
                ->first();
            if ($customer) {
                return $customer;
            }
        }

        return (clone $query)
            ->where('phone', $phone)
            ->latest('id')
            ->first();
    }

    private function resolveOrganizationFromCallback(?string $accountReference, string $phone, Organization $fallbackOrganization): ?Organization
    {
        if (!empty($accountReference) && preg_match('/ORG-(\d+)-/i', $accountReference, $matches)) {
            $organization = Organization::find((int) $matches[1]);
            if ($organization) {
                return $organization;
            }
        }

        $customer = Customer::where('phone', $phone)->latest('id')->first();

        if ($customer) {
            return Organization::find($customer->organization_id);
        }

        $organizationFromUserPhone = Organization::whereHas('users', function ($query) use ($phone) {
            $query->where('phone', $phone);
        })->first();

        return $organizationFromUserPhone ?: $fallbackOrganization;
    }

    private function extractPaymentGatewaySettings(mixed $rawSettings): array
    {
        if (!is_array($rawSettings)) {
            return [];
        }

        $paymentGateway = data_get($rawSettings, 'payment-gateway');
        if (is_array($paymentGateway)) {
            return $paymentGateway;
        }

        if (is_string($paymentGateway)) {
            $decoded = json_decode($paymentGateway, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $decoded;
            }
        }

        return $rawSettings;
    }

}
