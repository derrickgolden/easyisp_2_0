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
            // 1. Change existing expiry_date from date to dateTime
            $table->dateTime('expiry_date')->change();

            // 2. Add the new extension_date as dateTime and nullable
            // We use 'after' to keep the database organized
            $table->dateTime('extension_date')->nullable()->after('expiry_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // Rollback: Remove the new column
            $table->dropColumn('extension_date');
            
            // Rollback: Revert expiry_date to date
            $table->date('expiry_date')->change();
        });
    }
};
