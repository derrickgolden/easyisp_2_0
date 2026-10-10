<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmsLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class WhatsappController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:send-message')->only(['send']);
    }

    public function send(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|regex:/^[\+]?[0-9]{10,15}$/',
            'message' => 'required|string|max:4096',
            'customer_id' => 'nullable|integer|exists:customers,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $organization = $request->user()->organization;
            $settings = $organization->settings ?? [];
            $whatsappSettings = $settings['whatsapp-gateway'] ?? null;

            // Validate WhatsApp gateway is configured
            if (!$whatsappSettings) {
                return response()->json([
                    'message' => 'WhatsApp gateway not configured. Please configure settings.',
                    'error' => 'WHATSAPP_NOT_CONFIGURED'
                ], 400);
            }

            $phoneNumberId = $whatsappSettings['phone_number_id'] ?? null;
            $accessToken = $whatsappSettings['access_token'] ?? null;
            $phoneNumber = $whatsappSettings['phone_number'] ?? null;

            if (!$phoneNumberId || !$accessToken) {
                return response()->json([
                    'message' => 'WhatsApp gateway credentials incomplete.',
                    'error' => 'INCOMPLETE_CREDENTIALS'
                ], 400);
            }

            $phone = $request->input('phone');
            $message = $request->input('message');

            // Normalize phone number (remove +, ensure leading country code)
            $normalizedPhone = preg_replace('/[^\d]/', '', $phone);
            if (strlen($normalizedPhone) === 10) {
                // Assume Kenya if only 10 digits
                $normalizedPhone = '254' . substr($normalizedPhone, 1);
            } elseif (strlen($normalizedPhone) === 9) {
                // If 9 digits, prepend Kenya code
                $normalizedPhone = '254' . $normalizedPhone;
            }
Log::info('Normalized phone number for WhatsApp', [
                'original' => $phone,
                'normalized' => $normalizedPhone,
                'phone_number_id' => $phoneNumberId,
                'organization_id' => $organization->id,
                'access_token_set' => !empty($accessToken),

            ]);
            // Send message via Meta WhatsApp Cloud API
            $result = $this->sendViaMetaApi($phoneNumberId, $accessToken, $normalizedPhone, $message);

            if ($result['success']) {
                // Log successful message
                SmsLog::create([
                    'organization_id' => $organization->id,
                    'user_id' => $request->user()->id,
                    'customer_id' => $request->input('customer_id'),
                    'phone' => $phone,
                    'message' => $message,
                    'status' => 'success',
                    'provider' => 'whatsapp',
                    'message_id' => $result['message_id'] ?? null,
                    'type' => 'single',
                ]);

                return response()->json([
                    'message' => 'WhatsApp message sent successfully',
                    'data' => [
                        'message_id' => $result['message_id'],
                        'phone' => $phone,
                    ],
                ]);
            } else {
                throw new \Exception($result['error'] ?? 'Failed to send WhatsApp message');
            }

        } catch (\Exception $e) {
            // Log failed message
            try {
                $organization = $request->user()->organization;
                SmsLog::create([
                    'organization_id' => $organization->id,
                    'user_id' => $request->user()->id,
                    'customer_id' => $request->input('customer_id'),
                    'phone' => $request->input('phone'),
                    'message' => $request->input('message'),
                    'status' => 'failed',
                    'provider' => 'whatsapp',
                    'error_message' => $e->getMessage(),
                    'type' => 'single',
                ]);
            } catch (\Exception $logError) {
                Log::error('Failed to log WhatsApp error: ' . $logError->getMessage());
            }

            return response()->json([
                'message' => $e->getMessage(),
                'error' => 'WHATSAPP_SEND_ERROR'
            ], 500);
        }
    }

    /**
     * Send message via Meta WhatsApp Cloud API
     */
    private function sendViaMetaApi($phoneNumberId, $accessToken, $recipientPhone, $message)
    {
        try {
            // $url = "https://graph.instagram.com/v18.0/{$phoneNumberId}/messages";
            $url = "https://graph.facebook.com/v25.0/{$phoneNumberId}/messages";

            $data = [
                'messaging_product' => 'whatsapp',
                'to' => $recipientPhone,
                'type' => 'text',
                'text' => [
                    'preview_url' => false,
                    'body' => $message,
                ],
            ];

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => '',
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => 'POST',
                CURLOPT_POSTFIELDS => json_encode($data),
                CURLOPT_HTTPHEADER => [
                    'Authorization: Bearer ' . $accessToken,
                    'Content-Type: application/json',
                ],
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
Log::info('Meta WhatsApp API response', [
                'http_code' => $httpCode,
                'response' => $response,
            ]);
            $result = json_decode($response, true);

            if ($httpCode === 200 && isset($result['messages'][0]['id'])) {
                return [
                    'success' => true,
                    'message_id' => $result['messages'][0]['id'],
                ];
            } else {
                $errorMessage = $result['error']['message'] ?? 'Unknown error from Meta API';
                Log::error('Meta WhatsApp API error', [
                    'http_code' => $httpCode,
                    'response' => $result,
                ]);
                return [
                    'success' => false,
                    'error' => $errorMessage,
                ];
            }
        } catch (\Exception $e) {
            Log::error('Exception while sending WhatsApp message', [
                'exception' => $e->getMessage(),
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
