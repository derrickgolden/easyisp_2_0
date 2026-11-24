<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class EmailController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:send-message')->only(['send']);
    }

    public function send(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|integer',
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:10000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $organization = $request->user()->organization;
        if (!$organization) {
            return response()->json(['message' => 'Organization not found.', 'error' => 'ORGANIZATION_NOT_FOUND'], 400);
        }

        $customer = Customer::where('organization_id', $organization->id)
            ->find($request->integer('customer_id'));

        if (!$customer) {
            return response()->json(['message' => 'Customer not found.', 'error' => 'CUSTOMER_NOT_FOUND'], 404);
        }

        $email = trim((string) $customer->email);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'message' => 'This customer has no valid email address.',
                'error' => 'CUSTOMER_EMAIL_NOT_CONFIGURED',
            ], 422);
        }

        $emailSettings = $organization->settings['email-gateway'] ?? [];
        if (!is_array($emailSettings)) {
            $emailSettings = [];
        }

        $provider = strtolower(trim((string) ($emailSettings['provider'] ?? '')));
        $apiKey = trim((string) ($emailSettings['api_key'] ?? ''));
        $fromAddress = trim((string) ($emailSettings['from_address'] ?? ''));
        $fromName = trim((string) ($emailSettings['from_name'] ?? ''));

        if ($provider !== 'resend' || $apiKey === '' || $fromAddress === '') {
            return response()->json([
                'message' => 'Email gateway not configured. Configure Resend in ISP settings.',
                'error' => 'EMAIL_NOT_CONFIGURED',
            ], 400);
        }

        try {
            $response = Http::withToken($apiKey)->post('https://api.resend.com/emails', [
                'from' => $fromName !== '' ? "{$fromName} <{$fromAddress}>" : $fromAddress,
                'to' => [$email],
                'subject' => $request->input('subject'),
                'text' => $request->input('message'),
            ]);

            if (!$response->successful()) {
                $details = $response->json();
                $providerMessage = is_array($details)
                    ? (string) ($details['message'] ?? $details['error'] ?? 'Email provider rejected the request')
                    : 'Email provider rejected the request';

                Log::warning('Failed to send customer email', [
                    'organization_id' => $organization->id,
                    'customer_id' => $customer->id,
                    'status' => $response->status(),
                    'provider_message' => $providerMessage,
                ]);

                return response()->json([
                    'message' => $providerMessage,
                    'error' => 'EMAIL_PROVIDER_ERROR',
                ], 502);
            }

            return response()->json([
                'message' => 'Email sent successfully',
                'data' => $response->json(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to send customer email', [
                'organization_id' => $organization->id,
                'customer_id' => $customer->id,
                'exception' => get_class($e),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to send email.',
                'error' => 'EMAIL_PROVIDER_ERROR',
            ], 502);
        }
    }
}
