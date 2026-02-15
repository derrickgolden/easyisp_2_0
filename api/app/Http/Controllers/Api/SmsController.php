<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SmsController extends Controller
{
    public function send(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|regex:/^[\+]?[0-9]{10,15}$/',
            'message' => 'required|string|max:160',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $organization = $request->user()->organization;
            $settings = $organization->settings ?? [];
            $smsSettings = $settings['sms-gateway'] ?? null;

            // Validate SMS gateway is configured
            if (!$smsSettings) {
                return response()->json([
                    'message' => 'SMS gateway not configured. Please configure settings.',
                    'error' => 'SMS_NOT_CONFIGURED'
                ], 400);
            }

            $provider = $smsSettings['provider'] ?? null;
            $apiKey = $smsSettings['api_key'] ?? null;
            $apiUsername = $smsSettings['api_username'] ?? null;  // ADD THIS LINE
            $senderId = $smsSettings['sender_id'] ?? 'EASYTECH';

            if (!$provider || !$apiKey) {
                return response()->json([
                    'message' => 'SMS gateway credentials incomplete.',
                    'error' => 'INCOMPLETE_CREDENTIALS'
                ], 400);
            }

            $phone = $request->input('phone');
            $message = $request->input('message');

            // Route to appropriate SMS provider
            $result = match ($provider) {
                "Africa's Talking" => $this->sendViaAfricasTalking($phone, $message, $senderId, $apiKey, $apiUsername), // PASS $apiUsername
                'Twilio' => $this->sendViaTwilio($phone, $message, $senderId, $apiKey),
                'Infobip' => $this->sendViaInfobip($phone, $message, $senderId, $apiKey),
                'BulkSMS.com' => $this->sendViaBulkSMS($phone, $message, $senderId, $apiKey),
                default => throw new \Exception("Unsupported SMS provider: {$provider}")
            };
            
            return response()->json([
                'message' => 'SMS sent successfully',
                'data' => $result,
            ]);

        // ... inside the send() function
        } catch (\Exception $e) {
            return response()->json([
                // Change 'Failed to send SMS' to the actual error message
                'message' => $e->getMessage(), 
                'error' => 'SMS_PROVIDER_ERROR'
            ], 500);
        }
    }

    /**
     * Send SMS via Africa's Talking API
     */
 
    private function sendViaAfricasTalking($phone, $message, $senderId, $apiKey, $apiUsername = null)
    {
        $username = $apiUsername ?? env('AFRICAS_TALKING_USERNAME', 'sandbox');
        $isSandbox = strtolower($username) === 'sandbox';

        // 1. Determine correct URL
        $url = $isSandbox 
            ? 'https://api.sandbox.africastalking.com/version1/messaging' 
            : 'https://api.africastalking.com/version1/messaging';

        // 2. Ensure phone number starts with + (e.g., +254...)
        if (!str_starts_with($phone, '+')) {
            // Remove leading zeros and prepend +254 (assuming Kenya, or adjust as needed)
            $phone = '+' . preg_replace('/^0+/', '254', $phone);
        }

        $postData = [
            'username' => $username,
            'to' => $phone,
            'message' => $message,
        ];

        // Important: sender_id is only used in Production and must be registered
        if (!$isSandbox && $senderId) {
            $postData['from'] = $senderId;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
            'apiKey: ' . $apiKey, // Ensure this is your Live API Key if username is not 'sandbox'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode != 201) {
            throw new \Exception("Africa's Talking Error: " . $response . " (Status: $httpCode)");
        }

        // Inside sendViaAfricasTalking
        $result = json_decode($response, true);
        $recipient = $result['SMSMessageData']['Recipients'][0] ?? null;

        if ($recipient && $recipient['status'] !== 'Success') {
            // This string (e.g., "InvalidPhoneNumber") will be sent to the frontend
            throw new \Exception($recipient['status']); 
        }
        return $result;
    }

    /**
     * Send SMS via Twilio
     */
    private function sendViaTwilio($phone, $message, $senderId, $apiKey)
    {
        // Extract Account SID and Auth Token from apiKey (format: "account_sid:auth_token")
        [$accountSid, $authToken] = explode(':', $apiKey);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.twilio.com/2010-04-01/Accounts/{$accountSid}/Messages.json");
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, "{$accountSid}:{$authToken}");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'From' => $senderId,
            'To' => $phone,
            'Body' => $message,
        ]));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 201) {
            throw new \Exception('Twilio API Error: ' . $response);
        }

        return json_decode($response, true);
    }

    /**
     * Send SMS via Infobip
     */
    private function sendViaInfobip($phone, $message, $senderId, $apiKey)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.infobip.com/sms/1/text/single');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: App ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'messages' => [
                [
                    'destinations' => [['to' => $phone]],
                    'from' => $senderId,
                    'text' => $message,
                ]
            ]
        ]));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode < 200 || $httpCode >= 300) {
            throw new \Exception('Infobip API Error: ' . $response);
        }

        return json_decode($response, true);
    }

    /**
     * Send SMS via BulkSMS
     */
    private function sendViaBulkSMS($phone, $message, $senderId, $apiKey)
    {
        // apiKey format: "username:password"
        [$username, $password] = explode(':', $apiKey);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.bulksms.com/v1/messages?auto-unicode=true');
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, "{$username}:{$password}");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'to' => $phone,
            'body' => $message,
            'from' => $senderId,
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 201) {
            throw new \Exception('BulkSMS API Error: ' . $response);
        }

        return json_decode($response, true);
    }
}