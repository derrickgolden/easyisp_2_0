<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\OrganizationLicenseSnapshot;
use App\Models\Organization;
use App\Services\CallbackResolverService;
use App\Services\IncomingPaymentService;
use App\Services\PhoneNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class PayheroPaymentController extends Controller
{
    //
    private $baseUrl = 'https://backend.payhero.co.ke/api/v2/payments';
    
    public function __construct(){
        $this->middleware('permission:stk-push')->only(['stkPush']);
    }

    private function getBasicAuthToken(array $settings = [])
    {
        $username = data_get($settings, 'api_username');
        $password = data_get($settings, 'api_password');
        $credentials = $username . ':' . $password;
        return 'Basic ' . base64_encode($credentials);
    }

    public function stkPush(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'amount' => 'required|numeric|min:1',
            'customer_id' => 'required|integer|exists:customers,id',
        ]);

        try {
            $organization = $request->user()->organization;
            $settings = $organization->getPaymentGatewayConfig('payhero');
            $providerSetting = trim((string) (data_get($settings, 'provider') ?? ''));
            if ($providerSetting !== 'payhero') {
                Log::error('Payhero STK: payment gateway provider not set to payhero', [
                    'organization_id' => $organization?->id,
                    'provider' => $providerSetting,
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Payhero is not configured as the payment provider for this organization.',
                ], 422);
            }

            $channelId = trim((string) (data_get($settings, 'channel_id') ?? ''));
            $appUrl = rtrim((string) config('app.url'), '/');
            $callbackToken = trim((string) $organization->callback_token);
            $callbackUrl = $appUrl . '/api/payments/payhero/' . urlencode($callbackToken) . '/stk/callback';

            if ($channelId === '' || $appUrl === '' || $callbackToken === '') {
                Log::error('Payhero STK: missing payhero settings', [
                    'organization_id' => $organization?->id,
                    'channel_id_set' => $channelId !== '',
                    'app_url_set' => $appUrl !== '',
                    'callback_token_set' => $callbackToken !== '',
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Payhero configuration incomplete. Set channel_id and configure the application URL and callback token.',
                ], 422);
            }

            $customerId = $request->input('customer_id');
            $customerReference = null;

            if ($customerId) {
                $customerReference = trim((string) Customer::where('id', $customerId)
                    ->value('radius_username'));
            }

            $externalReference = $customerReference !== ''
                ? $customerReference
                : 'ORG-' . $request->user()->organization_id . '-INV-' . now()->timestamp;

            $response =  Http::withOptions([
                'verify' => true, // <- ignore SSL verification
            ])->withHeaders([
                'Authorization' => $this->getBasicAuthToken($settings),
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl, [
                'amount' => $request->amount,
                'phone_number' => $request->phone,
                'channel_id' => $channelId,
                'provider' => 'm-pesa',
                'external_reference' => $externalReference,
                'callback_url' =>  $callbackUrl,
            ]);

            if ($response->successful()) {
                session(['session-details' => $request->phone]);
                Log::info("stk msg" . $response);

                return response()->json([
                    'success' => true,
                    'message' => 'STK push initiated. Enter PIN to continue.',
                    'data' => $response->json(),
                ]);
            } else {
                Log::error('STK Push error: ' . $response);
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to initiate STK push.',
                    'data' => $response->json(),
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('STK Push error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Server Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function stkCallback(Request $request, $token)
    {
        $organization = Organization::where('callback_token', $token)->first();
        
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

        $isSuccess = (bool) $status && (int) ($response['ResultCode'] ?? 1) === 0;
        if (!$isSuccess) {
            Log::warning('Payhero STK callback marked unsuccessful', [
                'status' => $status,
                'result_code' => $response['ResultCode'] ?? null,
            ]);

            return response()->json(['success' => false, 'message' => 'Unsuccessful callback'], 200);
        }

        $amount = (float) ($response['Amount'] ?? 0);
        $phone = $response['Phone'] ?? $response['phone_number'] ?? null;
        $externalReference = $response['ExternalReference']
            ?? $response['external_reference']
            ?? $request->input('external_reference');
        $mpesaReceiptNumber = (string) (
            $response['MpesaReceiptNumber']
            ?? $response['M-PesaReceiptNumber']
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

        $normalizedPhone = PhoneNumberService::normalizeToE164((string) $phone) ?: (string) $phone;
        $customer = app(CallbackResolverService::class)
            ->resolveCustomerFromCallback($organization->id, $externalReference, $normalizedPhone);

        $amountAsDecimal = number_format($amount, 2, '.', '');

        try {
            if ($customer) {
                $result = app(IncomingPaymentService::class)->processC2BPayment(
                    $organization,
                    $customer,
                    $mpesaReceiptNumber !== '' ? $mpesaReceiptNumber : ('PAYHERO-' . $organization->id . '-' . now()->timestamp),
                    $amount,
                    $externalReference,
                    $normalizedPhone,
                    null,
                );

                if ($result['duplicate']) {
                    return response()->json(['success' => true, 'message' => 'Duplicate callback ignored'], 200);
                }

                Log::info('Payhero STK callback customer payment applied', [
                    'organization_id' => $organization->id,
                    'customer_id' => $customer->id,
                    'amount' => $amount,
                    'phone' => $normalizedPhone,
                    'external_reference' => $externalReference,
                    'mpesa_code' => $mpesaReceiptNumber,
                ]);

                return response()->json(['success' => true], 200);
            }

            $settledSnapshot = DB::transaction(function () use ($organization, $amountAsDecimal, $amount, $phone, $externalReference) {
                $lockedOrganization = Organization::where('id', $organization->id)
                    ->lockForUpdate()
                    ->first();

                $snapshot = OrganizationLicenseSnapshot::where('organization_id', $organization->id)
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
                            'paid_via' => 'payhero_stk',
                            'payhero_external_reference' => $externalReference,
                            'payhero_phone' => $phone,
                            'payhero_amount' => $amount,
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

            Log::info('Payhero STK callback organization balance updated', [
                'organization_id' => $organization->id,
                'amount' => $amount,
                'phone' => $phone,
                'external_reference' => $externalReference,
                'license_snapshot_paid' => $settledSnapshot?->id,
                'credited_to_org_balance' => $settledSnapshot === null,
            ]);

            return response()->json(['success' => true], 200);
        } catch (\Throwable $e) {
            Log::error('Failed to update organization balance from Payhero callback', [
                'error' => $e->getMessage(),
                'organization_id' => $organization->id,
                'amount' => $amount,
                'phone' => $phone,
            ]);

            return response()->json(['success' => false, 'message' => 'Server error'], 500);
        }
    }

}
