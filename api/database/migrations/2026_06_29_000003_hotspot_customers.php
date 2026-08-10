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
            $table->unsignedBigInteger('organization_id');
            $table->unsignedBigInteger('parent_id')->nullable()->index();
            $table->unsignedBigInteger('package_id');
            $table->decimal('custom_package_price', 12, 2)->nullable();
            $table->unsignedBigInteger('site_id')->nullable()->index();

            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone');
            $table->string('location')->nullable();

            $table->enum('connection_type', ['Hotspot', 'Static IP', 'DHCP'])->default('Hotspot');
            $table->decimal('installation_fee', 10, 2)->default(0);

            $table->enum('status', ['active', 'expired', 'suspended'])->default('active');
            $table->dateTime('expiry_date')->nullable();
            $table->dateTime('extension_date')->nullable();
            $table->timestamp('expiry_one_hour_warning_sent_at')->nullable();
            $table->timestamp('expiry_ten_minutes_warning_sent_at')->nullable();
            $table->timestamp('expiry_warning_sent_at')->nullable();

            $table->decimal('balance', 12, 2)->default(0);
            $table->unsignedInteger('paused_seconds_remaining')->default(0);
            $table->boolean('is_independent')->default(true);

            $table->string('radius_username')->unique();
            $table->string('radius_password')->nullable();

            $table->string('ip_address')->nullable()->index();
            $table->string('mac_address')->nullable()->index();

            $table->string('host_name')->nullable();
            $table->string('device_name')->nullable();
            $table->string('os_platform')->nullable();
            $table->string('browser_name')->nullable();

            $table->timestamp('activated_at')->nullable();

            $table->string('password');

            $table->rememberToken();
            $table->timestamps();

            $table->index(['organization_id', 'email']);
            $table->index(['organization_id', 'phone']);
            $table->index(['organization_id', 'status']);
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
