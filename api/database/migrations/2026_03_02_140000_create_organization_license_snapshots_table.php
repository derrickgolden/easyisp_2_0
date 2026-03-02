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
        Schema::create('organization_license_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->date('snapshot_month');
            $table->unsignedInteger('active_users_count')->default(0);
            $table->decimal('price_per_user', 10, 2)->default(15.00);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('status', ['billed', 'paid'])->default('billed');
            $table->timestamp('billed_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'snapshot_month'], 'org_license_snapshot_unique');
            $table->index(['organization_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organization_license_snapshots');
    }
};
