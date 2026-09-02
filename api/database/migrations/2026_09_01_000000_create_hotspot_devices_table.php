<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateHotspotDevicesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('hotspot_devices', function (Blueprint $table) {
            $table->id();
            $table->char('device_token_hash', 64)->unique();
            $table->string('current_mac', 17)->nullable();
            $table->string('previous_mac', 17)->nullable();
            $table->foreignId('customer_id')->nullable()->constrained('hotspot_customers')->onDelete('cascade');
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('hotspot_devices');
    }
}
