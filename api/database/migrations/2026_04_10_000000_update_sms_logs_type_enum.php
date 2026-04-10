<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Extend the sms_logs type enum to include system and expiry notification values.
        DB::statement("ALTER TABLE `sms_logs` MODIFY COLUMN `type` ENUM('single','bulk','system','expiry-warning','expiry-notification') NOT NULL DEFAULT 'single'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE `sms_logs` MODIFY COLUMN `type` ENUM('single','bulk') NOT NULL DEFAULT 'single'");
    }
};