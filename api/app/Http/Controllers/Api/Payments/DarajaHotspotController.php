<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\HotspotCustomer;
use App\Models\HotspotPayment;
use App\Models\HotspotDevice;
use App\Models\Organization;
use App\Models\HotspotPackage;
use App\Models\Site;
use App\Services\HotspotSubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Jenssegers\Agent\Agent;
use App\Services\HotspotCustomerRadiusService;
use Illuminate\Support\Str;

class DarajaHotspotController extends Controller
{
    private $allHotspotPaymentController;

    public function __construct(AllHotspotPaymentController $allHotspotPaymentController)
    {
        $this->allHotspotPaymentController = $allHotspotPaymentController;
    }

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

        // Resolve organization from site (guest portal — no authenticated user)
        $siteIp = (string) $request->input('site_ip');
        $siteId = $request->input('site_id');
        $site = $siteId ? Site::find($siteId) : Site::query()
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

        $organization = $request->input('organization')
            ? Organization::find((int) $request->input('organization'))
            : Organization::find($site->organization_id);
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

        $defaultGateway = $request->input('default_gateway');
        $settings = is_array($defaultGateway)
            ? (array) data_get($defaultGateway, 'config', [])
            : (array) $organization->getPaymentGatewayConfig('mpesa');

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


        $normalizedPhone = $this->allHotspotPaymentController->normalizeKenyanPhone((string) $request->input('phone'));
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
        $appUrl = rtrim((string) config('app.url'), '/');
        $callbackUrl = $settings['callback_url'] ?? $appUrl . '/api/payments/hotspot/' . urlencode((string) $organization->mpesa_callback_token) . '/callback';
        $timestamp = now()->format('YmdHis');
        $password = base64_encode($shortCode . $passkey . $timestamp);

        $amount = (int) round((float) $package->price);
        $amountString = (string) $amount;
        $partyB = (string) $shortCode;
        $mac = (string) ($request->input('mac') ?? '');
        $packageId = (string) ($request->input('package_id') ?? '');

        $normalizedMac = $this->allHotspotPaymentController->normalizeMacAddress((string) ($request->input('mac') ?? ''));
        $hotspotCustomer = null;
        if ($normalizedMac !== null) {
            $hotspotCustomer = $this->allHotspotPaymentController->upsertHotspotCustomer(
                organizationId: $organization->id,
                siteId: $site->id,
                phone: $normalizedPhone,
                packageId: $package->id,
                macAddress: $normalizedMac,
                attributes: [
                    'status' => 'expired',
                    'ip_address' => (string) ($request->input('ip') ?? ''),
                    'password' => hash('sha256', $normalizedPhone),
                    'expiry_date' => now()
                ]
            );
        }

        $payment = HotspotPayment::create([
            'organization_id' => $organization->id,
            'customer_id' => $hotspotCustomer?->id,
            'site_id' => $site->id,
            'package_id' => $package->id,
            'phone' => $normalizedPhone,
            'mac_address' => $normalizedMac ?? $request->mac,
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
        $checkoutRequestId = (string) data_get($stkCallback, 'CheckoutRequestID', '');

        if ($resultCode !== 0) {
            $payment = null;

            if ($checkoutRequestId !== '') {
                $payment = HotspotPayment::query()
                    ->where('organization_id', $organization->id)
                    ->where('checkout_request_id', $checkoutRequestId)
                    ->whereIn('status', ['pending', 'failed'])
                    ->latest('id')
                    ->first();
            }

            if (!$payment && $checkoutRequestId !== '') {
                $payment = HotspotPayment::query()
                    ->where('organization_id', $organization->id)
                    ->where('account_reference', 'LIKE', '%' . $checkoutRequestId . '%')
                    ->whereIn('status', ['pending', 'failed'])
                    ->latest('id')
                    ->first();
            }

            if ($payment) {
                $payment->update([
                    'status' => 'failed',
                    'reason' => $resultDesc,
                ]);
            }

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
        $phone = $this->allHotspotPaymentController->normalizeKenyanPhone($phoneRaw) ?: $phoneRaw;
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

        $payment = null;

        if ($checkoutRequestId !== '') {
            $payment = HotspotPayment::query()
                ->where('organization_id', $organization->id)
                ->where('checkout_request_id', $checkoutRequestId)
                ->where('status', 'pending')
                ->latest('id')
                ->first();
        }

        if (!$payment && $phone !== '') {
            $payment = HotspotPayment::query()
                ->where('organization_id', $organization->id)
                ->where('phone', $phone)
                ->where('status', 'pending')
                ->latest('id')
                ->first();
        }

        if (!$payment) {
            Log::error('Hotspot payment not found', [
                'organization_id' => $organization->id,
                'checkout_request_id' => $checkoutRequestId,
                'phone' => $phone,
                'account_reference' => $accountReference,
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

        $macAddress = $this->allHotspotPaymentController->normalizeMacAddress((string) ($payment->mac_address ?? ''));
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

        $customer = $payment->customer_id
            ? HotspotCustomer::query()->find($payment->customer_id)
            : null;

        $seconds = app(HotspotSubscriptionService::class)->resolveSessionTimeoutSeconds($package);

        $expiresAt = $seconds > 0 ? now()->addSeconds($seconds) : null;

        if (!$customer) {
            $customer = $this->allHotspotPaymentController->upsertHotspotCustomer(
                organizationId: $organization->id,
                siteId: $payment->site_id,
                phone: $payment->phone,
                packageId: $payment->package_id,
                macAddress: $macAddress,
                attributes: [
                    'status' => 'expired',
                    'activated_at' => now(),
                    'ip_address' => (string) ($payment->ip_address ?? ''),
                    'expiry_date' => $expiresAt,
                ]
            );

            $payment->update(['customer_id' => $customer->id]);
        }

        $customer->update([
            'expiry_date' => $expiresAt,
        ]);

        // Ensure the customer has a voucher if possible, but do not block activation if generation fails.
        $voucher = $customer->voucher;
        if (empty($voucher)) {
            try {
                $voucher = app(HotspotSubscriptionService::class)->generateVoucher($customer);
                $customer->update(['voucher' => $voucher]);
            } catch (\Throwable $e) {
                Log::warning('Voucher generation failed during hotspot activation; continuing with M-Pesa receipt fallback', [
                    'customer_id' => $customer->id,
                    'organization_id' => $organization->id,
                    'mpesa_receipt' => $mpesaReceiptNumber,
                    'error' => $e->getMessage(),
                ]);
                $voucher = null;
            }
        }

        // Call applyActiveStatus once, passing both M-Pesa code and voucher (if present).
        // Voucher generation failure must not block successful callback completion.
        $altUsernames = array_filter([$mpesaReceiptNumber, $voucher]);
        app(HotspotSubscriptionService::class)->applyActiveStatus($customer, $altUsernames);

        $payment->update([
            'status' => 'paid',
            'mpesa_receipt' => $mpesaReceiptNumber,
            'expires_at' => $expiresAt,
        ]);

        // Generate a device token (secure random), store its SHA-256 hash in hotspot_devices
        // and store the encrypted raw token on the payment for the client to retrieve via checkStatus.
        try {
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);

            // Persist encrypted raw token on the payment (temporary storage)
            try {
                $payment->device_token = encrypt($rawToken);
                $payment->save();
            } catch (\Throwable $e) {
                Log::warning('Failed to encrypt/store device token on payment', [
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                ]);
            }

            // Find existing device by current_mac or previous_mac
            $device = HotspotDevice::query()
                ->where('current_mac', $macAddress)
                ->orWhere('previous_mac', $macAddress)
                ->first();

            if ($device) {
                // If MAC changed, move current to previous
                if ($device->current_mac && $device->current_mac !== $macAddress) {
                    $device->previous_mac = $device->current_mac;
                }

                $device->current_mac = $macAddress;
                $device->device_token_hash = $tokenHash;
                $device->customer_id = $customer->id ?? $device->customer_id;
                $device->last_seen_at = now();
                $device->save();
            } else {
                HotspotDevice::create([
                    'device_token_hash' => $tokenHash,
                    'current_mac' => $macAddress,
                    'previous_mac' => null,
                    'customer_id' => $customer->id ?? null,
                    'last_seen_at' => now(),
                ]);
            }

            // Do NOT log the raw token.
        } catch (\Throwable $e) {
            Log::warning('Failed to generate/store hotspot device token', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(['success' => true], 200);
    }

    private function radiusConnection()
    {
        return DB::connection('radius');
    }
}
