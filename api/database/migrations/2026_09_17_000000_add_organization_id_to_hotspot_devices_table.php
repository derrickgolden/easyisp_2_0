<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('hotspot_devices', function (Blueprint $table) {
            $table->unsignedBigInteger('organization_id')->nullable()->after('customer_id')->index();

            if (Schema::hasTable('organizations')) {
                $table->foreign('organization_id')
                    ->references('id')
                    ->on('organizations')
                    ->onDelete('cascade');
            }
        });

        // Backfill organization_id from hotspot_customers when possible
        try {
            if (Schema::hasTable('hotspot_customers')) {
                DB::statement('UPDATE hotspot_devices hd JOIN hotspot_customers hc ON hd.customer_id = hc.id SET hd.organization_id = hc.organization_id');
            }
        } catch (\Throwable $e) {
            // If the DB engine doesn't support multi-table update or something else fails, skip backfill.
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('hotspot_devices', function (Blueprint $table) {
            if (Schema::hasTable('organizations')) {
                $table->dropForeign(['organization_id']);
            }

            $table->dropColumn('organization_id');
        });
    }
};
