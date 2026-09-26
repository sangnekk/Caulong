<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['brands', 'categories'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table) {
                $table->id();
                $table->string('name', 120);
                $table->string('slug', 160)->unique();
                $table->timestamps();
            });
        }

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 160);
            $table->string('slug', 180)->unique();
            $table->text('description');
            $table->string('image_path')->nullable();
            $table->json('specs')->nullable();
            $table->enum('play_style', ['attack', 'speed', 'balanced']);
            $table->enum('skill_level', ['beginner', 'intermediate', 'advanced', 'all']);
            $table->boolean('is_active')->default(false)->index();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_demo')->default(false);
            $table->timestamps();
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('sku', 80)->unique();
            $table->string('name', 120);
            $table->unsignedBigInteger('price');
            $table->unsignedInteger('stock');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['product_id', 'is_active', 'price']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('brands');
    }
};
