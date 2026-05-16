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
            $table->timestamp('expiry_one_hour_warning_sent_at')
                ->nullable()
                ->after('expiry_warning_sent_at')
                ->comment('Timestamp when 1-hour expiry warning was sent');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('expiry_one_hour_warning_sent_at');
        });
    }
};
