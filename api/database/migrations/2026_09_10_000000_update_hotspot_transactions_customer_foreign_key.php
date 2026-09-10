<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hotspot_transactions', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
        });

        Schema::table('hotspot_transactions', function (Blueprint $table) {
            $table->foreign('customer_id')
                ->references('id')
                ->on('hotspot_customers')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('hotspot_transactions', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
        });

        Schema::table('hotspot_transactions', function (Blueprint $table) {
            $table->foreign('customer_id')
                ->references('id')
                ->on('customers')
                ->onDelete('cascade');
        });
    }
};
