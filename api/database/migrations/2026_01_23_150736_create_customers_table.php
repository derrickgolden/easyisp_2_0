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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->foreignId('parent_id')->nullable()->constrained('customers')->onDelete('cascade'); // Sub-account hierarchy
            $table->foreignId('package_id')->constrained();
            $table->foreignId('site_id')->nullable()->constrained();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->nullable();
            $table->string('phone');
            $table->string('location');
            $table->string('apartment')->nullable();
            $table->string('house_no')->nullable();
            $table->enum('connection_type', ['PPPoE', 'Static IP', 'DHCP'])->default('PPPoE');
            $table->decimal('installation_fee', 10, 2)->default(0);
            $table->enum('status', ['active', 'expired', 'suspended'])->default('active');
            $table->date('expiry_date');
            $table->decimal('balance', 12, 2)->default(0);
            $table->boolean('is_independent')->default(true); // Sub-account billing dependency
            // RADIUS details
            $table->string('radius_username')->unique();
            $table->string('radius_password');
            $table->string('ip_address')->nullable();
            $table->string('mac_address')->nullable();
            $table->timestamps();

            // Composite Unique Constraints
            // This allows info@test.com to exist in Org A and Org B, 
            // but blocks it from being added twice in Org A.
            $table->index(['organization_id', 'email']);
            $table->index(['organization_id', 'phone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
