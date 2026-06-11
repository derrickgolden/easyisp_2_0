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
        Schema::table('customers', function (Blueprint $table) {
            $table->string('f_identity')->nullable()->after('password')->index();
        });

        // Attempt to populate from a CSV placed at database/imports/180126Apr2026_customers.csv
        $csvPath = database_path('imports/180126Apr2026_customers.csv');

        if (file_exists($csvPath) && is_readable($csvPath)) {
            if (($handle = fopen($csvPath, 'r')) !== false) {
                $header = fgetcsv($handle);
                if ($header === false) {
                    fclose($handle);
                    return;
                }

                while (($row = fgetcsv($handle)) !== false) {
                    if (count($row) !== count($header)) {
                        // skip malformed rows
                        continue;
                    }
                    $data = array_combine($header, $row);

                    $phone = isset($data['Phone']) ? trim($data['Phone']) : null;
                    $account = isset($data['Account']) ? trim($data['Account']) : null;

                    if ($phone && $account) {
                        DB::table('customers')
                            ->where('phone', $phone)
                            ->update(['f_identity' => $account]);
                    }
                }

                fclose($handle);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'f_identity')) {
                $table->dropColumn('f_identity');
            }
        });
    }
};
