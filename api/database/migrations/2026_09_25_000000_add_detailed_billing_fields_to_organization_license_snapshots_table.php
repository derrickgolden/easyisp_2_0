<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_license_snapshots', function (Blueprint $table) {
            $table->unsignedInteger('active_pppoe_users_count')->default(0)->after('active_users_count');
            $table->decimal('price_per_pppoe_user', 10, 2)->default(15.00)->after('price_per_user');
            $table->decimal('pppoe_amount', 12, 2)->default(0)->after('price_per_pppoe_user');
            $table->decimal('hotspot_payments', 12, 2)->default(0)->after('pppoe_amount');
            $table->decimal('hotspot_percentage', 5, 2)->default(3.00)->after('hotspot_payments');
            $table->decimal('hotspot_amount', 12, 2)->default(0)->after('hotspot_percentage');
        });
    }

    public function down(): void
    {
        Schema::table('organization_license_snapshots', function (Blueprint $table) {
            $table->dropColumn([
                'active_pppoe_users_count',
                'price_per_pppoe_user',
                'pppoe_amount',
                'hotspot_payments',
                'hotspot_percentage',
                'hotspot_amount',
            ]);
        });
    }
};
