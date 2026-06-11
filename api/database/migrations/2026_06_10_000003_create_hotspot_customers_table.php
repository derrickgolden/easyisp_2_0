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
        Schema::create('hotspot_customers', function (Blueprint $table) {
            $table->id();

            // Multi-tenancy & Location Tracking
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->foreignId('site_id')->constrained()->onDelete('cascade');

            // Core Identity (MAC is unique per organization)
            $table->string('mac_address', 20);
            $table->string('phone_number', 15)->nullable();

            // Subscription/Access State
            $table->foreignId('current_package_id')->nullable()->constrained('packages')->nullOnDelete();
            $table->enum('status', ['active', 'expired', 'blacklisted'])->default('expired');

            // Network properties for active session
            $table->string('last_ip_address', 45)->nullable();

            // Usage Windows
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();

            $table->timestamps();

            // Fast lookup and tenant uniqueness
            $table->unique(['organization_id', 'mac_address'], 'org_mac_unique');
            $table->index('phone_number');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hotspot_customers');
    }
};
