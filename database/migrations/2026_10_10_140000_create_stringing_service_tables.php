<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The racket stringing service: the strings the shop strings with, and the requests customers
 * make. Kept apart from products and orders: a string here is a material of the service with
 * one price, and a request is work on the customer's own racket, not goods to deliver.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_strings', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->string('brand', 80)->nullable();
            // Thickness as the maker writes it: "0.68 mm".
            $table->string('gauge', 20)->nullable();
            // Dong for the string of one racket; the stringing itself is the shop's fee.
            $table->unsignedBigInteger('price');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('service_orders', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            // The token the page gave the form: sending the form twice makes one request.
            $table->uuid('booking_token')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 120);
            $table->string('phone', 20)->index();
            $table->string('email', 190)->nullable();
            // shop_string: one of service_strings. own_string: the customer brings the string.
            $table->string('service_type', 20);
            $table->string('racket', 160);
            $table->foreignId('service_string_id')->nullable()->constrained()->nullOnDelete();
            // The string's name as it was when requested (or what the customer says they bring).
            $table->string('string_name', 160)->nullable();
            $table->decimal('tension_kg', 4, 1);
            $table->unsignedTinyInteger('quantity')->default(1);
            $table->text('notes')->nullable();
            // When the customer plans to bring the racket in.
            $table->timestamp('preferred_at')->nullable();
            // pending | confirmed | in_progress | ready | completed | cancelled
            $table->string('status', 16)->default('pending')->index();
            // The member of staff who strings it.
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            // Per racket, as quoted when requested; the total is what the customer pays at pick-up.
            $table->unsignedBigInteger('string_price')->default(0);
            $table->unsignedBigInteger('labor_fee')->default(0);
            $table->unsignedBigInteger('total')->default(0);
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('in_progress_at')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_orders');
        Schema::dropIfExists('service_strings');
    }
};
