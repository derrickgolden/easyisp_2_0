# Customer Messaging System Refactoring - Summary

## What Changed

Your messaging system has been refactored into a **centralized, optimized command** that eliminates code duplication and supports all current and future messaging use cases.

## Files Modified/Created

### New Files
1. **`/api/app/Services/CustomerMessagingService.php`** - Central messaging service
2. **`/MESSAGING_GUIDE.md`** - Comprehensive documentation
3. **`/api/MESSAGING_EXAMPLES.php`** - Real-world code examples

### Modified Files
1. **`/api/app/Services/SubscriptionService.php`** - Refactored to use CustomerMessagingService
   - Removed 150+ lines of duplicate messaging code
   - Uses centralized service instead
   - Kept backward compatibility wrapper method

## Key Improvements

### Before (Old Code)
```php
// Expiry warning - separate method with duplication
private function sendExpiryWarningMessage(Customer $customer, $hoursUntilExpiry)
{
    // Get organization, SMS settings...
    // Render template...
    // Send SMS...
}

// Expiry notification - similar code repeated
private function sendExpiryNotificationMessage(Customer $customer)
{
    // Get organization, SMS settings...
    // Render template...
    // Send SMS...
}

// Many other duplicated methods...
```

### After (New Code)
```php
// Centralized command
$messagingService = new CustomerMessagingService();
$messagingService->send($customer, 'expiry-warning', [...]);
$messagingService->send($customer, 'expiry-notification', [...]);
$messagingService->sendCustom($customer, 'Any custom message', 'source');
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                         │
│  (Controllers, Models, Commands, Cron Jobs, etc.)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         CustomerMessagingService (NEW)                      │
│                                                              │
│  • Type-based message routing                               │
│  • Template rendering & replacements                        │
│  • Organization-level customization                         │
│  • Unified SMS gateway validation                           │
│  • Consistent error handling & logging                      │
│  • Support for: registration, payment, expiry, etc.         │
│  • Easy to extend for new use cases                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Delegates to
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         SmsProviderService (Existing)                       │
│                                                              │
│  • Actual SMS delivery to Twilio, Nexmo, etc.              │
└─────────────────────────────────────────────────────────────┘
```

## Supported Message Types

| Type | Usage | Example |
|------|-------|---------|
| `registration` | New customer signup | Welcome message sent automatically |
| `payment` | Payment confirmation | "Payment of $50 received" |
| `expiry-warning` | 48h before expiry | Auto-sent by subscription cron |
| `expiry-notification` | Account expired | "Renew to restore service" |
| `reminder` | Manual/scheduled reminder | "Your subscription expires soon" |
| `suspension` | Account suspended | "Account suspended, contact support" |
| `reactivation` | Account reactivated | "Welcome back, service active" |
| `custom` | Any free-form message | From frontend, admin, manual |

## Use Cases Covered

✅ **Registration Flow** - Welcome message on signup  
✅ **Payment Processing** - Confirmation after payment  
✅ **Subscription Expiry** - 48h warning → expiry notification  
✅ **Manual Reminders** - Send on-demand reminders  
✅ **Frontend Single Message** - Customer sends message from app  
✅ **Bulk Campaigns** - Send to multiple customers  
✅ **Support Notifications** - Ticket updates, responses  
✅ **Admin Actions** - Suspension, reactivation, etc.  
✅ **Future Extensions** - Easily add new message types  

## Code Examples

### Simple Registration
```php
$messagingService = new CustomerMessagingService();
$messagingService->send($customer, CustomerMessagingService::TYPE_REGISTRATION);
```

### Payment with Amount
```php
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_PAYMENT,
    ['{PaidAmount}' => '50.00']
);
```

### Custom Message from Frontend
```php
$messagingService->sendCustom(
    $customer,
    'Your custom message text',
    'frontend-form'  // Source for logging
);
```

### Expiry Warning with Days
```php
$messagingService->send(
    $customer,
    CustomerMessagingService::TYPE_EXPIRY_WARNING,
    [
        '{Expiry}' => $date->format('M d, Y h:i A'),
        '{DaysUntilExpiry}' => '2',
    ]
);
```

## Template Customization

Organizations can override templates in their settings:

```php
organization.settings = [
    'sms-gateway' => [...],
    'notes-template' => [
        'templates' => [
            [
                'id' => 'system-registration',
                'content' => 'Custom welcome message for {FirstName}!'
            ],
            [
                'id' => 'system-payment',
                'content' => 'Thank you! ${PaidAmount} received for {PackageName}'
            ]
        ]
    ]
];
```

## Migration Guide

### Existing Code Still Works (Backward Compatible)
```php
// Old code - still works but deprecated
$subscriptionService->sendMessageToCustomer($customer, 'expiry-warning', [...]);
```

### Recommended: Use New Service Directly
```php
// New code - use this going forward
$messagingService = new CustomerMessagingService();
$messagingService->send($customer, CustomerMessagingService::TYPE_EXPIRY_WARNING, [...]);
```

## Performance & Reliability

✅ **No database overhead** - Stateless service  
✅ **Consistent logging** - All messages logged with context  
✅ **Error resilience** - Handles SMS gateway failures gracefully  
✅ **Scalable** - Works with bulk operations  
✅ **Test-friendly** - Easy to mock for unit tests  

## Placeholder Variables

### Standard Placeholders (Always Available)
```
{FirstName}      - Customer first name
{LastName}       - Customer last name
{FullName}       - Full name (FirstName + LastName)
{Isp}            - Organization name
{PhoneNumber}    - Customer phone
{RadiusUsername} - RADIUS username
{Status}         - Account status
{Balance}        - Account balance
{CustomerId}     - Customer ID
```

### Amount/Package Placeholders
```
{PackageName}     - Package name
{PackageAmount}   - Package price
{PaidAmount}      - Paid amount
```

### Custom Placeholders (Pass as Parameter)
```
{Expiry}              - Expiry date
{DaysUntilExpiry}     - Days left
{DaysLabel}           - 'day' or 'days'
{YourCustomField}     - Any custom value
```

## Logging & Debugging

All messages are logged to `storage/logs/laravel.log`:

```
[2026-05-16 10:30:45] production.INFO: Message (registration) sent to customer 123 (555-1234) 
[metadata: organization_id=1, customer_id=123, type=registration, sent_at=2026-05-16T10:30:45Z]

[2026-05-16 10:35:12] production.ERROR: Failed to send payment message to customer 456: SMS gateway not configured
```

Check logs for:
- SMS gateway configuration issues
- Missing phone numbers
- Provider API errors
- Delivery failures

## Extending for Future Use Cases

### Add Custom Message Type
```php
// In CustomerMessagingService.php
public const TYPE_MY_MESSAGE = 'my-message';

private const MESSAGE_TEMPLATES = [
    self::TYPE_MY_MESSAGE => [
        'template_id' => 'system-my-message',
        'default' => 'My default template',
    ],
];
```

### Then Use It
```php
$messagingService->send($customer, CustomerMessagingService::TYPE_MY_MESSAGE);
```

## Next Steps (Optional Enhancements)

- **Email Support**: Extend to send emails alongside SMS
- **Multi-channel**: Support WhatsApp, Telegram, Push notifications
- **Message Queue**: Add job queuing for high-volume sending
- **Template Builder UI**: Admin interface to edit templates
- **Analytics Dashboard**: Message delivery metrics
- **A/B Testing**: Test different message variations
- **Scheduled Messages**: Send messages at specific times

## Support & Documentation

1. **Quick Start**: See `MESSAGING_GUIDE.md`
2. **Code Examples**: See `api/MESSAGING_EXAMPLES.php`
3. **Implementation**: See `CustomerMessagingService.php` (well-commented)
4. **Logs**: Check `storage/logs/laravel.log` for debugging

## Summary

You now have a **production-ready, extensible messaging system** that:

✅ Eliminates code duplication  
✅ Supports all current use cases  
✅ Ready for future message types  
✅ Consistent error handling  
✅ Organization-level customization  
✅ Easy to test and maintain  
✅ Scalable for bulk operations  

---

**Ready to use!** Start sending messages:

```php
$messagingService = new CustomerMessagingService();
$messagingService->send($customer, 'registration');
```
