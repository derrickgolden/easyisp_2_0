<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sms_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null'); // Who sent it
            $table->foreignId('customer_id')->nullable()->constrained()->onDelete('set null'); // Recipient customer (if applicable)
            
            $table->string('phone', 20); // Recipient phone number
            $table->text('message'); // SMS content
            $table->enum('status', ['success', 'failed', 'pending'])->default('pending');
            $table->string('provider', 50)->nullable(); // Africa's Talking, Twilio, etc.
            $table->text('error_message')->nullable(); // Error details if failed
            $table->string('message_id', 100)->nullable(); // Provider's message ID
            $table->decimal('cost', 10, 4)->nullable(); // Cost in credits/currency
            $table->enum('type', ['single', 'bulk'])->default('single'); // Type of SMS
            $table->json('provider_response')->nullable(); // Full API response
            
            $table->timestamps();
            
            // Indexes for better query performance
            $table->index('organization_id');
            $table->index('customer_id');
            $table->index('status');
            $table->index('created_at');
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sms_logs');
    }
};
