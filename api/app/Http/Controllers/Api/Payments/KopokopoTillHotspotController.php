<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;

use App\Models\HotspotCustomer;
use App\Models\HotspotDevice;
use App\Models\HotspotPayment;
use App\Models\HotspotPackage;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\OrganizationPaymentGateway;
use App\Models\Site;
use App\Services\HotspotSubscriptionService;
use App\Traits\InteractsWithKopokopoSdk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class KopokopoTillHotspotController extends Controller
{
    use InteractsWithKopokopoSdk;

    public function resolveGatewaySettings(Request $request, Organization $organization): array
    {
        $defaultGateway = $request->input('default_gateway');

        if (is_array($defaultGateway) && strtolower((string) data_get($defaultGateway, 'provider', '')) === 'kopokopo') {
            $settings = (array) data_get($defaultGateway, 'config', []);
            if ($settings !== []) {
                return array_merge(['provider' => 'kopokopo'], $settings);
            }
        }

        $gateway = OrganizationPaymentGateway::query()
            ->where('organization_id', $organization->id)
            ->where('provider', 'kopokopo')
            ->where('active', true)
            ->orderByDesc('is_default')
            ->first();

        if ($gateway) {
            $settings = (array) ($gateway->config ?? []);
            $settings['provider'] = 'kopokopo';

            return $settings;
        }

        return [];
    }

    public function stkPush(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'site_ip' => 'required',
            'package_id' => 'required',
            'mac' => 'nullable|string|max:20',
            'ip' => 'nullable|string|max:45',
        ]);

        $siteIp = (string) $request->input('site_ip');
        $siteId = $request->input('site_id');
        $site = $siteId ? Site::find((int) $siteId) : Site::query()->where('ip_address', $siteIp)->first();

        if (! $site) {
            return response()->json([
                'success' => false,
                'message' => 'Site not found.',
            ], 422);
        }

        $organization = $request->input('organization')
            ? Organization::find((int) $request->input('organization'))
            : Organization::find($site->organization_id);

        if (! $organization) {
            Log::error('KopoKopo STK (hotspot): Organization not found for site', [
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

        if (! $package) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid package selected.',
            ], 422);
        }

        $settings = $this->resolveGatewaySettings($request, $organization);
        $clientId = trim((string) data_get($settings, 'client_id', ''));
        $clientSecret = trim((string) data_get($settings, 'client_secret', ''));
        $apiKey = trim((string) data_get($settings, 'api_key', ''));
        $appUrl = rtrim((string) config('app.url'), '/');
        $callbackToken = trim((string) $organization->callback_token);
        $callbackUrl = $appUrl . '/api/payments/kopokopo/hotspot/' . urlencode($callbackToken) . '/stk/callback';
        $tillNumber = trim((string) (data_get($settings, 'till_number') ?? data_get($settings, 'till') ?? ''));

        if ($clientId === '' || $clientSecret === '' || $apiKey === '' || $appUrl === '' || $callbackToken === '' || $tillNumber === '') {
            Log::error('KopoKopo STK (hotspot): missing gateway settings', [
                'organization_id' => $organization->id,
                'site_id' => $site->id,
                'gateway_settings_present' => ! empty($settings),
                'client_id_set' => $clientId !== '',
                'client_secret_set' => $clientSecret !== '',
                'api_key_set' => $apiKey !== '',
                'app_url_set' => $appUrl !== '',
                'callback_token_set' => $callbackToken !== '',
                'till_number_set' => $tillNumber !== '',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'KopoKopo configuration incomplete. Contact the administrator.',
            ], 422);
        }

        $phone = trim((string) $request->input('phone', ''));
        $mac = trim((string) ($request->input('mac') ?? ''));
        $amount = (int) round((float) $package->price);

        $payment = HotspotPayment::create([
            'organization_id' => $organization->id,
            'site_id' => $site->id,
            'package_id' => $package->id,
            'phone' => $phone,
            'mac_address' => $mac,
            'ip_address' => $request->input('ip'),
            'amount' => $amount,
            'status' => 'pending',
        ]);

        $paymentReference = 'HS-' . $organization->id
            . '-PKG-' . $package->id
            . ($mac !== '' ? '-MAC-' . $mac : '');

        $payment->update([
            'account_reference' => $paymentReference,
            'checkout_request_id' => $payment->id,
        ]);

        $accessToken = $this->getAccessToken($settings);
        if (! $accessToken) {
            Log::error('KopoKopo STK (hotspot): Failed to fetch access token', [
                'organization_id' => $organization->id,
                'site_id' => $site->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'KopoKopo payment service is unavailable right now. Please try again shortly.',
            ], 503);
        }

        $sdk = $this->getSdk($settings);
        if (! $sdk) {
            return response()->json([
                'success' => false,
                'message' => 'KopoKopo configuration incomplete. Contact the administrator.',
            ], 422);
        }

        $incomingPaymentPayload = [
            'paymentChannel' => 'M-PESA STK Push',
            'tillNumber' => $tillNumber,
            'firstName' => 'Hotspot',
            'lastName' => 'Customer',
            'phoneNumber' => preg_replace('/^0/', '254', $phone) ?: $phone,
            'amount' => $amount,
            'currency' => 'KES',
            'email' => '',
            'callbackUrl' => $callbackUrl,
            'accessToken' => $accessToken,
            'metadata' => [
                'customerId' => (string) $organization->id,
                'invoiceNumber' => $paymentReference,
                'siteId' => (string) $site->id,
                'packageId' => (string) $package->id,
                'mac' => $mac,
            ],
        ];

        $response = $sdk->StkService()->initiateIncomingPayment($incomingPaymentPayload);

        $location = data_get($response, 'location') ?? data_get($response, 'Location') ?? null;

        $payment->update([
            'account_reference' => $paymentReference,
            'checkout_request_id' => $location ?? $payment->id,
        ]);

        if (data_get($response, 'status') !== 'success') {
            Log::error('KopoKopo STK push returned an error', [
                'organization_id' => $organization->id,
                'status' => data_get($response, 'status'),
                'body' => $response,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'KopoKopo STK push failed. Please try again later.',
                'provider' => 'kopokopo',
                'details' => $response,
            ], 502);
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment request sent, please complete the KopoKopo prompt.',
            'provider' => 'kopokopo',
            'checkout_request_id' => $location ?? $payment->id,
            'account_reference' => $paymentReference,
            'callback_url' => $callbackUrl,
            'location' => $location,
            'gateway' => [
                'api_key_present' => $apiKey !== '',
                'callback_url' => $callbackUrl,
            ],
        ], 200);
    }

    public function stkCallback(Request $request, string $token)
    {
        $organization = Organization::where('callback_token', $token)->first();

        if (! $organization) {
            Log::warning('KopoKopo hotspot callback invalid token', [
                'token' => $token,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid token',
            ], 401);
        }

        $payload = $request->all();

        Log::info('KopoKopo STK callback received', [
            'organization_id' => $organization->id,
            'token' => $token,
            'request_ip' => $request->ip(),
            'payload' => $payload,
        ]);

        $status = strtolower((string) data_get($payload, 'data.attributes.status', ''));
        if ($status !== 'success') {
            Log::warning('KopoKopo hotspot callback unsuccessful', [
                'organization_id' => $organization->id,
                'status' => $status,
                'errors' => data_get($payload, 'data.attributes.event.errors'),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unsuccessful callback',
                'status' => $status,
                'errors' => data_get($payload, 'data.attributes.event.errors'),
            ], 200);
        }

        $resource = data_get($payload, 'data.attributes.event.resource', []);
        $amount = (float) (data_get($resource, 'amount') ?? 0);
        $phoneRaw = (string) (data_get($resource, 'sender_phone_number') ?? '');
        $phone = app(AllHotspotPaymentController::class)->normalizeKenyanPhone($phoneRaw) ?: $phoneRaw;
        $invoiceNumber = (string) (data_get($payload, 'data.attributes.metadata.invoiceNumber') ?? '');
        $mpesaReceiptNumber = (string) (data_get($resource, 'id') ?? data_get($payload, 'data.id') ?? '');
        $macAddress = app(AllHotspotPaymentController::class)->normalizeMacAddress((string) (data_get($payload, 'data.attributes.metadata.mac') ?? ''));

        if ($amount <= 0 || $phone === '' || $invoiceNumber === '') {
            Log::warning('KopoKopo hotspot callback missing required success fields', [
                'organization_id' => $organization->id,
                'amount' => $amount,
                'phone' => $phone,
                'invoice_number' => $invoiceNumber,
                'receipt' => $mpesaReceiptNumber,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid callback payload',
            ], 400);
        }

        $payment = HotspotPayment::query()
            ->where('organization_id', $organization->id)
            ->where('account_reference', $invoiceNumber)
            ->whereIn('status', ['pending', 'failed'])
            ->latest('id')
            ->first();

        if (! $payment) {
            $payment = HotspotPayment::query()
                ->where('organization_id', $organization->id)
                ->where('phone', $phone)
                ->whereIn('status', ['pending', 'failed'])
                ->latest('id')
                ->first();
        }

        if (! $payment) {
            Log::error('KopoKopo hotspot payment not found for callback', [
                'organization_id' => $organization->id,
                'invoice_number' => $invoiceNumber,
                'phone' => $phone,
                'amount' => $amount,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Payment record not found',
            ], 404);
        }

        $package = HotspotPackage::find($payment->package_id);
        if (! $package) {
            return response()->json([
                'success' => false,
                'message' => 'Package not found',
            ], 404);
        }

        $normalizedMac = $macAddress ?? app(AllHotspotPaymentController::class)->normalizeMacAddress((string) ($payment->mac_address ?? ''));
        if ($normalizedMac === null) {
            Log::error('KopoKopo hotspot callback missing/invalid MAC for activation', [
                'organization_id' => $organization->id,
                'payment_id' => $payment->id,
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

        if (! $customer) {
            $customer = app(AllHotspotPaymentController::class)->upsertHotspotCustomer(
                organizationId: $organization->id,
                siteId: $payment->site_id,
                phone: $phone,
                packageId: $payment->package_id,
                macAddress: $normalizedMac,
                attributes: [
                    'status' => 'expired',
                    'activated_at' => now(),
                    'ip_address' => (string) ($payment->ip_address ?? ''),
                    'password' => hash('sha256', $phone),
                    'expiry_date' => now(),
                ]
            );
            $payment->update(['customer_id' => $customer->id]);
        }

        $seconds = app(HotspotSubscriptionService::class)->resolveSessionTimeoutSeconds($package);
        $expiresAt = $seconds > 0 ? now()->addSeconds($seconds) : null;

        $customer->update([
            'expiry_date' => $expiresAt,
            'status' => 'active',
        ]);

        $voucher = $customer->voucher;
        if (empty($voucher)) {
            try {
                $voucher = app(HotspotSubscriptionService::class)->generateVoucher($customer);
                $customer->update(['voucher' => $voucher]);
            } catch (\Throwable $e) {
                Log::warning('Voucher generation failed during KopoKopo hotspot activation', [
                    'customer_id' => $customer->id,
                    'organization_id' => $organization->id,
                    'error' => $e->getMessage(),
                ]);
                $voucher = null;
            }
        }

        app(HotspotSubscriptionService::class)->applyActiveStatus($customer, array_filter([$mpesaReceiptNumber, $voucher]));

        $payment->update([
            'status' => 'paid',
            'mpesa_receipt' => $mpesaReceiptNumber,
            'expires_at' => $expiresAt,
            'account_reference' => $invoiceNumber,
        ]);

        try {
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);

            try {
                $payment->device_token = encrypt($rawToken);
                $payment->save();
            } catch (\Throwable $e) {
                Log::warning('Failed to encrypt/store KopoKopo device token on payment', [
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                ]);
            }

            $device = HotspotDevice::query()
                ->where('current_mac', $normalizedMac)
                ->orWhere('previous_mac', $normalizedMac)
                ->first();

            if ($device) {
                if ($device->current_mac && $device->current_mac !== $normalizedMac) {
                    $device->previous_mac = $device->current_mac;
                }

                $device->current_mac = $normalizedMac;
                $device->device_token_hash = $tokenHash;
                $device->customer_id = $customer->id ?? $device->customer_id;
                $device->last_seen_at = now();
                $device->save();
            } else {
                HotspotDevice::create([
                    'device_token_hash' => $tokenHash,
                    'current_mac' => $normalizedMac,
                    'previous_mac' => null,
                    'customer_id' => $customer->id ?? null,
                    'last_seen_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to generate/store KopoKopo hotspot device token', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(['success' => true], 200);
    }
}
