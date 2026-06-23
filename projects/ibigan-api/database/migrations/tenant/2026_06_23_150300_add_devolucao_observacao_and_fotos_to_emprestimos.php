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
            $table->text('observacao_devolucao')->nullable()->after('data_devolucao');
            $table->json('fotos_equipamento_devolucao_paths')->nullable()->after('foto_equipamento_devolucao_path');
        });
    }

    public function down(): void
    {
        Schema::table('emprestimos', function (Blueprint $table): void {
            $table->dropColumn([
                'observacao_devolucao',
                'fotos_equipamento_devolucao_paths',
            ]);
        });
    }
};
