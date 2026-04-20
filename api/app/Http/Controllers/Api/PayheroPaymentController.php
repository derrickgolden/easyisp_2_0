<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\OrganizationLicenseSnapshot;
use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class PayheroPaymentController extends Controller
{
    //
    private $apiUsername;
    private $apiPassword;
    private $baseUrl = 'https://backend.payhero.co.ke/api/v2/payments';
    
    public function __construct(){
        $this->middleware('permission:stk-push')->only(['stkPush']);
        $this->apiUsername = env('API_USERNAME');
        $this->apiPassword = env('API_PASSWORD');
    }

    private function getBasicAuthToken()
    {
        $credentials = $this->apiUsername . ':' . $this->apiPassword;
        return 'Basic ' . base64_encode($credentials);
    }

    public function stkPush(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'amount' => 'required|numeric|min:1',
        ]);

        try {
            $response =  Http::withOptions([
                'verify' => true, // <- ignore SSL verification
            ])->withHeaders([
                'Authorization' => $this->getBasicAuthToken(),
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl, [
                'amount' => $request->amount,
                'phone_number' => $request->phone,
                'channel_id' => env('CHANNEL_ID'),
                'provider' => 'm-pesa',
                'external_reference' => 'ORG-' . $request->user()->organization_id . '-INV-' . now()->timestamp,
                'callback_url' =>  env('PAYHERO_CALLBACK_URL'),
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

    public function stkCallback(Request $request)
    {
        $payload = $request->all();

        Log::info('Payhero STK callback received', [
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

        if ($amount <= 0 || !$phone) {
            Log::warning('Payhero STK callback missing required success fields', [
                'amount' => $response['Amount'] ?? null,
                'phone' => $phone,
            ]);

            return response()->json(['success' => false, 'message' => 'Invalid callback payload'], 400);
        }

        $organization = $this->resolveOrganizationFromCallback($externalReference, $phone);
        if (!$organization) {
            Log::warning('Payhero STK callback could not resolve organization', [
                'external_reference' => $externalReference,
                'phone' => $phone,
            ]);

            return response()->json(['success' => false, 'message' => 'Organization not resolved'], 404);
        }

        $amountAsDecimal = number_format($amount, 2, '.', '');

        try {
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

    private function resolveOrganizationFromCallback(?string $externalReference, string $phone): ?Organization
    {
        if (!empty($externalReference) && preg_match('/ORG-(\d+)-/i', $externalReference, $matches)) {
            $organization = Organization::find((int) $matches[1]);
            if ($organization) {
                return $organization;
            }
        }

        $customer = Customer::where('phone', $phone)->latest('id')->first();

        if ($customer) {
            return Organization::find($customer->organization_id);
        }

        return Organization::whereHas('users', function ($query) use ($phone) {
            $query->where('phone', $phone);
        })->first();
    }

}
