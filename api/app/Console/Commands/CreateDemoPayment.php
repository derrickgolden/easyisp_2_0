<?php

namespace App\Console\Commands;

use App\Models\Payment;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class CreateDemoPayment extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'demo:create-payment {--organization-id=2}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a dummy M-Pesa payment for demo organization';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $organizationId = $this->option('organization-id');

        try {
            // Generate a unique M-Pesa code (similar to UFLBV8V2LH)
            $mpesaCode = strtoupper(Str::random(10));

            // Create the dummy payment
            $payment = Payment::create([
                'organization_id' => $organizationId,
                'customer_id' => null,
                'mpesa_code' => $mpesaCode,
                'amount' => 1500.00, // Demo amount
                'bill_ref' => 'DEMO-' . now()->format('YmdHis'),
                'phone' => '254700000000', // Demo phone
                'sender_name' => 'Demo Account',
                'status' => 'completed', // Mark as completed
            ]);

            $this->info("✓ Demo payment created successfully!");
            $this->line("Organization ID: {$organizationId}");
            $this->line("M-Pesa Code: {$mpesaCode}");
            $this->line("Amount: {$payment->amount}");
            $this->line("Timestamp: {$payment->created_at}");

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error("✗ Failed to create demo payment: {$e->getMessage()}");
            return self::FAILURE;
        }
    }
}
