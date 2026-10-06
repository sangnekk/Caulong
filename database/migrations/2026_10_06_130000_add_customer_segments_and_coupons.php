<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The group each customer falls in (recalculated from their orders and activity), and
 * coupons: for everyone, for one customer, or for a group. All additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('segment', 16)->nullable()->index();
            $table->timestamp('segment_updated_at')->nullable();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            // As customers type it; kept in upper case.
            $table->string('code', 40)->unique();
            // What the customer reads next to the code.
            $table->string('name', 120);
            // "percent" (value 1-100) or "fixed" (value in dong).
            $table->string('type', 16);
            $table->unsignedBigInteger('value');
            $table->unsignedBigInteger('min_order')->default(0);
            // The most a percentage may take off; null: no ceiling.
            $table->unsignedBigInteger('max_discount')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            // Orders it may be used on in all, and per customer; null: no limit.
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('per_customer_limit')->nullable();
            // Who may use it: one account, one customer group, or (both null) anyone.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('segment', 16)->nullable();
            $table->string('campaign', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['user_id', 'is_active']);
            $table->index(['segment', 'is_active']);
            $table->index('campaign');
        });

        // With rows here the coupon only counts the products (or categories) listed.
        Schema::create('coupon_product', function (Blueprint $table) {
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->primary(['coupon_id', 'product_id']);
        });
        Schema::create('coupon_category', function (Blueprint $table) {
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->primary(['coupon_id', 'category_id']);
        });

        // One row per order a coupon was used on: what the limits are counted from. The order
        // keeps its own copy of the code and the amount, so it stays right without this row.
        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount');
            $table->timestamp('created_at')->nullable();
            $table->index(['coupon_id', 'user_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            // total = subtotal - discount_total + shipping_fee.
            $table->unsignedBigInteger('discount_total')->default(0)->after('shipping_fee');
            $table->string('coupon_code', 40)->nullable()->after('discount_total');
        });
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $table) => $table->dropColumn(['discount_total', 'coupon_code']));
        Schema::dropIfExists('coupon_redemptions');
        Schema::dropIfExists('coupon_category');
        Schema::dropIfExists('coupon_product');
        Schema::dropIfExists('coupons');
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['segment']);
            $table->dropColumn(['segment', 'segment_updated_at']);
        });
    }
};
