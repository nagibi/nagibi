<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Troca o ícone de Movimentações: ArrowLeftRight confundia com o botão Voltar (ArrowLeft).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('menus')
            ->where('slug', 'equipamento-movimentacoes')
            ->update(['icon' => 'Repeat2']);
    }

    public function down(): void
    {
        DB::table('menus')
            ->where('slug', 'equipamento-movimentacoes')
            ->update(['icon' => 'ArrowLeftRight']);
    }
};
