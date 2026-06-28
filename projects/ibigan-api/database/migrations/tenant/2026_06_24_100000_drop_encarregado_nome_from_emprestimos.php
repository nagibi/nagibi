<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('emprestimos', function (Blueprint $table): void {
            $table->dropColumn('encarregado_nome');
        });
    }

    public function down(): void
    {
        Schema::table('emprestimos', function (Blueprint $table): void {
            $table->string('encarregado_nome')->nullable()->after('colaborador_whatsapp');
        });
    }
};
