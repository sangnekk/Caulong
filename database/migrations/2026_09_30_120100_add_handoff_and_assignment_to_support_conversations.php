<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            $table->boolean('needs_human')->default(false)->index();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_to');
            // SQLite refuses to drop a column while an index still names it.
            $table->dropIndex(['needs_human']);
            $table->dropColumn('needs_human');
        });
    }
};
