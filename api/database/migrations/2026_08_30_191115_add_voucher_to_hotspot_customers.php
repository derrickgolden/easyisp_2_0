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
        Schema::table('hotspot_customers', function (Blueprint $table) {
            $table->string('voucher')->nullable()->unique()->index()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotspot_customers', function (Blueprint $table) {
            $table->dropColumn('voucher');
        });
    }
};
