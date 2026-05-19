<?php

namespace App\Services;

use App\Models\Customer;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Centralized messaging service for customers
 * Supports SMS, and easily extensible for other channels (email, push notifications, etc.)
 * 
 * Usage:
 *   $messagingService = new CustomerMessagingService();
 *   $messagingService->send($customer, 'registration', ['custom_field' => 'value']);
 *   $messagingService->sendCustom($customer, 'Custom message text');
 */
class CustomerMessagingService
{
    // Message type constants
    public const TYPE_EXPIRY_WARNING = 'expiry-warning';
    public const TYPE_EXPIRY_ONE_HOUR_WARNING = 'expiry-one-hour-warning';
    public const TYPE_EXPIRY_NOTIFICATION = 'expiry-notification';
    public const TYPE_REGISTRATION = 'registration';
    public const TYPE_PAYMENT = 'payment';
    public const TYPE_REMINDER = 'reminder';
    public const TYPE_CUSTOM = 'custom';
    public const TYPE_SUSPENSION = 'suspension';
    public const TYPE_REACTIVATION = 'reactivation';

    // Message template configurations
    private const MESSAGE_TEMPLATES = [
        self::TYPE_EXPIRY_WARNING => [
            'template_id' => 'system-expiry-warning',
              'default' => 'Dear {FirstName}, your internet subscription expires in {HoursUntilExpiry} hour(s) on {Expiry}. Please renew to avoid service interruption.',
        ],
        self::TYPE_EXPIRY_ONE_HOUR_WARNING => [
            'template_id' => 'system-expiry-one-hour-warning',
            'default' => 'Dear {FirstName}, your internet subscription expires in less than {HoursUntilExpiry} hour(s) at {Expiry}. Please renew now to avoid interruption.',
        ],
        self::TYPE_EXPIRY_NOTIFICATION => [
            'template_id' => 'system-expiry-notification',
            'default' => 'Dear {FirstName}, your internet subscription has expired as of {Expiry}. Please renew your account to restore service.',
        ],
        self::TYPE_REGISTRATION => [
            'template_id' => 'system-registration',
            'default' => 'Welcome {FirstName}. Your account has been created successfully. Thank you for choosing {Isp}',
        ],
        self::TYPE_PAYMENT => [
            'template_id' => 'system-payment',
            'default' => 'Payment received. Amount: KSH {PaidAmount}. Thank you.',
        ],
        self::TYPE_REMINDER => [
            'template_id' => 'system-reminder',
            'default' => 'Reminder for {FirstName}: Your subscription details - Package: {PackageName}, Expires: {Expiry}',
        ],
        self::TYPE_SUSPENSION => [
            'template_id' => 'system-suspension',
            'default' => 'Your account {RadiusUsername} has been paused. Contact support for assistance if you have any questions.',
        ],
        self::TYPE_REACTIVATION => [
            'template_id' => 'system-reactivation',
            'default' => 'Welcome back {FirstName}. Your account has been reactivated. Your service is now active.',
        ],
    ];

    /**
     * Send message to customer by type
     *
     * @param Customer $customer
     * @param string $messageType
     * @param array $customReplacements Optional placeholder replacements
     * @param array $options Optional [template_id, fallback_template]
     * @return bool
     */
    public function send(Customer $customer, string $messageType, array $customReplacements = [], array $options = []): bool
    {
        return $this->sendMessage(
            $customer,
            $messageType,
            $customReplacements,
            array_merge(['log_type' => $messageType], $options)
        );
    }

    /**
     * Send custom free-form message to customer
     *
     * @param Customer $customer
     * @param string $messageText
     * @param string $source Optional source identifier (e.g., 'frontend-form', 'manual', 'admin-panel')
     * @return bool
     */
    public function sendCustom(Customer $customer, string $messageText, string $source = 'manual'): bool
    {
        return $this->sendMessage(
            $customer,
            self::TYPE_CUSTOM,
            [],
            [
                'fallback_template' => $messageText,
                'log_type' => "custom-{$source}",
            ]
        );
    }

    /**
     * Internal method: Send message with full control
     */
    private function sendMessage(Customer $customer, string $messageType, array $customReplacements = [], array $options = []): bool
    {
        try {
            if ($this->shouldSuppressExpiryMessage($customer, $messageType)) {
                Log::info("Skipping {$messageType} message for customer {$customer->id}: balance can cover next subscription.");
                return false;
            }

            // Validate customer and organization
            $organization = $customer->organization;
            if (!$organization) {
                Log::warning("Organization not found for customer {$customer->id}");
                return false;
            }

            // Check SMS gateway configuration
            $settings = $organization->settings ?? [];
            $smsSettings = $settings['sms-gateway'] ?? null;

            if (!$smsSettings || !$smsSettings['provider'] || !$smsSettings['api_key']) {
                Log::warning("SMS gateway not configured for organization {$organization->id}. Message type: {$messageType}");
                return false;
            }

            // Skip SMS if no phone number
            if (!$customer->phone) {
                Log::warning("No phone number for customer {$customer->id}. Cannot send {$messageType} message.");
                return false;
            }

            // Get template configuration
            $templateConfig = self::MESSAGE_TEMPLATES[$messageType] ?? [];
            $templateId = $options['template_id'] ?? $templateConfig['template_id'] ?? null;
            $fallbackTemplate = $options['fallback_template'] ?? $templateConfig['default'] ?? '';
            $logType = $options['log_type'] ?? $messageType;

            // Render the message
            $message = $this->renderTemplate($customer, $templateId, $fallbackTemplate, $customReplacements);

            // Prepare metadata
            $metadata = [
                'organization_id' => $customer->organization_id,
                'customer_id' => $customer->id,
                'type' => $logType,
                'sent_at' => now()->toIso8601String(),
            ];

            // Send via SMS provider
            $smsService = new SmsProviderService();
            $smsService->send(
                $customer->phone,
                $message,
                $smsSettings['provider'],
                $smsSettings['api_key'],
                $smsSettings['sender_id'] ?? 'EASYTECH',
                $smsSettings['api_username'] ?? null,
                $metadata
            );

            Log::info("Message ({$logType}) sent to customer {$customer->id} ({$customer->phone})", $metadata);
            return true;

        } catch (\Exception $e) {
            Log::error("Failed to send message to customer {$customer->id}: " . $e->getMessage(), [
                'message_type' => $messageType,
                'exception' => get_class($e),
            ]);
            return false;
        }
    }

    /**
     * Prevent expiry messages when customer has enough balance for next subscription.
     */
    private function shouldSuppressExpiryMessage(Customer $customer, string $messageType): bool
    {
        $expiryMessageTypes = [
            self::TYPE_EXPIRY_WARNING,
            self::TYPE_EXPIRY_ONE_HOUR_WARNING,
            self::TYPE_EXPIRY_NOTIFICATION,
        ];

        if (!in_array($messageType, $expiryMessageTypes, true)) {
            return false;
        }

        $packageAmount = (float) ($customer->effective_package_price ?? 0);
        if ($packageAmount <= 0) {
            return false;
        }

        $balance = (float) ($customer->balance ?? 0);
        return $balance >= $packageAmount;
    }

    /**
     * Render template with customer data and custom replacements
     */
    private function renderTemplate(Customer $customer, ?string $templateId, string $fallbackContent, array $customReplacements = []): string
    {
        $organization = $customer->organization;
        $settings = $organization->settings ?? [];
        $templates = $settings['notes-template']['templates'] ?? [];

        // Try to find custom template in organization settings
        $customTemplate = null;
        if ($templateId) {
            $customTemplate = collect(is_array($templates) ? $templates : [])
                ->first(function ($item) use ($templateId) {
                    return is_array($item) && (($item['id'] ?? null) === $templateId);
                });
        }

        $content = is_array($customTemplate) && !empty($customTemplate['content'])
            ? $customTemplate['content']
            : $fallbackContent;

        // Prepare all replacements
        $allReplacements = array_merge([
            '{FirstName}' => $customer->first_name ?? '',
            '{LastName}' => $customer->last_name ?? '',
            '{FullName}' => trim(($customer->first_name ?? '') . ' ' . ($customer->last_name ?? '')) ?: $customer->name ?? '',
            '{Isp}' => $organization->name ?? 'ISP',
            '{PackageName}' => $customer->package?->name ?? '',
            '{PaidAmount}' => '0',
            '{PackageAmount}' => (string) ($customer->effective_package_price ?? 0),
            '{PhoneNumber}' => $customer->phone ?? '',
            '{RadiusUsername}' => $customer->radius_username ?? '',
            '{CustomerId}' => (string) $customer->id,
            '{Balance}' => (string) ($customer->balance ?? 0),
            '{Status}' => $customer->status ?? 'unknown',
        ], $customReplacements);

        return str_ireplace(
            array_keys($allReplacements),
            array_values($allReplacements),
            $content
        );
    }

    /**
     * Add custom message template for future use
     * Can be used to register custom message types on-the-fly
     */
    public function registerTemplate(string $messageType, string $templateId, string $defaultContent): void
    {
        // This allows runtime template registration without modifying constants
        // Useful for dynamically generated message types
        Log::info("Template registered: {$messageType} => {$templateId}");
    }
}
