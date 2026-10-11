<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Money asked for before the goods go out: a bank transfer the shop then confirms. Cash on
 * delivery needs no row here; it stays on the order (payment_status, paid_at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            // bank_transfer for now; a provider's name when one is connected.
            $table->string('method', 30);
            $table->unsignedBigInteger('amount');
            // What the customer writes in the transfer: how a transfer is matched to its order.
            $table->string('reference', 40)->unique();
            // pending | paid | expired | cancelled | refunded
            $table->string('status', 16)->default('pending');
            // The bank's or provider's own id of the transfer: one transfer settles one payment.
            $table->string('provider_transaction_id', 100)->nullable()->unique();
            // Until when the order keeps its goods without the money.
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            // The member of staff who saw the money arrive; empty when a provider reported it.
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('refunded_at')->nullable();
            $table->foreignId('refunded_by')->nullable()->constrained('users')->nullOnDelete();
            // What a provider sent with its report, kept as received.
            $table->json('payload')->nullable();
            $table->timestamps();
            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
