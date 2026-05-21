<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationLicenseSnapshot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $settings = data_get($organization->settings, 'payment-gateway', []);

        $consumerKey = trim((string) (data_get($settings, 'consumer_key') ?? ''));
        $consumerSecret = trim((string) (data_get($settings, 'consumer_secret') ?? ''));
        $shortCode = trim((string) (data_get($settings, 'paybill') ?? ''));
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


        $normalizedPhone = $this->normalizeKenyanPhone((string) $request->input('phone'));
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

        // Use callback URL from org settings if present, else fallback
        $callbackUrl = null;
        if (!empty($settings['daraja_stk_callback_url'])) {
            $callbackUrl = trim($settings['daraja_stk_callback_url']);
        }
        if (!$callbackUrl) {
            $callbackBaseUrl = rtrim((string) env('DARAJA_STK_CALLBACK_BASE_URL', config('app.url')), '/');
            $callbackUrl = $callbackBaseUrl . '/api/payments/daraja/' . $organization->mpesa_callback_token . '/stk/callback';
        }
        if (!$callbackUrl) {
            Log::error('Daraja STK: Callback URL could not be determined', [
                'organization_id' => $organization->id,
                'settings_callback_url' => $settings['daraja_stk_callback_url'] ?? null,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Callback URL could not be determined.',
            ], 500);
        }

        $timestamp = now()->format('YmdHis');
        $password = base64_encode($shortCode . $passkey . $timestamp);

        $amount = (int) round((float) $request->input('amount'));
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
                    'BusinessShortCode' => $shortCode,
                    'Password' => $password,
                    'Timestamp' => $timestamp,
                    'TransactionType' => $transactionType,
                    'Amount' => $amount,
                    'PartyA' => $normalizedPhone,
                    'PartyB' => $shortCode,
                    'PhoneNumber' => $normalizedPhone,
                    'CallBackURL' => $callbackUrl,
                    'AccountReference' => $accountReference,
                    'TransactionDesc' => $transactionDesc,
                ]);

            $stkPayload = $stkResponse->json() ?? [];
            $responseCode = (string) ($stkPayload['ResponseCode'] ?? '');
            $isAccepted = $stkResponse->ok() && $responseCode === '0';

            Log::info('Daraja STK push response', [
                'organization_id' => $organization->id,
                'status' => $stkResponse->status(),
                'accepted' => $isAccepted,
                'response_code' => $responseCode,
                'merchant_request_id' => $stkPayload['MerchantRequestID'] ?? null,
                'checkout_request_id' => $stkPayload['CheckoutRequestID'] ?? null,
                'phone' => $normalizedPhone,
                'amount' => $amount,
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
        $phone = $this->normalizeKenyanPhone($phoneRaw) ?: $phoneRaw;
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

        $amountAsDecimal = number_format($amount, 2, '.', '');

        try {
            $settledSnapshot = DB::transaction(function () use ($resolvedOrganization, $amountAsDecimal, $amount, $phone, $accountReference, $mpesaReceiptNumber) {
                $lockedOrganization = Organization::where('id', $resolvedOrganization->id)
                    ->lockForUpdate()
                    ->first();

                $snapshot = OrganizationLicenseSnapshot::where('organization_id', $resolvedOrganization->id)
                    ->where('status', 'billed')
                    ->where('total_amount', $amountAsDecimal)
                    ->orderByDesc('snapshot_month')
                    ->lockForUpdate()
                    ->first();

                if ($snapshot) {
                    $snapshot->update([
                        'status' => 'paid',
                        'paid_at' => now(),
                        'meta' => array_merge($snapshot->meta ?? [], [
                            'paid_via' => 'daraja_stk',
                            'daraja_account_reference' => $accountReference,
                            'daraja_phone' => $phone,
                            'daraja_amount' => $amount,
                            'daraja_mpesa_receipt' => $mpesaReceiptNumber,
                        ]),
                    ]);

                    if ($lockedOrganization && $lockedOrganization->status !== 'active') {
                        $lockedOrganization->update(['status' => 'active']);
                    }

                    return $snapshot;
                }

                if ($lockedOrganization) {
                    $lockedOrganization->increment('balance', $amount);
                }

                return null;
            });

            Log::info('Daraja STK callback organization balance updated', [
                'organization_id' => $resolvedOrganization->id,
                'amount' => $amount,
                'phone' => $phone,
                'account_reference' => $accountReference,
                'mpesa_receipt_number' => $mpesaReceiptNumber,
                'license_snapshot_paid' => $settledSnapshot?->id,
                'credited_to_org_balance' => $settledSnapshot === null,
            ]);

            return response()->json(['success' => true], 200);
        } catch (\Throwable $e) {
            Log::error('Failed to update organization balance from Daraja callback', [
                'error' => $e->getMessage(),
                'organization_id' => $resolvedOrganization->id,
                'amount' => $amount,
                'phone' => $phone,
            ]);

            return response()->json(['success' => false, 'message' => 'Server error'], 500);
        }
    }

    private function normalizeKenyanPhone(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone ?? '');
        if (!$digits) {
            return null;
        }

        if (strlen($digits) === 10 && str_starts_with($digits, '0')) {
            return '254' . substr($digits, 1);
        }

        if (strlen($digits) === 9 && (str_starts_with($digits, '7') || str_starts_with($digits, '1'))) {
            return '254' . $digits;
        }

        if (preg_match('/^254(7|1)\d{8}$/', $digits)) {
            return $digits;
        }

        return null;
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
}
