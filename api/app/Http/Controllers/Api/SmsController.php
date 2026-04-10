<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendBulkSms;
use App\Services\SmsProviderService;
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

            // Use SmsProviderService to send SMS and log it centrally
            $smsService = new SmsProviderService();
            $result = $smsService->send($phone, $message, $provider, $apiKey, $senderId, $apiUsername, [
                'organization_id' => $organization->id,
                'user_id' => $request->user()->id,
                'customer_id' => $request->input('customer_id'),
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
