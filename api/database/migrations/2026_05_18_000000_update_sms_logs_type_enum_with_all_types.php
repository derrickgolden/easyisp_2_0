<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Extend the sms_logs type enum to include all message types used by CustomerMessagingService
        DB::statement("ALTER TABLE `sms_logs` MODIFY COLUMN `type` ENUM(
            'single',
            'bulk',
            'system',
            'expiry-warning',
            'expiry-one-hour-warning',
            'expiry-notification',
            'registration',
            'payment',
            'reminder',
            'custom',
            'suspension',
            'reactivation',
            'other'
        ) NOT NULL DEFAULT 'single'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE `sms_logs` MODIFY COLUMN `type` ENUM(
            'single',
            'bulk',
            'system',
            'expiry-warning',
            'expiry-notification'
        ) NOT NULL DEFAULT 'single'");
    }
};
