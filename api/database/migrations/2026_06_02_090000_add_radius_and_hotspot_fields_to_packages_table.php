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
        DB::statement("ALTER TABLE packages MODIFY validity_type ENUM('days','months','hours','minutes') NOT NULL DEFAULT 'days'");

        Schema::table('packages', function (Blueprint $table) {
            $table->string('radius_group')->nullable()->after('name');
            $table->json('attributes')->nullable()->after('radius_group');
            $table->unsignedInteger('data_limit_mb')->nullable()->after('type');
            $table->unsignedInteger('session_timeout')->nullable()->after('data_limit_mb');
            $table->unsignedInteger('idle_timeout')->nullable()->after('session_timeout');
            $table->unsignedInteger('shared_users')->default(1)->after('idle_timeout');
            $table->timestamp('expires_at')->nullable()->after('shared_users');
            $table->string('mikrotik_profile')->nullable()->after('expires_at');
            $table->boolean('is_voucher')->default(false)->after('mikrotik_profile');
            $table->enum('status', ['pppoe', 'hotspot'])->default('pppoe')->after('is_voucher');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn([
                'radius_group',
                'attributes',
                'data_limit_mb',
                'session_timeout',
                'idle_timeout',
                'shared_users',
                'expires_at',
                'mikrotik_profile',
                'is_voucher',
                'status',
            ]);
        });

        DB::statement("ALTER TABLE packages MODIFY validity_type ENUM('days','months') NOT NULL DEFAULT 'days'");
    }
};
