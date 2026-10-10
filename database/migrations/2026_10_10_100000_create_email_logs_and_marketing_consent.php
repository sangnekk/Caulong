<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A record of every email the shop sends, and the customer's say on promotional email.
 * All additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // When the customer agreed to promotional email; null: they have not (or took it back).
            $table->timestamp('marketing_opt_in_at')->nullable();
        });

        Schema::create('email_logs', function (Blueprint $table) {
            $table->id();
            // What the email is: order_placed, welcome, winback... (App\Services\EmailService::TYPES).
            $table->string('type', 40);
            $table->string('recipient', 190);
            $table->string('subject');
            // queued (waiting for the queue worker) | sent | failed
            $table->string('status', 16)->default('queued');
            // The id the mail provider gave the message, when it gives one.
            $table->string('provider_message_id', 190)->nullable();
            $table->text('error')->nullable();
            // An account's email history leaves with the account.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->index(['type', 'created_at']);
            $table->index(['user_id', 'type']);
            $table->index(['order_id', 'type']);
            $table->index(['status', 'created_at']);
            $table->index('recipient');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_logs');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('marketing_opt_in_at'));
    }
};
