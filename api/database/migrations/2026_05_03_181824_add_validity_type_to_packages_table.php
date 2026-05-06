<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->renameColumn('validity_days', 'validity');
        });

        Schema::table('packages', function (Blueprint $table) {
            $table->enum('validity_type', ['days', 'months'])->default('days')->after('validity');
        });
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn('validity_type');
            $table->renameColumn('validity', 'validity_days');
        });
    }
};
