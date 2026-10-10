<?php

namespace App\Http\Controllers\Api\Payments;

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
        $this->middleware('permission:stk-push')->only(['adminStkPush']);
    }

    public function customerStkPush(Request $request)
    {

        $validated = $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'phone' => 'required|string',
            'package_id' => 'nullable|integer',
            'amount' => 'required|numeric|min:1',
            'account_reference' => 'nullable|string|max:255',
            'transaction_desc' => 'nullable|string|max:255',
            'transaction_type' => 'nullable|in:CustomerPayBillOnline,CustomerBuyGoodsOnline',
        ]);

        $customer = Customer::with('organization')->find($request->input('customer_id'));
        if (!$customer) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found.',
            ], 404);
        }

        $organization = $customer->organization;
        if (!$organization) {
            return response()->json([
                'success' => false,
                'message' => 'Organization not found for customer.',
            ], 404);
        }

        $request->merge(['organization' => $organization->id]);

        return $this->adminStkPush($request);
    }

    public function adminStkPush(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'amount' => 'required|numeric|min:1',
            'account_reference' => 'nullable|string|max:255',
            'transaction_desc' => 'nullable|string|max:255',
            'transaction_type' => 'nullable|in:CustomerPayBillOnline,CustomerBuyGoodsOnline',
            'organization' => 'nullable|exists:organizations,id',
        ]);

        $organization = $request->input('organization') ? Organization::find($request->input('organization')) : $request->user()->organization;
        if (!$organization) {
            Log::error('Daraja STK: Organization not found for authenticated user', [
                'request_ip' => $request->ip(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Organization not found for authenticated user.',
            ], 404);
        }

        if (empty($organization->callback_token)) {
            Log::error('Daraja STK: Organization callback token missing', [
                'organization_id' => $organization->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Organization callback token is missing. Generate callback token first.',
            ], 422);
        }

        $gateway = $organization->paymentGateways()
            ->where('provider', 'mpesa')
            ->where('active', true)
            ->orderByDesc('is_default')
            ->first();

        if (!$gateway) {
            Log::error('Daraja STK: Active M-Pesa gateway not found', [
                'organization_id' => $organization->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'M-Pesa gateway is not configured or active for this organization.',
            ], 422);
        }

        $settings = (array) ($gateway->config ?? []);

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
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid phone format. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.',
            ], 422);
        }


        $baseUrl = str_contains($environment, 'sandbox')
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

        $appUrl = rtrim((string) config('app.url'), '/');
        if ($appUrl === '') {
            Log::error('Daraja STK: Application URL is missing', [
                'organization_id' => $organization->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Application URL is not configured. Set APP_URL before initiating Daraja STK payments.',
            ], 422);
        }
        $callbackUrl = $appUrl . '/api/payments/daraja/' . urlencode((string) $organization->callback_token) . '/stk/callback';

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
        $organization = Organization::where('callback_token', $token)->first();

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

        $resolvedOrganization = $organization;

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

}
