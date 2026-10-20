<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What staff changed in /admin: one row per state-changing request. All additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_activity_logs', function (Blueprint $table) {
            $table->id();
            // The account leaves; what it did in the shop stays, without a name attached.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('method', 10);
            // The request path only: never the query string, the body, a password or a token.
            $table->string('path', 2048);
            $table->string('route', 191)->nullable();
            $table->unsignedSmallInteger('status');
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index('created_at');
            // The full path is not indexed: on MySQL that would exceed the key length.
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_activity_logs');
    }
};
