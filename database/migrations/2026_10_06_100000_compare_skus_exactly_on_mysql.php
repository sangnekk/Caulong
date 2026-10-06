<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * SQLite, where the shop started, compares SKUs exactly. MySQL's usual collation treats
     * "DEMO-1" and "demo-1" as the same value, and the unique index would then refuse the
     * catalog as it is: retired upper-case demo SKUs sit beside their lower-case successors.
     */
    public function up(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            Schema::table('product_variants', fn (Blueprint $table) => $table->string('sku', 80)->collation('utf8mb4_bin')->change());
        }
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            Schema::table('product_variants', fn (Blueprint $table) => $table->string('sku', 80)->collation((string) DB::getConfig('collation'))->change());
        }
    }
};
