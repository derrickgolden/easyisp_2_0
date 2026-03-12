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
        Schema::table('sites', function (Blueprint $table) {
            $table->string('mikrotik_username')->nullable()->after('ip_address');
            $table->string('mikrotik_password')->nullable()->after('mikrotik_username');
            $table->unsignedInteger('mikrotik_port')->nullable()->after('mikrotik_password');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn([
                'mikrotik_username',
                'mikrotik_password',
                'mikrotik_port',
            ]);
        });
    }
};
