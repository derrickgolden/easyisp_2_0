<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Package;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DarajaPaymentController extends Controller
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
            'site_id'          => 'required',
            'package_id'       => 'required',
            'mac'              => 'nullable|string|max:20',
            'ip'               => 'nullable|string|max:45',
            'transaction_type' => 'nullable|in:CustomerPayBillOnline,CustomerBuyGoodsOnline',
        ]);

        // Resolve organization from site (guest portal — no authenticated user)
        $siteInput = (string) $request->input('site_id');
        $site = Site::query()
            ->where('id', $siteInput)
            ->orWhere('ip_address', $siteInput)
            ->first();

        if (!$site) {
            return redirect()->back()->withErrors(['site_id' => 'Site not found.']);
        }

        Log::info('Daraja STK push initiated (hotspot)', [
            'site_id' => $site->id,
            'site_ip_address' => $site->ip_address,
            'request_ip' => $request->ip(),
            'mac' => $request->input('mac'),
            'package_id' => $request->input('package_id'),
        ]);

        $organization = Organization::find($site->organization_id);
        if (!$organization) {
            Log::error('Daraja STK (hotspot): Organization not found for site', [
                'site_id' => $site->id,
                'request_ip' => $request->ip(),
            ]);
            return redirect()->back()->withErrors(['site_id' => 'Organization not found.']);
        }

        $package = Package::query()
            ->where('id', $request->input('package_id'))
            ->where('organization_id', $organization->id)
            ->first();

        if (!$package) {
            return redirect()->back()->withErrors(['package_id' => 'Invalid package selected.'])->withInput();
        }

        if (empty($organization->mpesa_callback_token)) {
            Log::error('Daraja STK (hotspot): Organization callback token missing', [
                'organization_id' => $organization->id,
                'site_id' => $site->id,
            ]);
            return redirect()->back()->withErrors(['payment' => 'Payment is not configured for this hotspot. Contact the administrator.']);
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
            return redirect()->back()->withErrors(['payment' => 'Payment is not configured for this hotspot. Contact the administrator.']);
        }


        $normalizedPhone = $this->normalizeKenyanPhone((string) $request->input('phone'));
        if (!$normalizedPhone) {
            Log::warning('Daraja STK (hotspot): Invalid phone format', [
                'organization_id' => $organization->id,
                'input_phone' => $request->input('phone'),
            ]);
            return redirect()->back()->withErrors(['phone' => 'Invalid phone number. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.'])->withInput();
        }

        $baseUrl = str_contains($environment, 'sandbox')
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

        // Build the hotspot callback URL from this portal's own app URL + the org token.
        // The route is: POST /daraja/{token}/callback
        $appUrl = rtrim((string) config('app.url'), '/');
        $appUrl = 'https://efe1-102-210-173-182.ngrok-free.app';
        $callbackUrl = $appUrl . '/daraja/' . urlencode((string) $organization->mpesa_callback_token) . '/callback';

        $timestamp = now()->format('YmdHis');
        $password = base64_encode($shortCode . $passkey . $timestamp);

        $amount = (int) round((float) $package->price);
        $amountString = (string) $amount;
        $partyB = (string) $shortCode;
        $mac = (string) ($request->input('mac') ?? '');
        $packageId = (string) ($request->input('package_id') ?? '');

        $payment = \App\Models\HotspotPayment::create([
            'organization_id' => $organization->id,
            'site_id' => $site->id,
            'package_id' => $package->id,
            'phone' => $normalizedPhone,
            'mac_address' => $request->mac,
            'ip_address' => $request->ip,
            'amount' => $amount,
            'status' => 'pending',
        ]);

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

                return redirect()->back()->withErrors(['payment' => 'Payment service unavailable. Please try again shortly.']);
            }

            $accessToken = $tokenResponse->json('access_token') ?? $tokenResponse->json('accessToken');
            Log::info('Daraja STK access token', ['access_token' => $accessToken]);
            if (!$accessToken) {
                return redirect()->back()->withErrors(['payment' => 'Payment service unavailable. Please try again shortly.']);
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
                return redirect()->back()->withErrors(['payment' => $errorMsg])->withInput();
            }

            return redirect()->back()->with('success', 'Payment request sent, please enter pin number.');
        } catch (\Throwable $e) {
            Log::error('Daraja STK push error', [
                'organization_id' => $organization->id,
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors(['payment' => 'An unexpected error occurred. Please try again.']);
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
        $payment = \App\Models\HotspotPayment::query()
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

        $package = Package::find($payment->package_id);

        if (!$package) {
            return response()->json([
                'success' => false
            ], 404);
        }

        $payment->update([
            'status' => 'paid',
            'mpesa_receipt' => $mpesaReceiptNumber,
        ]);

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

        $username = $macAddress;
        $password = $macAddress;
        $radiusConnection = $this->radiusConnection();

        $radiusConnection->table('radcheck')->updateOrInsert(
            [
                'username' => $username,
                'attribute' => 'Cleartext-Password',
            ],
            [
                'op' => ':=',
                'value' => $password,
            ]
        );

        $radiusConnection->table('radcheck')->updateOrInsert(
            [
                'username' => $username,
                'attribute' => 'Calling-Station-Id',
            ],
            [
                'op' => '==',
                'value' => $macAddress,
            ]
        );

        $downloadSpeed = data_get($package, 'download_speed') ?? data_get($package, 'speed_down');
        $uploadSpeed = data_get($package, 'upload_speed') ?? data_get($package, 'speed_up');
        $rateLimit = $this->buildMikrotikRateLimit($downloadSpeed, $uploadSpeed);

        if ($rateLimit !== null) {
            $radiusConnection->table('radreply')->updateOrInsert(
                [
                    'username' => $username,
                    'attribute' => 'Mikrotik-Rate-Limit',
                ],
                [
                    'op' => ':=',
                    'value' => $rateLimit,
                ]
            );
        }

        $seconds = $this->resolveSessionTimeoutSeconds($package);

        if ($seconds > 0) {
            $radiusConnection->table('radreply')->updateOrInsert(
                [
                    'username' => $username,
                    'attribute' => 'Session-Timeout',
                ],
                [
                    'op' => ':=',
                    'value' => (string) $seconds,
                ]
            );
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

        // TODO: trigger hotspot session provisioning here (e.g. dispatch a job,
        // call the MikroTik/NAS API, or fire an event) using $package->id and $payment->mac_address.

        $payment->update([
            'expires_at' => $seconds > 0 ? now()->addSeconds($seconds) : null,
        ]);
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

    private function buildMikrotikRateLimit(mixed $downloadSpeed, mixed $uploadSpeed): ?string
    {
        $download = $this->normalizeRateSpeedToken($downloadSpeed);
        $upload = $this->normalizeRateSpeedToken($uploadSpeed);

        if (!$download || !$upload) {
            return null;
        }

        return $download . '/' . $upload;
    }

    private function normalizeRateSpeedToken(mixed $speed): ?string
    {
        $raw = strtoupper(trim((string) ($speed ?? '')));
        if ($raw === '') {
            return null;
        }

        $compact = preg_replace('/\s+/', '', $raw) ?? '';
        if ($compact === '') {
            return null;
        }

        $compact = str_replace(['MBPS', 'MPS'], 'M', $compact);
        $compact = str_replace(['KBPS', 'KPS'], 'K', $compact);
        $compact = str_replace(['GBPS', 'GPS'], 'G', $compact);

        if (preg_match('/^\d+(\.\d+)?$/', $compact)) {
            return $compact . 'M';
        }

        if (preg_match('/^\d+(\.\d+)?[KMG]$/', $compact)) {
            return $compact;
        }

        return null;
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

    private function resolveSessionTimeoutSeconds(Package $package): int
    {
        $sessionTimeout = (int) data_get($package, 'session_timeout', 0);
        if ($sessionTimeout > 0) {
            return $sessionTimeout;
        }

        $durationHours = (int) data_get($package, 'duration_hours', 0);
        if ($durationHours > 0) {
            return $durationHours * 3600;
        }

        $validity = (int) data_get($package, 'validity', 0);
        if ($validity <= 0) {
            return 0;
        }

        $validityType = strtolower((string) data_get($package, 'validity_type', 'days'));

        return match ($validityType) {
            'minutes' => $validity * 60,
            'hours' => $validity * 3600,
            'months' => $validity * 30 * 86400,
            default => $validity * 86400,
        };
    }

}
