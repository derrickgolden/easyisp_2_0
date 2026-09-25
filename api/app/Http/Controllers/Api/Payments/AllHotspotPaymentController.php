<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\HotspotPayment;
use App\Models\HotspotDevice;
use App\Models\Site;
use Illuminate\Http\Request;
use App\Models\HotspotPackage;
use App\Models\HotspotCustomer;
use Illuminate\Support\Facades\Validator;
use App\Services\HotspotSubscriptionService;
use Illuminate\Support\Facades\Log;

class AllHotspotPaymentController extends Controller
{
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
        $site = Site::query()->where('ip_address', $siteIp)->first();

        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site not found.',
            ], 422);
        }

        $organization = Organization::find($site->organization_id);
        if (!$organization) {
            Log::error('Hotspot STK dispatch: Organization not found for site', [
                'site_id' => $site->id,
                'request_ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Organization not found.',
            ], 422);
        }

        $defaultGateway = $organization->defaultPaymentGateway()->first()
            ?? $organization->paymentGateways()->where('active', true)->orderByDesc('is_default')->first();

        $provider = strtolower((string) (
            $defaultGateway?->provider
            ?? data_get($organization->getPaymentGatewayConfig(), 'provider')
            ?? data_get($organization->getPaymentGatewayConfig(), 'default')
            ?? ''
        ));

        Log::info('Hotspot STK dispatch selected gateway', [
            'organization_id' => $organization->id,
            'provider' => $provider,
            'site_id' => $site->id,
        ]);

        $request->merge([
            'organization' => $organization->id,
            'site_id' => $site->id,
            'payment_gateway_provider' => $provider,
            'payment_gateway_id' => $defaultGateway?->id,
            'default_gateway' => $defaultGateway?->toArray() ?? [
                'id' => null,
                'provider' => $provider,
                'config' => [],
            ],
        ]);

        if ($provider === 'payhero') {
            return app(PayheroHotspotController::class)->stkPush($request);
        }

        if (in_array($provider, ['mpesa', 'daraja'], true)) {
            return app(DarajaHotspotController::class)->stkPush($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'No default payment gateway.',
        ], 422);
    }

    public function checkStatus(Request $request)
    {
        $reference = (string) $request->query('reference', '');
        if (!$reference) {
            return response()->json([
                'status' => 'pending',
                'message' => 'No reference provided',
            ], 400);
        }

        $payment = \App\Models\HotspotPayment::query()
            ->where('checkout_request_id', $reference)
            ->orWhere('account_reference', 'LIKE', $reference . '%')
            ->latest('updated_at')
            ->first();

        if (!$payment) {
            return response()->json([
                'status' => 'pending',
                'message' => 'Payment not found or still processing',
            ], 200);
        }

        if ($payment->status === 'pending') {
            return response()->json([
                'status' => 'pending',
                'message' => 'Waiting for M-Pesa confirmation...',
            ], 200);
        }

        if ($payment->status === 'failed' || $payment->status === 'cancelled') {
            return response()->json([
                'status' => 'failed',
                'message' => $this->customerFriendlyFailureMessage($payment->reason ?? null, $payment->status),
            ], 200);
        }

        if ($payment->status === 'paid') {
            $macAddress = $this->normalizeMacAddress((string) ($payment->mac_address ?? ''));
            if ($macAddress === null) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Payment verified but MAC address is missing. Contact support.',
                ], 200);
            }

            $voucherCode = $macAddress;

            $deviceTokenPlain = null;
            if (!empty($payment->device_token)) {
                try {
                    $deviceTokenPlain = decrypt($payment->device_token);
                } catch (\Throwable $e) {
                    Log::warning('Failed to decrypt device token for payment', [
                        'payment_id' => $payment->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $response = [
                'status' => 'completed',
                'message' => 'Payment verified! Connecting to internet...',
                'code' => $voucherCode,
                'voucher_code' => $voucherCode,
                'mac' => $macAddress,
                'username' => $macAddress,
                'password' => $macAddress,
            ];

            if ($deviceTokenPlain !== null) {
                $response['device_token'] = $deviceTokenPlain;
            }

            return response()->json($response, 200);
        }

        return response()->json([
            'status' => 'pending',
            'message' => 'Unknown payment status',
        ], 200);
    }

    public function normalizeMacAddress(string $mac): ?string
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

    protected function customerFriendlyFailureMessage(?string $reason, ?string $status = null): string
    {
        $normalized = strtolower(trim((string) ($reason ?? '')));

        if ( str_contains($normalized, 'Cancelled by user') || $status === 'cancelled' || str_contains($normalized, 'cancel') || str_contains($normalized, 'user cancelled')) {
            return 'The payment was cancelled. Please try again.';
        }

        if (str_contains($normalized, 'cannot be reached') || str_contains($normalized, 'user cannot be reached')) {
            return 'M-Pesa could not reach you. Please try again.';
        }

        if (str_contains($normalized, 'timeout') || str_contains($normalized, 'timed out')) {
            return 'The payment request timed out. Please try again.';
        }

        if (str_contains($normalized, 'insufficient') || str_contains($normalized, 'not enough') || str_contains($normalized, 'over limit')) {
            return 'Your M-Pesa balance is not enough for this payment. Please top up and try again.';
        }

        if (str_contains($normalized, 'declined') || str_contains($normalized, 'rejected') || str_contains($normalized, 'failed')) {
            return 'The payment was declined. Please check your account details and try again.';
        }

        if (str_contains($normalized, 'network') || str_contains($normalized, 'service unavailable') || str_contains($normalized, 'temporarily unavailable')) {
            return 'The payment network is temporarily unavailable. Please try again in a few minutes.';
        }

        if ($normalized !== '') {
            return 'Your payment could not be completed. Please try again.';
        }

        return 'The payment was cancelled or declined. Please try again.';
    }

    public function normalizeKenyanPhone(string $phone): ?string
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

    public function upsertHotspotCustomer(
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

    public function claimCode(Request $request)
    {

        $validator = Validator::make($request->all(), [
            'code' => 'required|string',
            'mac' => 'required|string',
            'code_type' => 'required|string|in:token,mpesa_receipt,mpesa_code,voucher,voucher_code',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'The claim code request is invalid.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $codeType = match ($data['code_type']) {
            'mpesa_code' => 'mpesa_receipt',
            'voucher_code' => 'voucher',
            default => $data['code_type'],
        };

        if ($codeType === 'token') {
            return $this->claimToken($request);
        }

        if ($codeType === 'mpesa_receipt') {
            return $this->claimMpesaReceipt($request);
        }

        if ($codeType === 'voucher') {
            return $this->claimVoucher($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'Unsupported code type.',
        ], 422);
    }

    private function claimToken(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string',
            'mac' => 'required|string',
        ]);

        $tokenHash = hash('sha256', $data['code']);
        $macRaw = $data['mac'];
        $mac = $this->normalizeMacAddress($macRaw);
        if ($mac === null) {
            return response()->json(['success' => false, 'message' => 'Invalid MAC address'], 422);
        }

        $device = \App\Models\HotspotDevice::where('device_token_hash', $tokenHash)->first();
        if (!$device) {
            return response()->json(['success' => false, 'message' => 'Invalid or expired token'], 404);
        }

        // Ensure the device has an associated customer
        if (empty($device->customer_id)) {
            return response()->json(['success' => false, 'message' => 'No customer linked to this token'], 400);
        }

        $customer = HotspotCustomer::find($device->customer_id);
        if (!$customer) {
            return response()->json(['success' => false, 'message' => 'Customer not found'], 404);
        }

        // Update device record
        try {
            if ($device->current_mac && $device->current_mac !== $mac) {
                $device->previous_mac = $device->current_mac;
            }
            $device->current_mac = $mac;
            $device->last_seen_at = now();
            $device->customer_id = $customer->id;
            $device->save();
        } catch (\Throwable $e) {
            Log::error('Failed to update hotspot_devices: ' . $e->getMessage());
        }

        // Bind the MAC in RADIUS
        app(HotspotSubscriptionService::class)->applyActiveStatus($customer, $mac);

        return response()->json([
            'success' => true,
            'message' => 'Token claimed and MAC bound successfully',
            'username' => $mac,
            'mac' => $mac,
        ]);

    }

    private function claimMpesaReceipt(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string',
            'mac' => 'required|string',
        ]);

        $mpesaReceipt = $data['code'];
        $macRaw = $data['mac'];
        $mac = $this->normalizeMacAddress($macRaw);
        if ($mac === null) {
            return response()->json(['success' => false, 'message' => 'Invalid MAC address', 'code_type' => 'mpesa_receipt', 'error' => 'Opps! Something went wrong'], 422);
        }

        // Find the payment by M-Pesa receipt
        $payment = HotspotPayment::where('mpesa_receipt', $mpesaReceipt)->first();
        if (!$payment) {
            return response()->json(['success' => false, 'code_type' =>'mpesa_receipt', 'message' => 'Payment not found for this M-Pesa code', 'error' => 'Payment not found'], 404);
        }

        // Ensure the payment is completed
        if ($payment->status !== 'paid') {
            return response()->json(['success' => false, 'code_type' =>'mpesa_receipt', 'message' => 'Payment is not completed', 'error' => 'Payment not completed'], 400);
        }

        // Ensure the payment has an associated customer
        if (empty($payment->customer_id)) {
            return response()->json(['success' => false, 'code_type' =>'mpesa_receipt', 'message' => 'No customer linked to this payment', 'error' => 'Opps! Something went wrong'], 400);
        }

        $customer = HotspotCustomer::find($payment->customer_id);
        if (!$customer) {
            return response()->json(['success' => false, 'code_type' =>'mpesa_receipt', 'message' => 'Customer not found', 'error' => 'Opps! Something went wrong'], 404);
        }   



        // Update device record
        try {
            $device = HotspotDevice::where('current_mac', $mac)->orWhere('previous_mac', $mac)->first();
            if (!$device) {
                // Create a new device record if none exists
                $rawToken = null;
                $tokenHash = null;
                if ($customer->status === 'active' && $customer->expiry_date && $customer->expiry_date->isFuture()) {
                    // generate a new device token for the customer
                    $rawToken = bin2hex(random_bytes(32));
                    $tokenHash = hash('sha256', $rawToken);
                }

                $device = new HotspotDevice();
                $device->current_mac = $mac;
                $device->customer_id = $customer->id;
                $device->device_token_hash = $tokenHash;
                $device->last_seen_at = now();
                $device->save();

                app(HotspotSubscriptionService::class)->applyActiveStatus($customer, $mac);

                return response()->json([
                    'success' => true,
                    'message' => 'M-Pesa receipt claimed and MAC bound successfully',
                    'username' => $mpesaReceipt,
                    'mac' => $mac,
                    'device_token' => $rawToken ?? null,
                ]);
            } else {
                // Update existing device record
                if ($device->current_mac && $device->current_mac !== $mac) {
                    $device->previous_mac = $device->current_mac;
                }
                $device->current_mac = $mac;
                $device->last_seen_at = now();
                $device->customer_id = $customer->id;
                $device->save();

                app(HotspotSubscriptionService::class)->applyActiveStatus($customer, $mac);

                return response()->json([
                    'success' => true,
                    'message' => 'M-Pesa receipt claimed and MAC bound successfully',
                    'username' => $mpesaReceipt,
                    'mac' => $mac,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to update hotspot_devices for M-Pesa receipt claim: ' . $e->getMessage());
            return response()->json([
                    'success' => true,
                    'message' => 'Failed to bind MAC address',
                    'username' => $mpesaReceipt,
                    'mac' => $mac,
                ]);
        }
    }

    public function claimVoucher(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string',
            'mac' => 'required|string',
        ]);

        $voucherCode = $data['code'];
        $macRaw = $data['mac'];
        $mac = $this->normalizeMacAddress($macRaw);
        if ($mac === null) {
            return response()->json(['success' => false, 'message' => 'Invalid MAC address', 'code_type' => 'voucher', 'error' => 'Opps! Something went wrong'], 422);
        }

        // Find the customer by voucher code
        $customer = HotspotCustomer::where('voucher', $voucherCode)->first();
        if (!$customer) {
            return response()->json(['success' => false, 'code_type' => 'voucher', 'message' => 'Customer not found for this voucher', 'error' => 'Invalid voucher code'], 404);
        }

        // Update device record
        try {
            $device = HotspotDevice::where('current_mac', $mac)->orWhere('previous_mac', $mac)->first();
            if (!$device) {
                // Create a new device record if none exists
                $rawToken = null;
                $tokenHash = null;
                if ($customer->status === 'active' && $customer->expiry_date && $customer->expiry_date->isFuture()) {
                    // generate a new device token for the customer
                    $rawToken = bin2hex(random_bytes(32));
                    $tokenHash = hash('sha256', $rawToken);
                }

                $device = new HotspotDevice();
                $device->current_mac = $mac;
                $device->customer_id = $customer->id;
                $device->device_token_hash = $tokenHash;
                $device->last_seen_at = now();
                $device->save();

                app(HotspotSubscriptionService::class)->applyActiveStatus($customer, $mac);

                return response()->json([
                    'success' => true,
                    'message' => 'Voucher claimed and MAC bound successfully',
                    'username' => $voucherCode,
                    'mac' => $mac,
                    'device_token' => $rawToken ?? null,
                ]);
            } else {
                // Update existing device record
                if ($device->current_mac && $device->current_mac !== $mac) {
                    $device->previous_mac = $device->current_mac;
                }
                $device->current_mac = $mac;
                $device->last_seen_at = now();
                $device->customer_id = $customer->id;
                $device->save();
                app(HotspotSubscriptionService::class)->applyActiveStatus($customer, $mac);
                return response()->json([
                    'success' => true,
                    'message' => 'Voucher claimed and MAC bound successfully',
                    'username' => $voucherCode,
                    'mac' => $mac,
                ]);
            }
        } catch (\Throwable $e) {   
            Log::error('Failed to update hotspot_devices for voucher claim: ' . $e->getMessage());
            return response()->json([
                    'success' => true,
                    'message' => 'Voucher claimed and MAC bound successfully',
                    'username' => $voucherCode,
                    'mac' => $mac,
                ]);
        }
    }
}
