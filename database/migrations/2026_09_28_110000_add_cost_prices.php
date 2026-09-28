<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the shop paid per unit (giá nhập). Optional: gross profit is only reported where it is
 * known. Each order line keeps the cost at the time of sale, so later price changes do not
 * rewrite past profit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('cost_price')->nullable()->after('price');
        });
        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('unit_cost')->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', fn (Blueprint $table) => $table->dropColumn('unit_cost'));
        Schema::table('product_variants', fn (Blueprint $table) => $table->dropColumn('cost_price'));
    }
};
