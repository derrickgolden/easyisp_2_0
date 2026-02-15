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
        Schema::table('customers', function (Blueprint $table) {
            // Store remaining subscription time in seconds
            $table->unsignedInteger('paused_seconds_remaining')->default(0)->after('balance');
            
            // It is professional to ensure 'status' is indexed for faster cron lookups
            // Only add this if you haven't indexed it yet
            $table->index('status'); 
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('paused_seconds_remaining');
            $table->dropIndex(['status']);
        });
    }
};
