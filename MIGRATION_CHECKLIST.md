# Customer Messaging System - Migration Checklist

## Overview
This document helps you migrate from the old messaging approach to the new centralized `CustomerMessagingService`.

## ✅ What's Already Done

- [x] Created `CustomerMessagingService.php` - centralized messaging service
- [x] Refactored `SubscriptionService.php` - uses new service
- [x] Maintained backward compatibility - old methods still work
- [x] Updated subscription cron logic - uses new service
- [x] All PHP files pass syntax validation

## 🔄 Migration Tasks

### Phase 1: Testing (This Sprint)

- [ ] **Test Existing Flows**
  - [ ] Run test for customer registration flow
  - [ ] Run test for subscription expiry warnings
  - [ ] Run test for subscription expiry notifications
  - [ ] Test with real SMS gateway to ensure delivery

- [ ] **Verify Logging**
  - [ ] Check `storage/logs/laravel.log` for message logs
  - [ ] Verify all messages are logged with context
  - [ ] Verify error messages are informative

- [ ] **Check SMS Gateway Configuration**
  - [ ] Verify organization SMS gateway settings are still valid
  - [ ] Test SMS delivery to sample customer
  - [ ] Verify phone number validation

**Action**: Run locally or on staging
```bash
cd api
php artisan tinker
# Test sending
$customer = Customer::first();
$messagingService = new \App\Services\CustomerMessagingService();
$result = $messagingService->send($customer, 'registration');
// Check logs for success/failure
```

### Phase 2: Controller Updates (Next Sprint)

- [ ] **Update All Controllers Sending Messages**

  **Find and update these patterns:**
  ```php
  // OLD
  $this->sendExpiryWarningMessage($customer, $hours);
  $this->sendExpiryNotificationMessage($customer);
  $this->sendSmsViaProvider($customer, $message, $settings);
  
  // NEW
  $messagingService = new CustomerMessagingService();
  $messagingService->send($customer, 'type', []);
  ```

  **Affected Areas:**
  - [ ] Controllers using subscription messaging
  - [ ] Payment/invoice controllers
  - [ ] Customer management controllers
  - [ ] Support/ticket controllers
  - [ ] Admin action controllers

- [ ] **Create Message Controller for Frontend**
  ```php
  // Add endpoint for frontend to send custom messages
  POST /api/customers/{id}/send-message
  ```

- [ ] **Add Registration Message**
  - [ ] Call `sendMessageToCustomer` after customer creation
  - [ ] Verify welcome message sends automatically

- [ ] **Add Payment Message**
  - [ ] Call after successful payment
  - [ ] Include amount in replacement variables

### Phase 3: Frontend Integration (Next Sprint)

- [ ] **Create API Endpoint for Custom Messages**
  ```php
  POST /api/customers/{customerId}/send-message
  {
    "message": "Your custom message text"
  }
  ```

- [ ] **Update Frontend Components**
  - [ ] Add "Send Message" button to customer view
  - [ ] Add form for message text
  - [ ] Handle success/error responses
  - [ ] Show message status to user

- [ ] **Test Frontend Message Flow**
  - [ ] Send test message from frontend
  - [ ] Verify customer receives SMS
  - [ ] Check error handling for SMS gateway issues

### Phase 4: Documentation & Knowledge Transfer

- [ ] **Share Documentation**
  - [ ] Team reviews `MESSAGING_GUIDE.md`
  - [ ] Team reviews `api/MESSAGING_EXAMPLES.php`
  - [ ] Team reviews `REFACTORING_SUMMARY.md`

- [ ] **Code Review**
  - [ ] Review new `CustomerMessagingService.php` class
  - [ ] Review updates to `SubscriptionService.php`
  - [ ] Ensure team understands the architecture

- [ ] **Team Training Session**
  - [ ] Explain centralized messaging approach
  - [ ] Show how to add new message types
  - [ ] Q&A and discussion

### Phase 5: Testing & Quality Assurance

- [ ] **Unit Tests**
  ```bash
  # Create tests in tests/Unit/Services/
  php artisan make:test Services/CustomerMessagingServiceTest --unit
  ```

  Test cases to cover:
  - [ ] Message sending with valid data
  - [ ] Message sending without SMS gateway config
  - [ ] Message sending without phone number
  - [ ] Template rendering with replacements
  - [ ] Organization template overrides
  - [ ] Error handling

- [ ] **Integration Tests**
  ```bash
  # Create tests in tests/Feature/
  php artisan make:test Services/CustomerMessagingServiceTest
  ```

  Test cases to cover:
  - [ ] End-to-end message flow
  - [ ] Message logging
  - [ ] SMS provider integration

- [ ] **Manual Testing Checklist**
  - [ ] Send each message type
    - [ ] Registration message
    - [ ] Payment message
    - [ ] Expiry warning
    - [ ] Expiry notification
    - [ ] Custom message
  - [ ] Verify phone number handling
  - [ ] Verify organization isolation (one org shouldn't see another's messages)
  - [ ] Verify custom template override
  - [ ] Check logs for all messages

### Phase 6: Deployment

- [ ] **Pre-Deployment Checks**
  - [ ] All tests passing
  - [ ] Code review approved
  - [ ] Staging environment tested
  - [ ] Database backups ready

- [ ] **Deploy to Production**
  - [ ] Deploy code changes
  - [ ] Run migrations (if any)
  - [ ] Verify service is working
  - [ ] Monitor logs for errors

- [ ] **Post-Deployment**
  - [ ] Monitor message delivery for 24 hours
  - [ ] Check application logs for errors
  - [ ] Get user feedback
  - [ ] Document any issues

## 📋 New Endpoints to Create

### For Frontend Message Sending

```
POST /api/customers/{customerId}/send-message
Content-Type: application/json

{
  "message": "Your message text here"
}

Response (201 Created):
{
  "message": "Message sent successfully",
  "status": "sent"
}

Response (400 Bad Request):
{
  "message": "Failed to send message. Check customer phone and SMS settings.",
  "status": "failed"
}
```

### For Admin Message Campaigns

```
POST /api/organizations/{orgId}/broadcast-message
Content-Type: application/json

{
  "message": "Broadcast message text",
  "target": "all_active" // or "expiring_soon", "newly_registered"
}

Response:
{
  "total": 150,
  "sent": 148,
  "failed": 2
}
```

## 🐛 Troubleshooting

### Problem: Messages not sending
**Solution:**
1. Check organization SMS gateway configuration
2. Verify customer has valid phone number
3. Check `storage/logs/laravel.log` for errors
4. Verify SMS provider API key is valid

### Problem: Template variables not rendering
**Solution:**
1. Use exact placeholder names: `{FirstName}` not `{firstname}`
2. Check organization template override syntax
3. Verify custom replacements array format

### Problem: SMS gateway configuration error
**Solution:**
1. Go to organization settings in admin panel
2. Verify SMS provider credentials
3. Verify provider is supported by `SmsProviderService`
4. Test with admin panel SMS test

## 📚 Reference Files

- **Main Service**: `api/app/Services/CustomerMessagingService.php`
- **Updated Service**: `api/app/Services/SubscriptionService.php`
- **Guide**: `MESSAGING_GUIDE.md`
- **Examples**: `api/MESSAGING_EXAMPLES.php`
- **Summary**: `REFACTORING_SUMMARY.md`

## 🚀 Quick Start (For Developers)

1. **Import the service:**
   ```php
   use App\Services\CustomerMessagingService;
   ```

2. **Create instance:**
   ```php
   $messagingService = new CustomerMessagingService();
   ```

3. **Send message:**
   ```php
   $messagingService->send($customer, 'registration');
   ```

4. **Handle response:**
   ```php
   if ($result) {
       // Message sent successfully
   } else {
       // Check logs for error details
   }
   ```

## 📅 Timeline Estimate

- **Phase 1 (Testing)**: 1-2 days
- **Phase 2 (Controllers)**: 2-3 days  
- **Phase 3 (Frontend)**: 2-3 days
- **Phase 4 (Documentation)**: 1 day
- **Phase 5 (QA)**: 2-3 days
- **Phase 6 (Deployment)**: 1 day

**Total: ~1-2 weeks** depending on team size and complexity

## ✨ Benefits After Migration

✅ Unified message sending across entire application  
✅ No code duplication  
✅ Easy to add new message types  
✅ Consistent error handling  
✅ Better logging and debugging  
✅ Organization-level customization  
✅ Frontend can send custom messages  
✅ Ready for future message channels (email, WhatsApp, etc.)  

## Questions or Issues?

- Review documentation: `MESSAGING_GUIDE.md`
- Check examples: `api/MESSAGING_EXAMPLES.php`
- Review source code: `api/app/Services/CustomerMessagingService.php`
- Check logs: `storage/logs/laravel.log`

---

**Version**: 1.0  
**Created**: May 16, 2026  
**Last Updated**: May 16, 2026
