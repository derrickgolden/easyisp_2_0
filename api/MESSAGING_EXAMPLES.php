<?php

/**
 * QUICK REFERENCE: Using CustomerMessagingService in Your Code
 * 
 * Copy and paste ready examples for common messaging scenarios
 */

// ============================================================
// EXAMPLE 1: Registration Flow (CustomerController)
// ============================================================

class CustomerController
{
    public function store(Request $request)
    {
        $customer = Customer::create([
            'first_name' => $request->first_name,
            'phone' => $request->phone,
            'radius_username' => $request->radius_username,
            // ... other fields
        ]);

        // Send welcome message
        $messagingService = new \App\Services\CustomerMessagingService();
        $messagingService->send(
            $customer,
            \App\Services\CustomerMessagingService::TYPE_REGISTRATION
        );

        return response()->json(['message' => 'Customer created'], 201);
    }
}

// ============================================================
// EXAMPLE 2: Payment Processing (PaymentController)
// ============================================================

class PaymentController
{
    public function processPayment(Request $request)
    {
        $payment = Payment::create([
            'customer_id' => $request->customer_id,
            'amount' => $request->amount,
        ]);

        $customer = $payment->customer;
        
        // Update balance
        $customer->increment('balance', $payment->amount);

        // Send payment confirmation
        $messagingService = new \App\Services\CustomerMessagingService();
        $messagingService->send(
            $customer,
            \App\Services\CustomerMessagingService::TYPE_PAYMENT,
            ['{PaidAmount}' => number_format($payment->amount, 2)]
        );

        return response()->json(['message' => 'Payment processed']);
    }
}

// ============================================================
// EXAMPLE 3: Frontend API for Sending Custom Messages
// ============================================================

class MessageController extends Controller
{
    /**
     * Send custom SMS to customer from frontend
     * POST /api/customers/{id}/send-message
     */
    public function sendCustomMessage(Request $request, $customerId)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:160',
        ]);

        $customer = Customer::findOrFail($customerId);

        $messagingService = new \App\Services\CustomerMessagingService();
        $success = $messagingService->sendCustom(
            $customer,
            $validated['message'],
            'frontend-manual'  // For tracking source
        );

        if ($success) {
            return response()->json([
                'message' => 'Message sent successfully',
                'status' => 'sent',
            ]);
        }

        return response()->json([
            'message' => 'Failed to send message. Check customer phone and SMS settings.',
            'status' => 'failed',
        ], 400);
    }
}

// ============================================================
// EXAMPLE 4: Reminders (RemindersController or Scheduled Task)
// ============================================================

class ReminderController extends Controller
{
    /**
     * Send subscription reminders to active customers
     * Can be called from: artisan command, scheduled task, or manual trigger
     */
    public function sendRemindersToDueCustomers()
    {
        // Get customers whose subscriptions expire within 7 days
        $customers = Customer::where('status', 'active')
            ->where('expiry_date', '>=', now())
            ->where('expiry_date', '<=', now()->addDays(7))
            ->get();

        $messagingService = new \App\Services\CustomerMessagingService();
        $sent = 0;
        $failed = 0;

        foreach ($customers as $customer) {
            $expiryDate = $customer->expiry_date;
            $daysLeft = now()->diffInDays($expiryDate);

            $success = $messagingService->send(
                $customer,
                \App\Services\CustomerMessagingService::TYPE_REMINDER,
                [
                    '{Expiry}' => $expiryDate->format('M d, Y'),
                    '{DaysUntilExpiry}' => $daysLeft,
                ]
            );

            $success ? $sent++ : $failed++;
        }

        return response()->json([
            'total' => count($customers),
            'sent' => $sent,
            'failed' => $failed,
        ]);
    }
}

// ============================================================
// EXAMPLE 5: Suspension/Reactivation (AccountController)
// ============================================================

class AccountController extends Controller
{
    public function suspend(Customer $customer)
    {
        $customer->update(['status' => 'suspended']);

        $messagingService = new \App\Services\CustomerMessagingService();
        $messagingService->send(
            $customer,
            \App\Services\CustomerMessagingService::TYPE_SUSPENSION
        );

        return response()->json(['message' => 'Customer suspended']);
    }

    public function reactivate(Customer $customer)
    {
        $customer->update(['status' => 'active']);

        $messagingService = new \App\Services\CustomerMessagingService();
        $messagingService->send(
            $customer,
            \App\Services\CustomerMessagingService::TYPE_REACTIVATION
        );

        return response()->json(['message' => 'Customer reactivated']);
    }
}

// ============================================================
// EXAMPLE 6: Bulk Message Campaign
// ============================================================

class CampaignController extends Controller
{
    /**
     * Send promotional message to all active customers in an organization
     * POST /api/organizations/{id}/broadcast-message
     */
    public function broadcastMessage(Request $request, Organization $organization)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:160',
            'target' => 'in:all_active,expiring_soon,newly_registered', // filters
        ]);

        $query = $organization->customers();

        // Apply filters
        if ($validated['target'] === 'all_active') {
            $query->where('status', 'active');
        } elseif ($validated['target'] === 'expiring_soon') {
            $query->where('status', 'active')
                ->whereBetween('expiry_date', [now(), now()->addDays(7)]);
        }

        $customers = $query->get();
        $messagingService = new \App\Services\CustomerMessagingService();

        $results = [
            'total' => 0,
            'sent' => 0,
            'failed' => 0,
        ];

        foreach ($customers as $customer) {
            $results['total']++;
            
            $success = $messagingService->sendCustom(
                $customer,
                $validated['message'],
                'broadcast-campaign'
            );

            $success ? $results['sent']++ : $results['failed']++;
        }

        return response()->json($results);
    }
}

// ============================================================
// EXAMPLE 7: Error Handling & Logging
// ============================================================

class MessageService
{
    public function sendWithLogging(Customer $customer, string $type, array $replacements = [])
    {
        $messagingService = new \App\Services\CustomerMessagingService();
        
        try {
            $success = $messagingService->send($customer, $type, $replacements);

            if (!$success) {
                \Log::warning("Message send returned false", [
                    'customer_id' => $customer->id,
                    'message_type' => $type,
                    'phone' => $customer->phone,
                ]);

                // Optionally: Alert admin, notify customer, etc.
                return false;
            }

            return true;

        } catch (\Exception $e) {
            \Log::error("Message service exception", [
                'customer_id' => $customer->id,
                'message_type' => $type,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}

// ============================================================
// EXAMPLE 8: Using Custom Replacements
// ============================================================

class AdvancedMessagingController
{
    public function sendCustomizedReminder(Customer $customer)
    {
        $messagingService = new \App\Services\CustomerMessagingService();

        // Calculate custom values
        $expiryDate = $customer->expiry_date;
        $daysLeft = now()->diffInDays($expiryDate);
        $renewalPrice = $customer->package->price ?? 0;

        // Send with custom replacements
        $messagingService->send(
            $customer,
            \App\Services\CustomerMessagingService::TYPE_REMINDER,
            [
                '{Expiry}' => $expiryDate->format('Y-m-d'),
                '{DaysUntilExpiry}' => $daysLeft,
                '{RenewalPrice}' => number_format($renewalPrice, 2),
                '{CustomMessage}' => 'Special offer: 20% discount this month!',
            ]
        );
    }
}

// ============================================================
// TIPS
// ============================================================

/*
 * 1. MESSAGE TYPES - Import constants from CustomerMessagingService:
 *    - TYPE_EXPIRY_WARNING
 *    - TYPE_EXPIRY_NOTIFICATION
 *    - TYPE_REGISTRATION
 *    - TYPE_PAYMENT
 *    - TYPE_REMINDER
 *    - TYPE_SUSPENSION
 *    - TYPE_REACTIVATION
 *    - TYPE_CUSTOM
 *
 * 2. AVAILABLE PLACEHOLDERS in templates:
 *    {FirstName}, {LastName}, {FullName}
 *    {Isp}, {PackageName}
 *    {PhoneNumber}, {RadiusUsername}, {CustomerId}
 *    {PaidAmount}, {PackageAmount}, {Balance}, {Status}
 *    + Custom: {Expiry}, {DaysUntilExpiry}, etc.
 *
 * 3. LOGGING - All messages are logged with:
 *    - Customer ID
 *    - Phone number
 *    - Message type
 *    - Timestamp
 *    Check storage/logs/laravel.log
 *
 * 4. SMS GATEWAY - Ensure configured in Organization settings:
 *    organization.settings['sms-gateway']['provider']
 *    organization.settings['sms-gateway']['api_key']
 *
 * 5. RETURN VALUES - send() returns true/false:
 *    true  = Message queued/sent successfully
 *    false = Error occurred (check logs for details)
 */
