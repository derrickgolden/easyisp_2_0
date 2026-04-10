<?php

namespace App\Services;

use App\Models\SmsLog;
use Illuminate\Support\Facades\Log;

class SmsProviderService
{
    /**
     * Send SMS via the specified provider
     */
    public function send($phone, $message, $provider, $apiKey, $senderId = 'EASYTECH', $apiUsername = null, array $context = [])
    {
        $context = array_merge([
            'organization_id' => $context['organization_id'] ?? null,
            'user_id' => $context['user_id'] ?? null,
            'customer_id' => $context['customer_id'] ?? null,
            'phone' => $phone,
            'message' => $message,
            'provider' => $provider,
            'type' => $context['type'] ?? 'system',
        ], $context);

        try {
            $result = match ($provider) {
                "Africa's Talking" => $this->sendViaAfricasTalking($phone, $message, $senderId, $apiKey, $apiUsername),
                'Twilio' => $this->sendViaTwilio($phone, $message, $senderId, $apiKey),
                'Infobip' => $this->sendViaInfobip($phone, $message, $senderId, $apiKey),
                'BulkSMS.com' => $this->sendViaBulkSMS($phone, $message, $senderId, $apiKey),
                default => throw new \Exception("Unsupported SMS provider: {$provider}")
            };

            $this->logSms(array_merge($context, [
                'status' => 'success',
                'provider_response' => $result,
                'message_id' => $this->extractMessageId($result, $provider),
            ]));

            return $result;
        } catch (\Exception $e) {
            $this->logSms(array_merge($context, [
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'provider_response' => $this->getProviderResponseFromException($e),
            ]));

            throw $e;
        }
    }

    /**
     * Send SMS via Africa's Talking
     */
    public function sendViaAfricasTalking($phone, $message, $senderId, $apiKey, $apiUsername = null)
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
            'apiKey: ' . $apiKey,
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

        $result = json_decode($response, true);
        Log::info('Africa\'s Talking response', ['response' => $result]);

        $smsData = $result['SMSMessageData'] ?? null;

        // Validate response structure
        if (!$smsData) {
            throw new \Exception('Invalid Africa\'s Talking response structure');
        }

        $message = $smsData['Message'] ?? '';
        $recipients = $smsData['Recipients'] ?? [];

        // Check for error messages in the Message field
        if (stripos($message, 'Invalid') !== false ||
            stripos($message, 'Error') !== false ||
            stripos($message, 'Failed') !== false ||
            stripos($message, 'Insufficient') !== false) {
            throw new \Exception($message ?: 'Africa\'s Talking reported an error');
        }

        // Ensure recipients array is not empty
        if (empty($recipients)) {
            throw new \Exception($message ?: 'Africa\'s Talking response contained no recipients');
        }

        // Check each recipient's status
        foreach ($recipients as $recipient) {
            $status = $recipient['status'] ?? '';
            $statusCode = $recipient['statusCode'] ?? null;

            // Accept only "Success" status with statusCode 100
            if ($status !== 'Success' || $statusCode !== 100) {
                $errorMessage = $recipient['status'] ?? $message ?? 'Unknown error';
                throw new \Exception($errorMessage);
            }
        }

        return $result;
    }

    /**
     * Send SMS via Twilio
     */
    public function sendViaTwilio($phone, $message, $senderId, $apiKey)
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
    public function sendViaInfobip($phone, $message, $senderId, $apiKey)
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
    public function sendViaBulkSMS($phone, $message, $senderId, $apiKey)
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

    private function logSms(array $data): void
    {
        try {
            SmsLog::create([
                'organization_id' => $data['organization_id'],
                'user_id' => $data['user_id'] ?? null,
                'customer_id' => $data['customer_id'] ?? null,
                'phone' => $data['phone'] ?? null,
                'message' => $data['message'] ?? null,
                'status' => $data['status'] ?? 'unknown',
                'provider' => $data['provider'] ?? null,
                'error_message' => $data['error_message'] ?? null,
                'message_id' => $data['message_id'] ?? null,
                'type' => $data['type'] ?? 'system',
                'provider_response' => $data['provider_response'] ?? null,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to write SMS log: ' . $e->getMessage(), ['data' => $data]);
        }
    }

    private function extractMessageId($result, $provider)
    {
        if (!is_array($result)) {
            return null;
        }

        return match ($provider) {
            "Africa's Talking" => $result['SMSMessageData']['Recipients'][0]['messageId'] ?? null,
            'Twilio' => $result['sid'] ?? null,
            'Infobip' => $result['messages'][0]['messageId'] ?? null,
            'BulkSMS.com' => $result['messageId'] ?? null,
            default => null,
        };
    }

    private function getProviderResponseFromException(\Exception $e)
    {
        return null;
    }
}
