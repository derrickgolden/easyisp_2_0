<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\HotspotCustomer;
use App\Models\HotspotDevice;
use App\Models\HotspotPackage;
use App\Models\HotspotPayment;
use App\Models\Organization;
use App\Models\Site;
use App\Services\HotspotSubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Jenssegers\Agent\Agent;

class PayheroHotspotController extends Controller
{
    private $apiUsername;
    private $apiPassword;
    private $allHotspotPaymentController;
    private $baseUrl = 'https://backend.payhero.co.ke/api/v2/payments';

    public function __construct(AllHotspotPaymentController $allHotspotPaymentController)
    {
        $this->apiUsername = env('API_USERNAME');
        $this->apiPassword = env('API_PASSWORD');
        $this->allHotspotPaymentController = $allHotspotPaymentController;
    }

    private function getBasicAuthToken()
    {
        $credentials = $this->apiUsername . ':' . $this->apiPassword;
        return 'Basic ' . base64_encode($credentials);
    }

    public function stkPush(Request $request)
    {
        Log::info('Payhero STK (hotspot) payment request received', [
            'request' => $request->all(),
            'ip' => $request->ip(),
        ]);

        $request->validate([
            'phone' => 'required|string',
            'site_ip' => 'required',
            'package_id' => 'required',
            'mac' => 'nullable|string|max:20',
            'ip' => 'nullable|string|max:45',
        ]);

        $siteIp = (string) $request->input('site_ip');
        $siteId = $request->input('site_id');
        $site = $siteId ? Site::find($siteId) : Site::query()->where('ip_address', $siteIp)->first();

        Log::info('Payhero STK (hotspot) payment request site resolved', [
            'site_input' => $siteIp,
            'site_id' => $site?->id,
            'site_ip' => $site?->ip_address,
        ]);

        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site not found.',
            ], 422);
        }

        $organization = $request->input('organization')
            ? Organization::find((int) $request->input('organization'))
            : Organization::find($site->organization_id);
        if (!$organization) {
            Log::error('Payhero STK (hotspot): Organization not found for site', [
                'site_id' => $site->id,
                'request_ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Organization not found.',
            ], 422);
        }

        $package = HotspotPackage::query()
            ->where('id', $request->input('package_id'))
            ->where('organization_id', $organization->id)
            ->first();

        Log::info('Payhero STK (hotspot) payment request package resolved', [
            'package_id' => $package?->id,
            'package_name' => $package?->name,
            'organization_id' => $organization->id,
        ]);

        if (!$package) {
            Log::warning('Payhero STK (hotspot): Invalid package selected', [
                'package_id' => $request->input('package_id'),
                'organization_id' => $organization->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid package selected.',
            ], 422);
        }

        $normalizedPhone = $this->allHotspotPaymentController->normalizeKenyanPhone((string) $request->input('phone'));
        if (!$normalizedPhone) {
            Log::warning('Payhero STK (hotspot): Invalid phone format', [
                'organization_id' => $organization->id,
                'input_phone' => $request->input('phone'),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid phone number. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.',
            ], 422);
        }

        $amount = (int) round((float) $package->price);
        $normalizedMac = $this->allHotspotPaymentController->normalizeMacAddress((string) ($request->input('mac') ?? ''));
        $packageId = (string) $request->input('package_id', '');
        $mac = (string) ($request->input('mac') ?? '');
        $accountReference = 'HS-' . $organization->id
            . ($packageId !== '' ? '-PKG-' . $packageId : '')
            . ($mac !== '' ? '-MAC-' . $mac : '');

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
                    'expiry_date' => now(),
                ]
            );
        }

        $payment = HotspotPayment::create([
            'organization_id' => $organization->id,
            'customer_id' => $hotspotCustomer?->id,
            'site_id' => $site->id,
            'package_id' => $package->id,
            'phone' => $normalizedPhone,
            'mac_address' => $normalizedMac ?? $request->input('mac'),
            'ip_address' => $request->input('ip'),
            'amount' => $amount,
            'status' => 'pending',
        ]);

        $agent = new Agent();
        $device = $agent->device();
        $platform = $agent->platform();
        $browser = $agent->browser();
        $friendlyDeviceName = $device . ' (' . $platform . ')';

        if ($normalizedMac !== null && $hotspotCustomer !== null) {
            $hotspotCustomer->update([
                'device_name' => $friendlyDeviceName,
                'browser_name' => $browser,
                'os_platform' => $platform,
            ]);
        }

        $defaultGateway = $request->input('default_gateway');
        $settings = is_array($defaultGateway)
            ? (array) data_get($defaultGateway, 'config', [])
            : (array) $organization->getPaymentGatewayConfig('payhero');

        $providerSetting = trim((string) (data_get($settings, 'provider') ?? data_get($defaultGateway, 'provider') ?? ''));
        if ($providerSetting !== 'payhero') {
            Log::error('Payhero STK (hotspot): payment gateway provider not set to payhero', [
                'organization_id' => $organization->id,
                'provider' => $providerSetting,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Can not find payment provider(Payhero).',
            ], 422);
        }

        $channelId = trim((string) (data_get($settings, 'channel_id') ?? ''));
        $callbackUrl = trim((string) (data_get($settings, 'callback_url') ?? ''));

        if ($channelId === '' || $callbackUrl === '') {
            Log::error('Payhero STK (hotspot): missing payhero settings', [
                'organization_id' => $organization->id,
                'channel_id_set' => $channelId !== '',
                'callback_url_set' => $callbackUrl !== '',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Payhero configuration incomplete. Contact the administrator.',
            ], 422);
        }

        try {
            $response = Http::withOptions([
                'verify' => true,
            ])->withHeaders([
                'Authorization' => $this->getBasicAuthToken(),
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl, [
                'amount' => $amount,
                'phone_number' => $normalizedPhone,
                'channel_id' => $channelId,
                'provider' => 'm-pesa',
                'external_reference' => $accountReference,
                'callback_url' => $callbackUrl,
            ]);

            if ($response->successful()) {
                session(['session-details' => $normalizedPhone]);
                Log::info('Payhero STK push succeeded', [
                    'organization_id' => $organization->id,
                    'payment_id' => $payment->id,
                    'response' => $response->json(),
                ]);

                $payload = $response->json() ?? [];

                $payment->update([
                    'account_reference' => $accountReference,
                    'checkout_request_id' => data_get($payload, 'CheckoutRequestID')
                        ?? data_get($payload, 'checkout_request_id')
                        ?? data_get($payload, 'checkoutRequestId')
                        ?? null,
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Payment request sent, please enter pin number.',
                    'checkout_request_id' => data_get($payload, 'CheckoutRequestID')
                        ?? data_get($payload, 'checkout_request_id')
                        ?? data_get($payload, 'checkoutRequestId')
                        ?? null,
                    'merchant_request_id' => data_get($payload, 'MerchantRequestID')
                        ?? data_get($payload, 'merchant_request_id')
                        ?? data_get($payload, 'merchantRequestId')
                        ?? null,
                ], 200);
            }

            Log::error('Payhero STK Push error', [
                'organization_id' => $organization->id,
                'status' => $response->status(),
                'body' => $response->json() ?? $response->body(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to initiate STK push.',
                'data' => $response->json(),
            ], 400);
        } catch (\Throwable $e) {
            Log::error('Payhero STK Push exception', [
                'organization_id' => $organization->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Server Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function stkCallback(Request $request, $token)
    {
        $organization = Organization::where('mpesa_callback_token', $token)->first();

        if (!$organization) {
            Log::warning('Payhero STK callback invalid token', [
                'token' => $token,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid token',
            ], 401);
        }

        $payload = $request->all();

        Log::info('Payhero STK callback received', [
            'organization_id' => $organization->id,
            'payload' => $payload,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $status = $request->input('status');
        $response = $request->input('response', []);
        $resultCode = (int) ($response['ResultCode'] ?? 1);
        $resultDesc = (string) ($response['ResultDesc'] ?? $response['result_desc'] ?? 'Payment request failed');
        $checkoutRequestId = (string) (
            $response['CheckoutRequestID']
            ?? $response['checkout_request_id']
            ?? $response['checkoutRequestId']
            ?? $request->input('checkout_request_id')
            ?? $request->input('CheckoutRequestID')
            ?? ''
        );

        $isSuccess = (bool) $status && $resultCode === 0;
        if (!$isSuccess) {
            $phone = $response['Phone'] ?? $response['phone_number'] ?? null;
            $normalizedPhone = $phone ? ($this->allHotspotPaymentController->normalizeKenyanPhone((string) $phone) ?: (string) $phone) : null;

            $payment = null;

            if ($checkoutRequestId !== '') {
                $payment = HotspotPayment::query()
                    ->where('organization_id', $organization->id)
                    ->where('checkout_request_id', $checkoutRequestId)
                    ->whereIn('status', ['pending', 'failed'])
                    ->latest('id')
                    ->first();
            }

            if (!$payment && $normalizedPhone) {
                $payment = HotspotPayment::query()
                    ->where('organization_id', $organization->id)
                    ->where('phone', $normalizedPhone)
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

            Log::warning('Payhero STK callback marked unsuccessful', [
                'status' => $status,
                'result_code' => $resultCode,
                'result_desc' => $resultDesc,
                'organization_id' => $organization->id,
                'checkout_request_id' => $checkoutRequestId,
                'phone' => $normalizedPhone ?? $phone,
            ]);

            return response()->json(['success' => false, 'message' => 'Unsuccessful callback'], 200);
        }

        $amount = (float) ($response['Amount'] ?? 0);
        $phone = $response['Phone'] ?? $response['phone_number'] ?? null;
        $checkoutRequestId = (string) (
            $response['CheckoutRequestID']
            ?? $response['checkout_request_id']
            ?? $response['checkoutRequestId']
            ?? $request->input('checkout_request_id')
            ?? $request->input('CheckoutRequestID')
            ?? ''
        );
        $externalReference = $response['ExternalReference']
            ?? $response['external_reference']
            ?? $request->input('external_reference');
        $receipt = (string) (
            $response['MpesaReceiptNumber']
            ?? $response['MpesaReceipt']
            ?? $response['ReceiptNumber']
            ?? $response['receipt_number']
            ?? $response['receipt']
            ?? ''
        );

        if ($amount <= 0 || !$phone) {
            Log::warning('Payhero STK callback missing required success fields', [
                'amount' => $response['Amount'] ?? null,
                'phone' => $phone,
            ]);

            return response()->json(['success' => false, 'message' => 'Invalid callback payload'], 400);
        }

        $normalizedPhone = $this->allHotspotPaymentController->normalizeKenyanPhone((string) $phone) ?: (string) $phone;

        $payment = null;

        if ($checkoutRequestId !== '') {
            $payment = HotspotPayment::query()
                ->where('organization_id', $organization->id)
                ->where('checkout_request_id', $checkoutRequestId)
                ->where('status', 'pending')
                ->latest('id')
                ->first();
        }

        if (!$payment && $normalizedPhone !== '') {
            $payment = HotspotPayment::query()
                ->where('organization_id', $organization->id)
                ->where('phone', $normalizedPhone)
                ->where('status', 'pending')
                ->latest('id')
                ->first();
        }

        if (!$payment) {
            Log::error('Hotspot payment not found for Payhero callback', [
                'organization_id' => $organization->id,
                'checkout_request_id' => $checkoutRequestId,
                'phone' => $normalizedPhone,
                'external_reference' => $externalReference,
            ]);

            return response()->json([
                'success' => false,
            ], 404);
        }

        $package = HotspotPackage::find($payment->package_id);
        if (!$package) {
            return response()->json([
                'success' => false,
            ], 404);
        }

        $macAddress = $this->allHotspotPaymentController->normalizeMacAddress((string) ($payment->mac_address ?? ''));
        if ($macAddress === null) {
            Log::error('Payhero callback missing/invalid MAC for RADIUS credential creation', [
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

        $voucher = $customer->voucher;
        if (empty($voucher)) {
            try {
                $voucher = app(HotspotSubscriptionService::class)->generateVoucher($customer);
                $customer->update(['voucher' => $voucher]);
            } catch (\Throwable $e) {
                Log::warning('Voucher generation failed during hotspot activation; continuing with Payhero receipt fallback', [
                    'customer_id' => $customer->id,
                    'organization_id' => $organization->id,
                    'payhero_receipt' => $receipt,
                    'error' => $e->getMessage(),
                ]);
                $voucher = null;
            }
        }

        $altUsernames = array_filter([$receipt, $voucher]);
        app(HotspotSubscriptionService::class)->applyActiveStatus($customer, $altUsernames);

        $payment->update([
            'status' => 'paid',
            'mpesa_receipt' => $receipt,
            'expires_at' => $expiresAt,
            'account_reference' => $externalReference ?: $payment->account_reference,
        ]);

        try {
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);

            try {
                $payment->device_token = encrypt($rawToken);
                $payment->save();
            } catch (\Throwable $e) {
                Log::warning('Failed to encrypt/store device token on payment', [
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                ]);
            }

            $device = HotspotDevice::query()
                ->where('current_mac', $macAddress)
                ->orWhere('previous_mac', $macAddress)
                ->first();

            if ($device) {
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
        } catch (\Throwable $e) {
            Log::warning('Failed to generate/store hotspot device token', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(['success' => true], 200);
    }
}

