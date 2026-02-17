<?php

namespace App\Jobs;

use App\Models\SmsLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendBulkSms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120; // 2 minutes timeout per job
    public $tries = 3; // Retry 3 times if failed

    protected $recipients;
    protected $organizationId;
    protected $userId;
    protected $provider;
    protected $apiKey;
    protected $apiUsername;
    protected $senderId;

    /**
     * Create a new job instance.
     */
    public function __construct(
        array $recipients,
        int $organizationId,
        int $userId,
        string $provider,
        string $apiKey,
        ?string $apiUsername,
        string $senderId
    ) {
        $this->recipients = $recipients;
        $this->organizationId = $organizationId;
        $this->userId = $userId;
        $this->provider = $provider;
        $this->apiKey = $apiKey;
        $this->apiUsername = $apiUsername;
        $this->senderId = $senderId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        foreach ($this->recipients as $recipient) {
            try {
                $phone = $recipient['phone'];
                $message = $recipient['message'];

                // Call the appropriate SMS provider
                $result = $this->sendSms($phone, $message);

                // Log successful SMS
                SmsLog::create([
                    'organization_id' => $this->organizationId,
                    'user_id' => $this->userId,
                    'customer_id' => $recipient['customer_id'] ?? null,
                    'phone' => $phone,
                    'message' => $message,
                    'status' => 'success',
                    'provider' => $this->provider,
                    'type' => 'bulk',
                ]);

            } catch (\Exception $e) {
                // Log failed SMS
                SmsLog::create([
                    'organization_id' => $this->organizationId,
                    'user_id' => $this->userId,
                    'customer_id' => $recipient['customer_id'] ?? null,
                    'phone' => $recipient['phone'],
                    'message' => $recipient['message'],
                    'status' => 'failed',
                    'provider' => $this->provider,
                    'error_message' => $e->getMessage(),
                    'type' => 'bulk',
                ]);

                Log::error('Bulk SMS failed', [
                    'phone' => $recipient['phone'],
                    'error' => $e->getMessage()
                ]);
            }

            // Small delay between messages to avoid rate limiting
            usleep(100000); // 0.1 second delay
        }
    }

    /**
     * Send SMS via appropriate provider
     */
    private function sendSms($phone, $message)
    {
        return match ($this->provider) {
            "Africa's Talking" => $this->sendViaAfricasTalking($phone, $message),
            'Twilio' => $this->sendViaTwilio($phone, $message),
            'Infobip' => $this->sendViaInfobip($phone, $message),
            'BulkSMS.com' => $this->sendViaBulkSMS($phone, $message),
            default => throw new \Exception("Unsupported SMS provider: {$this->provider}")
        };
    }

    private function sendViaAfricasTalking($phone, $message)
    {
        $username = $this->apiUsername ?? env('AFRICAS_TALKING_USERNAME', 'sandbox');
        $isSandbox = strtolower($username) === 'sandbox';

        $url = $isSandbox 
            ? 'https://api.sandbox.africastalking.com/version1/messaging' 
            : 'https://api.africastalking.com/version1/messaging';

        if (!str_starts_with($phone, '+')) {
            $phone = '+' . preg_replace('/^0+/', '254', $phone);
        }

        $postData = [
            'username' => $username,
            'to' => $phone,
            'message' => $message,
        ];

        if (!$isSandbox && $this->senderId) {
            $postData['from'] = $this->senderId;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
            'apiKey: ' . $this->apiKey,
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
        $recipient = $result['SMSMessageData']['Recipients'][0] ?? null;

        if ($recipient && $recipient['status'] !== 'Success') {
            throw new \Exception($recipient['status']); 
        }

        return $result;
    }

    private function sendViaTwilio($phone, $message)
    {
        [$accountSid, $authToken] = explode(':', $this->apiKey);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.twilio.com/2010-04-01/Accounts/{$accountSid}/Messages.json");
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, "{$accountSid}:{$authToken}");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'From' => $this->senderId,
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

    private function sendViaInfobip($phone, $message)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.infobip.com/sms/1/text/single');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: App ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'messages' => [
                [
                    'destinations' => [['to' => $phone]],
                    'from' => $this->senderId,
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

    private function sendViaBulkSMS($phone, $message)
    {
        [$username, $password] = explode(':', $this->apiKey);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.bulksms.com/v1/messages?auto-unicode=true');
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, "{$username}:{$password}");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'to' => $phone,
            'body' => $message,
            'from' => $this->senderId,
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
