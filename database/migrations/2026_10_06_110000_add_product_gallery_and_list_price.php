<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A product's further photos (its first stays products.image_path, the one cards and the cart
 * show), the list price a version is compared with, and the indexes the product
 * recommendations read through.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            // sha256 of the file: an import tells an unchanged gallery from a new one without reading it back.
            $table->char('hash', 64);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->index(['product_id', 'position']);
        });
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('compare_at_price')->nullable()->after('price');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->index(['play_style', 'is_active']);
            $table->index(['brand_id', 'is_active']);
        });
        // MySQL already indexes the foreign key; SQLite does not.
        if (! Schema::hasIndex('order_items', ['variant_id'])) {
            Schema::table('order_items', fn (Blueprint $table) => $table->index('variant_id'));
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('order_items', 'order_items_variant_id_index')) {
            Schema::table('order_items', fn (Blueprint $table) => $table->dropIndex(['variant_id']));
        }
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['brand_id', 'is_active']);
            $table->dropIndex(['play_style', 'is_active']);
        });
        Schema::table('product_variants', fn (Blueprint $table) => $table->dropColumn('compare_at_price'));
        Schema::dropIfExists('product_images');
    }
};
