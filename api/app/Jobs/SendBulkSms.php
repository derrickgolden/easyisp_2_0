<?php

namespace App\Jobs;

use App\Services\SmsProviderService;
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

                // Send SMS and let SmsProviderService handle SMS logs
                $smsService = new SmsProviderService();
                $smsService->send($phone, $message, $this->provider, $this->apiKey, $this->senderId, $this->apiUsername, [
                    'organization_id' => $this->organizationId,
                    'user_id' => $this->userId,
                    'customer_id' => $recipient['customer_id'] ?? null,
                    'type' => 'bulk',
                ]);

            } catch (\Exception $e) {
                Log::error('Bulk SMS failed', [
                    'phone' => $recipient['phone'],
                    'error' => $e->getMessage()
                ]);
            }

            // Small delay between messages to avoid rate limiting
            usleep(100000); // 0.1 second delay
        }
    }
}

