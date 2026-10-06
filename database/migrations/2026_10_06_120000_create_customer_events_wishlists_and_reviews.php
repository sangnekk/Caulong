<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LOOKUPS = [['orders', 'user_id'], ['order_items', 'order_id']];

    public function up(): void
    {
        // What a visitor did in the shop that no other table records (viewed, searched, added
        // to the cart...). An account's events leave with the account.
        Schema::create('customer_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            // HMAC of a random value kept in the visitor's session: it groups a guest's events
            // and says nothing about who the guest is.
            $table->char('session_key', 64)->nullable();
            $table->string('name', 40);
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['user_id', 'created_at']);
            $table->index(['session_key', 'created_at']);
            $table->index(['name', 'created_at']);
            $table->index(['product_id', 'name']);
        });

        Schema::create('wishlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'product_id']);
            $table->index('product_id');
        });

        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // The delivered order line that entitles the customer to review the product.
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('body')->nullable();
            $table->string('status', 16)->default('pending');
            $table->timestamps();
            $table->unique(['user_id', 'product_id']);
            $table->index(['product_id', 'status']);
            $table->index(['status', 'created_at']);
        });

        // The customer page and the "did they receive it" check read orders by customer and
        // order lines by order. MySQL already indexes those foreign keys; SQLite does not.
        foreach (self::LOOKUPS as [$name, $column]) {
            if (! Schema::hasIndex($name, [$column])) {
                Schema::table($name, fn (Blueprint $table) => $table->index($column));
            }
        }
    }

    public function down(): void
    {
        foreach (self::LOOKUPS as [$name, $column]) {
            if (Schema::hasIndex($name, "{$name}_{$column}_index")) {
                Schema::table($name, fn (Blueprint $table) => $table->dropIndex([$column]));
            }
        }
        Schema::dropIfExists('product_reviews');
        Schema::dropIfExists('wishlists');
        Schema::dropIfExists('customer_events');
    }
};
