<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * When each step of an order happened, so reports count money on the day it was collected and
 * orders on the day they moved, not on whenever the row was last touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('paid_at')->nullable()->index();
            $table->index('created_at');
        });

        // Orders from before this change: the last update is the closest record of their final
        // step. Earlier steps of those orders stay unknown rather than guessed.
        DB::table('orders')->where('payment_status', 'paid')->update(['paid_at' => DB::raw('updated_at')]);
        foreach (['confirmed', 'shipped', 'delivered', 'cancelled'] as $status) {
            DB::table('orders')->where('status', $status)->update([$status.'_at' => DB::raw('updated_at')]);
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
            $table->dropIndex(['paid_at']);
            $table->dropColumn(['confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at', 'paid_at']);
        });
    }
};
