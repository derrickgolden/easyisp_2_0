# Centralized Customer Messaging System

## Overview

The new **`CustomerMessagingService`** provides a unified, optimized command for sending SMS messages to customers across all use cases. It supports:

- ✅ Registration messages
- ✅ Payment notifications
- ✅ Expiry warnings & expiry notifications
- ✅ Reminders
- ✅ Custom messages (from frontend, admin, manual)
- ✅ Suspension/Reactivation notices
- ✅ Easy extensibility for future message types

## Architecture

```
SubscriptionService (subscription logic)
    ↓
CustomerMessagingService (centralized messaging)
    ↓
SmsProviderService (SMS delivery)
```

## Basic Usage

### 1. Send Pre-defined Message Types

```php
use App\Services\CustomerMessagingService;

$messagingService = new CustomerMessagingService();

// Send expiry warning
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_EXPIRY_WARNING,
    [
        '{Expiry}' => $expiryDate->format('M d, Y h:i A'),
        '{DaysUntilExpiry}' => '2',
    ]
);

// Send payment notification
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_PAYMENT,
    [
        '{PaidAmount}' => '50.00',
    ]
);

// Send registration message
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_REGISTRATION
);
```

### 2. Send Custom Free-form Messages

```php
// From admin panel or manual intervention
$messagingService->sendCustom(
    $customer,
    'Your account has been manually suspended. Please contact support.',
    'admin-panel'
);

// From frontend form
$messagingService->sendCustom(
    $customer,
    'Your custom message here',
    'frontend-form'
);
```

### 3. Supported Message Types

| Type | Constant | Default Template | Use Case |
|------|----------|------------------|----------|
| `expiry-warning` | `TYPE_EXPIRY_WARNING` | Warning before expiry | Auto-send 48h before expiry |
| `expiry-notification` | `TYPE_EXPIRY_NOTIFICATION` | Account expired notice | When subscription expires |
| `registration` | `TYPE_REGISTRATION` | Account created | New customer registration |
| `payment` | `TYPE_PAYMENT` | Payment received | After payment processed |
| `reminder` | `TYPE_REMINDER` | Subscription reminder | Manual reminders |
| `suspension` | `TYPE_SUSPENSION` | Account suspended | When manually suspended |
| `reactivation` | `TYPE_REACTIVATION` | Account reactivated | When unsuspended |
| `custom` | `TYPE_CUSTOM` | Free-form text | Any other use case |

## Advanced Usage

### 1. Custom Replacements

```php
// Add custom placeholders beyond the defaults
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_REMINDER,
    [
        '{CustomField}' => 'Custom Value',
        '{DueDate}' => now()->addDays(7)->format('Y-m-d'),
    ]
);
```

### 2. Override Template Configuration

```php
// Use custom template ID and fallback
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_CUSTOM,
    [],
    [
        'template_id' => 'my-custom-template',
        'fallback_template' => 'Your custom message',
    ]
);
```

### 3. Log Custom Message Type

```php
// Track different sources/categories
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_CUSTOM,
    [],
    [
        'log_type' => 'customer-support-inquiry',
        'fallback_template' => 'Response to your inquiry...',
    ]
);
```

## Template System

### Available Placeholders

All templates support these placeholders:

```
{FirstName}           - Customer first name
{LastName}            - Customer last name
{FullName}            - First + Last name
{Isp}                 - Organization/ISP name
{PackageName}         - Customer package name
{PaidAmount}          - Amount paid
{PackageAmount}       - Package price
{PhoneNumber}         - Customer phone
{RadiusUsername}      - RADIUS username
{CustomerId}          - Customer ID
{Balance}             - Account balance
{Status}              - Account status
{Expiry}              - Expiry date (custom)
{DaysUntilExpiry}     - Days until expiry (custom)
{DaysLabel}           - 'day' or 'days' (custom)
```

### Custom Template Override

Organizations can override default templates in their settings:

```json
{
  "sms-gateway": {...},
  "notes-template": {
    "templates": [
      {
        "id": "system-expiry-warning",
        "content": "Hey {FirstName}! ⏰ Your {PackageName} expires in {DaysUntilExpiry} {DaysLabel}. Renew now!"
      },
      {
        "id": "system-payment",
        "content": "Payment of {PaidAmount} received! Thank you {FirstName}! 🎉"
      }
    ]
  }
}
```

## Real-World Examples

### Example 1: Registration Flow

```php
// In CustomerController@store() or similar
$customer = Customer::create([...]);

$messagingService = new CustomerMessagingService();
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_REGISTRATION
);
```

### Example 2: Payment Processing

```php
// In PaymentController@process()
$customer = $payment->customer;

$messagingService = new CustomerMessagingService();
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_PAYMENT,
    ['{PaidAmount}' => $payment->amount]
);
```

### Example 3: Manual Reminder Campaign

```php
// Bulk send reminders
$customers = Customer::where('status', 'active')->get();

$messagingService = new CustomerMessagingService();
foreach ($customers as $customer) {
    $expiryDate = $customer->expiry_date;
    
    $messagingService->send(
        $customer,
        CustomerMessagingService::TYPE_REMINDER,
        ['{Expiry}' => $expiryDate->format('M d, Y')]
    );
}
```

### Example 4: Frontend Single Message

```php
// In API endpoint that accepts message from frontend form
$customer = Customer::find($customerId);
$messageText = request('message');

$messagingService = new CustomerMessagingService();
$messagingService->sendCustom(
    $customer,
    $messageText,
    'frontend-form'  // Source identifier for logging
);
```

### Example 5: Support Ticket Auto-reply

```php
// In TicketController@sendAutoReply()
$ticket = SupportTicket::find($ticketId);
$customer = $ticket->customer;

$messagingService = new CustomerMessagingService();
$messagingService->sendCustom(
    $customer,
    "Ticket #{$ticket->id} received. We'll respond shortly.",
    'support-auto-reply'
);
```

## Error Handling

```php
$messagingService = new CustomerMessagingService();
$result = $messagingService->send($customer, $type, $replacements);

if ($result) {
    // Message sent successfully
} else {
    // Message failed - check logs for details
    // Common reasons:
    // - SMS gateway not configured
    // - Customer has no phone number
    // - SMS provider API error
}
```

All errors are logged to `storage/logs/laravel.log` with full context.

## Extending with New Message Types

### Option 1: Use Custom Message Type

```php
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_CUSTOM,
    [/* replacements */],
    [
        'template_id' => 'my-new-message-type',
        'fallback_template' => 'Default content here',
        'log_type' => 'my-custom-type',
    ]
);
```

### Option 2: Add Constant to Service (Recommended for frequent types)

Edit `CustomerMessagingService.php`:

```php
public const TYPE_MY_CUSTOM_MESSAGE = 'my-custom-message';

private const MESSAGE_TEMPLATES = [
    ...existing templates...,
    self::TYPE_MY_CUSTOM_MESSAGE => [
        'template_id' => 'system-my-custom-message',
        'default' => 'Your custom default template here',
    ],
];
```

Then use it:

```php
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_MY_CUSTOM_MESSAGE,
    [/* custom replacements */]
);
```

## Migration from Old Methods

### Old Code

```php
$this->sendExpiryWarningMessage($customer, $hoursUntilExpiry);
$this->sendExpiryNotificationMessage($customer);
$this->sendSmsViaProvider($customer, $message, $settings);
```

### New Code

```php
$messagingService = new CustomerMessagingService();
$messagingService->send($customer, CustomerMessagingService::TYPE_EXPIRY_WARNING, [...]);
$messagingService->send($customer, CustomerMessagingService::TYPE_EXPIRY_NOTIFICATION);
$messagingService->sendCustom($customer, $message, 'source-identifier');
```

## Benefits

✅ **Unified Interface** - Single command for all message types  
✅ **Reduced Code Duplication** - No repeated SMS gateway/template logic  
✅ **Easy to Extend** - Add new message types without modifying existing code  
✅ **Better Logging** - Consistent logging across all messages  
✅ **Flexible Templates** - Organization-level template overrides  
✅ **Future-proof** - Easily add email, push notifications, Telegram, etc.  
✅ **Maintainable** - All messaging logic in one place  

## Support

For issues or questions about the messaging system, check:
- `storage/logs/laravel.log` for detailed error messages
- SMS gateway configuration in organization settings
- Customer phone number validity
