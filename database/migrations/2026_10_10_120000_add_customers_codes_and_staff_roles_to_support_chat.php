<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Support conversations belong to an account when there is one, move through open / pending /
 * resolved / closed, and can be read again with a code once they are over. Staff get a role:
 * who may run the shop, and who only answers customers. All additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            // The customer's account; null for a visitor who was not signed in. Leaves with the account.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            // The code a customer reads the conversation again with: only its keyed hash is kept.
            $table->string('access_code_hash', 64)->nullable()->unique();
            $table->timestamp('access_code_expires_at')->nullable();
        });
        DB::table('support_conversations')->where('status', 'closed')->update(['closed_at' => DB::raw('updated_at')]);

        Schema::table('users', function (Blueprint $table) {
            // What a staff account (is_admin) may do: admin | support. Null for customers.
            $table->string('role', 20)->nullable();
        });
        DB::table('users')->where('is_admin', true)->update(['role' => 'admin']);
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('role'));
        Schema::table('support_conversations', function (Blueprint $table) {
            $table->dropUnique(['access_code_hash']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['resolved_at', 'closed_at', 'access_code_hash', 'access_code_expires_at']);
        });
    }
};
