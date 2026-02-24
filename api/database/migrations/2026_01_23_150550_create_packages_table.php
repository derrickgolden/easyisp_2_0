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
        Schema::create('packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->string('name');
            
            // Base Speeds
            $table->string('speed_up');
            $table->string('speed_down');
            
            // Pricing & Type
            $table->decimal('price', 12, 2);
            $table->integer('validity_days')->default(30);
            $table->enum('type', ['time', 'data'])->default('time');
            
            // Bursting configs (Level 2 & 3)
            $table->string('burst_limit_up')->nullable();
            $table->string('burst_limit_down')->nullable();
            $table->string('burst_threshold_up')->nullable();
            $table->string('burst_threshold_down')->nullable();
            $table->string('burst_time')->nullable();

            // NEW: Quality of Service (Level 4 & 5)
            $table->integer('priority')->default(8); // MikroTik 1 (High) to 8 (Low)
            $table->string('min_limit_up')->nullable(); // CIR Upload
            $table->string('min_limit_down')->nullable(); // CIR Download
            
            $table->timestamps();

            $table->index(['organization_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('packages');
    }
};
