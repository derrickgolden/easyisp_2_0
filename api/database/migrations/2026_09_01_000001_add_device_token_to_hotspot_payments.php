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
        Schema::table('hotspot_payments', function (Blueprint $table) {
            $table->text('device_token')->nullable()->after('mpesa_receipt');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotspot_payments', function (Blueprint $table) {
            $table->dropColumn('device_token');
        });
    }
};
