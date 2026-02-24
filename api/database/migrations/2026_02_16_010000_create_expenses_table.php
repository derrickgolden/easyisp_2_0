<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->string('description');
            $table->decimal('amount', 10, 2);
            $table->string('category');
            $table->date('date');
            $table->string('payment_method');
            $table->string('reference_no')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_id', 'date']);
            $table->index(['organization_id', 'category']);
            $table->index('reference_no');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
