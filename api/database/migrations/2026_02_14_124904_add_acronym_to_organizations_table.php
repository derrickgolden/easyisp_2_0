<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('acronym', 5)->default('ORG')->after('name');
        });

        // Auto-generate acronyms for existing organizations based on their names
        $organizations = DB::table('organizations')->get();
        foreach ($organizations as $org) {
            $words = explode(' ', $org->name);
            $acronym = '';
            foreach ($words as $word) {
                if (!empty($word)) {
                    $acronym .= strtoupper($word[0]);
                }
            }
            $acronym = substr($acronym ?: 'ORG', 0, 5);
            
            // Ensure uniqueness by appending number if needed
            $counter = 1;
            $uniqueAcronym = $acronym;
            while (DB::table('organizations')->where('id', '!=', $org->id)->where('acronym', $uniqueAcronym)->exists()) {
                $uniqueAcronym = substr($acronym, 0, 4) . $counter;
                $counter++;
            }
            
            DB::table('organizations')->where('id', $org->id)->update(['acronym' => $uniqueAcronym]);
        }

        // Remove default and add unique constraint
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('acronym', 5)->unique()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('acronym');
        });
    }
};
