<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendBulkSms;
use App\Models\SmsLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class SmsController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:send-message')->only(['send']);
        $this->middleware('permission:send-bulk-messages')->only(['sendBulk']);
    }

    public function send(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|regex:/^[\+]?[0-9]{10,15}$/',
            'message' => 'required|string|max:160',
            'customer_id' => 'nullable|integer|exists:customers,id',
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

            // Log successful SMS
            SmsLog::create([
                'organization_id' => $organization->id,
                'user_id' => $request->user()->id,
                'customer_id' => $request->input('customer_id'),
                'phone' => $phone,
                'message' => $message,
                'status' => 'success',
                'provider' => $provider,
                'type' => 'single',
            ]);
            
            return response()->json([
                'message' => 'SMS sent successfully',
                'data' => $result,
            ]);

        // ... inside the send() function
        } catch (\Exception $e) {
            // Log failed SMS
            try {
                $organization = $request->user()->organization;
                SmsLog::create([
                    'organization_id' => $organization->id,
                    'user_id' => $request->user()->id,
                    'customer_id' => $request->input('customer_id'),
                    'phone' => $request->input('phone'),
                    'message' => $request->input('message'),
                    'status' => 'failed',
                    'provider' => $organization->settings['sms-gateway']['provider'] ?? null,
                    'error_message' => $e->getMessage(),
                    'type' => 'single',
                ]);
            } catch (\Exception $logError) {
                Log::error('Failed to log SMS error: ' . $logError->getMessage());
            }

            return response()->json([
                // Change 'Failed to send SMS' to the actual error message
                'message' => $e->getMessage(), 
                'error' => 'SMS_PROVIDER_ERROR'
            ], 500);
        }
    }

    /**
     * Send bulk SMS to multiple recipients
     */
    public function sendBulk(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'recipients' => 'required|array|min:1',
            'recipients.*.phone' => 'required|string|regex:/^[\+]?[0-9]{10,15}$/',
            'recipients.*.message' => 'required|string|max:500',
            'recipients.*.customer_id' => 'nullable|integer|exists:customers,id',
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
            $apiUsername = $smsSettings['api_username'] ?? null;
            $senderId = $smsSettings['sender_id'] ?? 'EASYTECH';

            if (!$provider || !$apiKey) {
                return response()->json([
                    'message' => 'SMS gateway credentials incomplete.',
                    'error' => 'INCOMPLETE_CREDENTIALS'
                ], 400);
            }

            $recipients = $request->input('recipients');
            $totalRecipients = count($recipients);

            // Process in chunks of 50 recipients per job
            $chunkSize = 50;
            $chunks = array_chunk($recipients, $chunkSize);
            $jobsDispatched = count($chunks);

            // Dispatch jobs for each chunk
            foreach ($chunks as $index => $chunk) {
                SendBulkSms::dispatch(
                    $chunk,
                    $organization->id,
                    $request->user()->id,
                    $provider,
                    $apiKey,
                    $apiUsername,
                    $senderId
                )->delay(now()->addSeconds($index * 2)); // Stagger jobs by 2 seconds
            }

            Log::info('Bulk SMS jobs dispatched', [
                'total_recipients' => $totalRecipients,
                'jobs_dispatched' => $jobsDispatched,
                'chunk_size' => $chunkSize,
                'organization_id' => $organization->id,
                'user_id' => $request->user()->id,
            ]);

            return response()->json([
                'message' => "Bulk SMS queued successfully. Processing {$totalRecipients} messages in {$jobsDispatched} batches.",
                'data' => [
                    'total_recipients' => $totalRecipients,
                    'jobs_dispatched' => $jobsDispatched,
                    'chunk_size' => $chunkSize,
                    'estimated_time_minutes' => ceil($totalRecipients / 10), // Rough estimate
                ],
            ], 202); // 202 Accepted - processing asynchronously

        } catch (\Exception $e) {
            Log::error('Bulk SMS dispatch failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => $e->getMessage(), 
                'error' => 'BULK_SMS_ERROR'
            ], 500);
        }
    }

    /**
     * Send SMS via Africa's Talking
     */
    private function sendViaAfricasTalking($phone, $message, $senderId, $apiKey, $apiUsername)
    {
        $isSandbox = ($apiUsername === 'sandbox');
        $url = $isSandbox 
            ? 'https://api.sandbox.africastalking.com/version1/messaging'
            : 'https://api.africastalking.com/version1/messaging';

        $postData = [
            'username' => $apiUsername,
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

    /**
     * Get SMS logs for the organization
     */
    public function getLogs(Request $request)
    {
        $organization = $request->user()->organization;
        $customerId = $request->input('customer_id');
        $perPage = $request->input('per_page', 5);
        
        $logs = SmsLog::where('organization_id', $organization->id)
            ->where('customer_id', $customerId)
            ->orderBy('created_at', 'desc')
            ->limit($perPage)
            ->get();

        return response()->json(['data' => $logs]);
    }
}
