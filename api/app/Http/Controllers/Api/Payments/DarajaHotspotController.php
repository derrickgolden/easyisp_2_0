<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\HotspotCustomer;
use App\Models\HotspotPayment;
use App\Models\Organization;
use App\Models\HotspotPackage;
use App\Models\Site;
use App\Services\HotspotSubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Jenssegers\Agent\Agent;

class DarajaHotspotController extends Controller
{
    /**
     * Initiate an STK Push for a hotspot package payment.
     *
     * Request params:
     *   - phone        (required) : customer phone e.g. 0712345678
     *   - site_id      (required) : site that owns the portal, used to resolve the organization
    *   - package_id   (required) : package being purchased
     *   - mac          (optional) : MAC address of the hotspot client device
     *   - ip           (optional) : IP address of the hotspot client device
     *   - transaction_type (optional) : CustomerPayBillOnline|CustomerBuyGoodsOnline
     */
    public function stkPush(Request $request)
    {
        $request->validate([
            'phone'            => 'required|string',
            'site_ip'          => 'required',
            'package_id'       => 'required',
            'mac'              => 'nullable|string|max:20',
            'ip'               => 'nullable|string|max:45',
            'transaction_type' => 'nullable|in:CustomerPayBillOnline,CustomerBuyGoodsOnline',
        ]);

        Log::info('Daraja STK (hotspot) payment request received', [
            'request' => $request->all(),
            'ip' => $request->ip(),
        ]);
        // Resolve organization from site (guest portal — no authenticated user)
        $siteIp= (string) $request->input('site_ip');
        $site = Site::query()
            ->where('ip_address', $siteIp)
            ->first();

            Log::info('Daraja STK (hotspot) payment request site resolved', [
                'site_input' => $siteIp,
                'site_id' => $site?->id,
                'site_ip' => $site?->ip_address,
            ]);
        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site not found.'
            ], 422);
        }

        $organization = Organization::find($site->organization_id);
        if (!$organization) {
            Log::error('Daraja STK (hotspot): Organization not found for site', [
                'site_id' => $site->id,
                'request_ip' => $request->ip(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Organization not found.'
            ], 422);
        }


        Log::info('Daraja STK (hotspot) payment request organization resolved', [
            'organization_id' => $organization->id,
            'organization_name' => $organization->name,
        ]);

        $package = HotspotPackage::query()
            ->where('id', $request->input('package_id'))
            ->where('organization_id', $organization->id)
            ->first();

            Log::info('Daraja STK (hotspot) payment request package resolved', [
                'package_id' => $package?->id,
                'package_name' => $package?->name,
                'organization_id' => $organization->id,
            ]);

        if (!$package) {
            Log::warning('Daraja STK (hotspot): Invalid package selected', [
                'package_id' => $request->input('package_id'),
                'organization_id' => $organization->id,
            ]);     
            return response()->json([
                'success' => false,
                'message' => 'Invalid package selected.'
            ], 422);
        }

        if (empty($organization->mpesa_callback_token)) {
            Log::error('Daraja STK (hotspot): Organization callback token missing', [
                'organization_id' => $organization->id,
                'site_id' => $site->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Payment is not configured for this hotspot. Contact the administrator.'
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
                'message' => 'Payment is not configured for this hotspot. Contact the administrator.'
            ], 422);
        }


        $normalizedPhone = $this->normalizeKenyanPhone((string) $request->input('phone'));
        if (!$normalizedPhone) {
            Log::warning('Daraja STK (hotspot): Invalid phone format', [
                'organization_id' => $organization->id,
                'input_phone' => $request->input('phone'),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid phone number. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.'
            ], 422);
        }

        $baseUrl = str_contains($environment, 'sandbox')
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

        // Build the hotspot callback URL from this portal's own app URL + the org token.
        // The route is: POST /api/payments/hotspot/{token}/callback
        // $appUrl = rtrim((string) config('app.url'), '/');
        $appUrl = 'https://isp.easytech.africa';
        // $appUrl = 'https://c204-102-210-173-182.ngrok-free.app';
        $callbackUrl = $appUrl . '/api/payments/hotspot/' . urlencode((string) $organization->mpesa_callback_token) . '/callback';

        $timestamp = now()->format('YmdHis');
        $password = base64_encode($shortCode . $passkey . $timestamp);

        $amount = (int) round((float) $package->price);
        $amountString = (string) $amount;
        $partyB = (string) $shortCode;
        $mac = (string) ($request->input('mac') ?? '');
        $packageId = (string) ($request->input('package_id') ?? '');

        $normalizedMac = $this->normalizeMacAddress((string) ($request->input('mac') ?? ''));
        $hotspotCustomer = null;
        if ($normalizedMac !== null) {
            $hotspotCustomer = $this->upsertHotspotCustomer(
                organizationId: $organization->id,
                siteId: $site->id,
                phone: $normalizedPhone,
                packageId: $package->id,
                macAddress: $normalizedMac,
                attributes: [
                    'status' => 'expired',
                    'ip_address' => (string) ($request->input('ip') ?? ''),
                    'password' => hash('sha256', $normalizedPhone),
                ]
            );
        }

        $payment = HotspotPayment::create([
            'organization_id' => $organization->id,
            'customer_id' => $hotspotCustomer?->id,
            'site_id' => $site->id,
            'package_id' => $package->id,
            'phone' => $normalizedPhone,
            'mac_address' => $request->mac,
            'ip_address' => $request->ip,
            'amount' => $amount,
            'status' => 'pending',
        ]);

        $agent = new Agent();

        // 2. Extract user device metadata
        $device = $agent->device();           // e.g., "iPhone", "Samsung", "MacBook"
        $platform = $agent->platform();       // e.g., "iOS", "Android", "Windows"
        $browser = $agent->browser();

        $friendlyDeviceName = $device . ' (' . $platform . ')';

        Log::info('Daraja STK (hotspot) payment initiated', [
            'device_name' => $friendlyDeviceName,
            'browser_name' => $browser,
            'os_platform' => $platform,
        ]);

        if ($normalizedMac !== null && $hotspotCustomer !== null) {
            $hotspotCustomer->update([
                'device_name' => $friendlyDeviceName,
                'browser_name' => $browser,
                'os_platform' => $platform,
            ]);
        }

        // Encode hotspot context into the account reference so the callback can act on it.
        $accountReference = 'HS-' . $organization->id
            . ($packageId !== '' ? '-PKG-' . $packageId : '')
            . ($mac !== '' ? '-MAC-' . $mac : '');
        $transactionDesc = 'Hotspot package payment';
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
                    'message' => 'Payment service unavailable. Please try again shortly.'
                ], 503);
            }

            $accessToken = $tokenResponse->json('access_token') ?? $tokenResponse->json('accessToken');
            Log::info('Daraja STK access token', ['access_token' => $accessToken]);
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'message' => 'Payment service unavailable. Please try again shortly.'
                ], 503);
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
                    'AccountReference' => mb_substr($accountReference, 0, 12),
                    'TransactionDesc' => $transactionDesc,
                ]);

            $stkPayload = $stkResponse->json() ?? [];

            $payment->update([
                'account_reference' => $accountReference,
                'checkout_request_id' => $stkPayload['CheckoutRequestID'] ?? null,
            ]);

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

            Log::info('Daraja STK push response (hotspot)', [
                'organization_id' => $organization->id,
                'site_id' => $site->id,
                'status' => $stkResponse->status(),
                'accepted' => $isAccepted,
                'response_code' => $responseCode,
                'response_message' => $responseMessage,
                'merchant_request_id' => $stkPayload['MerchantRequestID'] ?? null,
                'checkout_request_id' => $stkPayload['CheckoutRequestID'] ?? null,
                'phone' => $normalizedPhone,
                'amount' => $amount,
                'callback_url' => $callbackUrl,
                'account_reference' => $accountReference,
                'response_body_preview' => mb_substr($stkResponseBody, 0, 600),
            ]);

            if (!$isAccepted) {
                $errorMsg = $stkPayload['errorMessage']
                    ?? $stkPayload['ResponseDescription']
                    ?? 'Failed to initiate payment. Please try again.';
                return response()->json([
                    'success' => false,
                    'message' => $errorMsg
                ], 422);
            }

            return response()->json([
                'success' => true,
                'message' => 'Payment request sent, please enter pin number.',
                'checkout_request_id' => $stkPayload['CheckoutRequestID'] ?? null,
                'merchant_request_id' => $stkPayload['MerchantRequestID'] ?? null,
            ], 200);
        } catch (\Throwable $e) {
            Log::error('Daraja STK push error', [
                'organization_id' => $organization->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An unexpected error occurred. Please try again.'
            ], 500);
        }
    }

    public function checkStatus(Request $request)
    {
        Log::info('Hotspot payment status check initiated', [
            'query' => $request->query(),
            'ip' => $request->ip(),
        ]);
        $reference = (string) $request->query('reference', '');
        if (!$reference) {
            return response()->json([
                'status' => 'pending',
                'message' => 'No reference provided',
            ], 400);
        }

        // Query the payment by account_reference or checkout_request_id
        $payment = \App\Models\HotspotPayment::query()
            ->where('account_reference', 'LIKE', $reference . '%')
            ->orWhere('checkout_request_id', $reference)
            ->latest('updated_at')
            ->first();

        if (!$payment) {
            return response()->json([
                'status' => 'pending',
                'message' => 'Payment not found or still processing',
            ], 200);
        }

        // Payment still pending
        if ($payment->status === 'pending') {
            return response()->json([
                'status' => 'pending',
                'message' => 'Waiting for M-Pesa confirmation...',
            ], 200);
        }

        // Payment failed or cancelled
        if ($payment->status === 'failed' || $payment->status === 'cancelled') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Transaction was cancelled or declined by user.',
            ], 200);
        }

        // Payment completed successfully
        if ($payment->status === 'paid') {
            $macAddress = $this->normalizeMacAddress((string) ($payment->mac_address ?? ''));
            if ($macAddress === null) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Payment verified but MAC address is missing. Contact support.',
                ], 200);
            }

            // Use MAC address as both username and password (as set in callback)
            $voucherCode = $macAddress;

            Log::info('Hotspot payment status check completed', [
                'payment_id' => $payment->id,
                'organization_id' => $payment->organization_id,
                'status' => $payment->status,
                'mac' => $macAddress,
            ]);

            return response()->json([
                'status' => 'completed',
                'message' => 'Payment verified! Connecting to internet...',
                'code' => $voucherCode,
                'voucher_code' => $voucherCode,
                'mac' => $macAddress,
                'username' => $macAddress,
                'password' => $macAddress,
            ], 200);
        }

        return response()->json([
            'status' => 'pending',
            'message' => 'Unknown payment status',
        ], 200);
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

        if ($mpesaReceiptNumber === '') {
            Log::warning('Daraja STK (hotspot) callback missing receipt number', [
                'organization_id' => $organization->id,
                'account_reference' => $accountReference,
                'phone' => $phone,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid callback payload',
            ], 400);
        }

        // Resolve payment by callback phone (latest pending for this organization).
        $payment = HotspotPayment::query()
            ->where('organization_id', $organization->id)
            ->where('phone', $phone)
            ->where('status', 'pending')
            ->latest('id')
            ->first();

        if (!$payment) {
            Log::error('Hotspot payment not found', [
                'account_reference' => $accountReference
            ]);

            return response()->json([
                'success' => false
            ], 404);
        }

        $package = HotspotPackage::find($payment->package_id);

        if (!$package) {
            return response()->json([
                'success' => false
            ], 404);
        }

        $macAddress = $this->normalizeMacAddress((string) ($payment->mac_address ?? ''));
        if ($macAddress === null) {
            Log::error('Daraja STK (hotspot) callback missing/invalid MAC for RADIUS credentials', [
                'organization_id' => $organization->id,
                'payment_id' => $payment->id,
                'phone' => $payment->phone,
                'raw_mac' => $payment->mac_address,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Missing MAC address for hotspot provisioning',
            ], 422);
        }

        Log::info('Daraja STK (hotspot) callback payment successful', [
            'organization_id' => $organization->id,
            'amount' => $amount,
            'mpesa_receipt_number' => $mpesaReceiptNumber,
            'account_reference' => $accountReference,
            'phone' => $phone,
            'package_id' => $package->id,
            'mac' => $payment->mac_address,
        ]);

        $customer = $payment->customer_id
            ? HotspotCustomer::query()->find($payment->customer_id)
            : null;

        if (!$customer) {
            $customer = $this->upsertHotspotCustomer(
                organizationId: $organization->id,
                siteId: $payment->site_id,
                phone: $payment->phone,
                packageId: $payment->package_id,
                macAddress: $macAddress,
                attributes: [
                    'status' => 'expired',
                    'ip_address' => (string) ($payment->ip_address ?? ''),
                ]
            );

            $payment->update(['customer_id' => $customer->id]);
        }

        [, $seconds] = app(HotspotSubscriptionService::class)->applyActiveStatus($customer);
        
        $payment->update([
            'status' => 'paid',
            'mpesa_receipt' => $mpesaReceiptNumber,
            'expires_at' => $seconds > 0 ? now()->addSeconds($seconds) : null,
        ]);

        $this->upsertHotspotCustomer(
            organizationId: $organization->id,
            siteId: $payment->site_id,
            phone: $payment->phone,
            packageId: $payment->package_id,
            macAddress: $macAddress,
            attributes: [
                'activated_at' => now(),
                'expiry_date' => $seconds > 0 ? now()->addSeconds($seconds) : null,
            ]
        );

        return response()->json(['success' => true], 200);
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

    private function radiusConnection()
    {
        return DB::connection('radius');
    }

    private function normalizeMacAddress(string $mac): ?string
    {
        $raw = strtoupper(trim($mac));
        if ($raw === '') {
            return null;
        }

        $hexOnly = preg_replace('/[^A-F0-9]/', '', $raw) ?? '';
        if (strlen($hexOnly) !== 12) {
            return null;
        }

        return implode(':', str_split($hexOnly, 2));
    }

    private function upsertHotspotCustomer(
        int $organizationId,
        ?int $siteId,
        string $phone,
        int $packageId,
        string $macAddress,
        array $attributes = []
    ): HotspotCustomer {
        return HotspotCustomer::query()->updateOrCreate(
            [
                'radius_username' => $macAddress,
            ],
            array_merge([
                'organization_id' => $organizationId,
                'site_id' => $siteId,
                'phone' => $phone,
                'package_id' => $packageId,
                'mac_address' => $macAddress,
                'radius_password' => $macAddress,
            ], $attributes)
        );
    }

}
