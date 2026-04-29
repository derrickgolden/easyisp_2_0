<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Drop the global unique on email
            $table->dropUnique(['email']);

            // Replace with per-organization uniqueness: same email can exist in different orgs
            $table->unique(['organization_id', 'email'], 'users_organization_id_email_unique');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_organization_id_email_unique');
            $table->unique('email');
        });
    }
};
