<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\HotspotPackage;
use App\Models\HotspotPayment;
use App\Models\Organization;
use App\Models\OrganizationPaymentGateway;
use App\Models\Site;
use App\Services\IncomingPaymentService;
use App\Services\PhoneNumberService;
use App\Traits\InteractsWithKopokopoSdk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Kopokopo\SDK\K2;

class KopokopoTillController extends Controller
{
    use InteractsWithKopokopoSdk;

    public function __construct()
    {
        $this->middleware('permission:stk-push')->only(['adminStkPush']);
    }

    public function adminStkPush(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'phone' => 'required|string',
            'amount' => 'required|numeric|min:1',
        ]);

        $organization = $request->user()?->organization;
        if (! $organization) {
            return response()->json([
                'success' => false,
                'message' => 'Organization not found for authenticated user.',
            ], 404);
        }

        $customer = Customer::query()
            ->where('organization_id', $organization->id)
            ->find($validated['customer_id']);

        if (! $customer) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found for this organization.',
            ], 404);
        }

        $settings = $organization->getPaymentGatewayConfig('kopokopo');
        Log::info('KopoKopo settings for organization', [
            'organization_id' => $organization->id,
            'settings' => $settings,
        ]);
        if (strtolower(trim((string) data_get($settings, 'provider', ''))) !== 'kopokopo') {
            return response()->json([
                'success' => false,
                'message' => 'KopoKopo is not configured as an active payment provider for this organization.',
            ], 422);
        }

        $clientId = trim((string) data_get($settings, 'client_id', ''));
        $clientSecret = trim((string) data_get($settings, 'client_secret', ''));
        $apiKey = trim((string) data_get($settings, 'api_key', ''));
        $appUrl = rtrim((string) config('app.url'), '/');
        $callbackToken = trim((string) $organization->callback_token);
        $callbackUrl = $appUrl . '/api/payments/kopokopo/' . urlencode($callbackToken) . '/stk/callback';
        $tillNumber = trim((string) (data_get($settings, 'till_number') ?? data_get($settings, 'till') ?? ''));

        if ($clientId === '' || $clientSecret === '' || $apiKey === '' || $appUrl === '' || $callbackToken === '' || $tillNumber === '') {
            return response()->json([
                'success' => false,
                'message' => 'KopoKopo configuration is incomplete. Check the client ID, client secret, API key, till number, application URL, and callback token.',
            ], 422);
        }

        $phone = PhoneNumberService::normalizeToE164($validated['phone']);
        if (! $phone) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid phone format. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.',
            ], 422);
        }

        $sdk = $this->getSdk($settings);
        $accessToken = $this->getAccessToken($settings);
    
        if (! $sdk || ! $accessToken) {
            return response()->json([
                'success' => false,
                'message' => 'KopoKopo payment service is unavailable right now. Please try again shortly.',
            ], 503);
        }

        $amount = (int) round((float) $validated['amount']);
        $accountReference = $customer->radius_username ?: 'CUST-' . $customer->id;
        $nameParts = preg_split('/\s+/', trim((string) $customer->first_name . ' ' . (string) $customer->last_name), 2) ?: [];
        Log::info('Initiating KopoKopo STK push', [
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'phone' => $phone,
            'amount' => $amount,
            'account_reference' => $accountReference,
            'name_parts' => $nameParts,
            'callback_url' => $callbackUrl,
        ]);
        try {
            $response = $sdk->StkService()->initiateIncomingPayment([
                'paymentChannel' => 'M-PESA STK Push',
                'tillNumber' => $tillNumber,
                'firstName' => $nameParts[0] ?? 'Customer',
                'lastName' => $nameParts[1] ?? '',
                'phoneNumber' => $phone,
                'amount' => $amount,
                'currency' => 'KES',
                'email' => (string) ($customer->email ?? ''),
                'callbackUrl' => $callbackUrl,
                'accessToken' => $accessToken,
                'metadata' => [
                    'customerId' => (string) $customer->id,
                    'invoiceNumber' => $accountReference,
                ],
            ]);
        } catch (\Throwable $exception) {
            Log::error('KopoKopo customer STK push failed', [
                'organization_id' => $organization->id,
                'customer_id' => $customer->id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to initiate KopoKopo STK push. Please try again later.',
            ], 502);
        }

        if (data_get($response, 'status') !== 'success') {
            Log::error('KopoKopo customer STK push returned an error', [
                'organization_id' => $organization->id,
                'customer_id' => $customer->id,
                'response' => $response,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'KopoKopo STK push failed. Please try again later.',
                'details' => $response,
            ], 502);
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment request sent, please complete the KopoKopo prompt.',
            'provider' => 'kopokopo',
            'account_reference' => $accountReference,
            'location' => data_get($response, 'location') ?? data_get($response, 'Location'),
        ]);
    }

    public function stkCallback(Request $request, string $token)
    {
        $organization = $this->resolveOrganizationFromToken($token);

        if (! $organization) {
            Log::warning('KopoKopo STK callback invalid token', [
                'token' => $token,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid token',
            ], 401);
        }

        $payload = $request->all();
        Log::info('Received KopoKopo STK callback', [
            'organization_id' => $organization->id,
            'token' => $token,
            'payload' => $payload,
        ]);

        $status = strtolower((string) data_get($payload, 'data.attributes.status', ''));
        if ($status !== 'success') {
            Log::warning('KopoKopo STK callback unsuccessful', [
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
        $amount = (float) (data_get($resource, 'amount') ?? data_get($resource, 'Amount') ?? 0);
        $phoneRaw = (string) (data_get($resource, 'sender_phone_number') ?? '');
        $phone = PhoneNumberService::normalizeToE164($phoneRaw) ?: $phoneRaw;
        $paymentReference = (string) (data_get($payload, 'data.attributes.metadata.invoiceNumber')
            ?? data_get($resource, 'reference')
            ?? '');
        $mpesaReceiptNumber = (string) (data_get($resource, 'id') ?? data_get($payload, 'data.id') ?? '');
        $senderFirst = (string) data_get($resource, 'sender_first_name', '');
        $senderLast = (string) data_get($resource, 'sender_last_name', '');
        $senderName = trim($senderFirst . ' ' . $senderLast) ?: null;

        if ($amount <= 0 || $phone === '' || $mpesaReceiptNumber === '') {
            Log::warning('KopoKopo STK callback missing required success fields', [
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

        $customer = $this->resolveCustomerFromCallback($organization->id, $paymentReference, $phone);

        try {
            $result = app(IncomingPaymentService::class)->processC2BPayment(
                $organization,
                $customer,
                $mpesaReceiptNumber,
                $amount,
                $paymentReference,
                $phone,
                $senderName,
            );

            if ($result['duplicate']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Duplicate callback ignored',
                ], 200);
            }

            return response()->json(['success' => true], 200);
        } catch (\Throwable $e) {
            Log::error('Failed to process KopoKopo STK callback payment', [
                'error' => $e->getMessage(),
                'organization_id' => $organization->id,
                'amount' => $amount,
                'phone' => $phone,
                'mpesa_receipt_number' => $mpesaReceiptNumber,
            ]);

            return response()->json(['success' => false, 'message' => 'Server error'], 500);
        }
    }

    private function resolveOrganizationFromToken(string $token): ?Organization
    {
        $organization = Organization::where('callback_token', $token)->first();
        if ($organization) {
            return $organization;
        }

        $gateway = OrganizationPaymentGateway::query()
            ->where('provider', 'kopokopo')
            ->where('active', true)
            ->get()
            ->first(function ($gateway) use ($token) {
                $callbackUrl = trim((string) data_get((array) ($gateway->config ?? []), 'callback_url', ''));
                return $callbackUrl !== '' && str_contains($callbackUrl, '/api/payments/kopokopo/' . $token . '/stk/callback');
            });

        if (! $gateway) {
            return null;
        }

        return $gateway->organization()->first();
    }

    private function resolveCustomerFromCallback(int $organizationId, ?string $accountReference, string $phone): ?Customer
    {
        $query = Customer::where('organization_id', $organizationId);

        if (! empty($accountReference)) {
            $customer = (clone $query)
                ->whereRaw('LOWER(TRIM(radius_username)) = ?', [strtolower(trim($accountReference))])
                ->first();
            if ($customer) {
                return $customer;
            }
        }

        $customer = (clone $query)
            ->where('phone', $phone)
            ->latest('id')
            ->first();

        if ($customer) {
            return $customer;
        }

        $invoiceCustomerId = null;
        if (preg_match('/CUST-(\d+)/i', (string) $accountReference, $matches)) {
            $invoiceCustomerId = (int) $matches[1];
        }

        if ($invoiceCustomerId) {
            return (clone $query)->find($invoiceCustomerId);
        }

        return null;
    }

}
