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
        Schema::create('hotspot_payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('organization_id');
            $table->foreignId('site_id');
            $table->foreignId('package_id');

            $table->string('phone');
            $table->string('mac_address')->nullable();
            $table->string('ip_address')->nullable();

            $table->decimal('amount', 10, 2);

            $table->string('account_reference')->nullable();
            $table->string('checkout_request_id')->nullable();

            $table->string('mpesa_receipt')->nullable();

            $table->enum('status', [
                'pending',
                'paid',
                'failed',
                'expired',
            ])->default('pending');

            $table->timestamp('expires_at')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hotspot_payments');
    }
};
