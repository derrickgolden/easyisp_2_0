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
        $this->dropIndexIfExists('customers', 'customers_radius_username_unique');
        $this->dropIndexIfExists('hotspot_customers', 'hotspot_customers_radius_username_unique');

        Schema::table('customers', function (Blueprint $table) {
            $table->unique(['organization_id', 'radius_username']);
        });

        Schema::table('hotspot_customers', function (Blueprint $table) {
            $table->unique(['organization_id', 'radius_username']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->dropIndexIfExists('customers', 'customers_organization_id_radius_username_unique');
        $this->dropIndexIfExists('hotspot_customers', 'hotspot_customers_organization_id_radius_username_unique');

        Schema::table('customers', function (Blueprint $table) {
            $table->unique('radius_username');
        });

        Schema::table('hotspot_customers', function (Blueprint $table) {
            $table->unique('radius_username');
        });
    }

    protected function dropIndexIfExists(string $table, string $indexName): void
    {
        $indexes = DB::select("SHOW INDEX FROM `{$table}`");

        foreach ($indexes as $index) {
            if (($index->Key_name ?? null) === $indexName) {
                Schema::table($table, function (Blueprint $table) use ($indexName) {
                    $table->dropUnique($indexName);
                });

                return;
            }
        }
    }
};
