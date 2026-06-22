<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Alinha ícones e ordem dos itens de operação do Equipamento com o rodapé mobile
 * (Package, Repeat2, Wrench — ver equipamento-bottom-nav.tsx).
 */
return new class extends Migration
{
    public function up(): void
    {
        $items = [
            'equipamento-estoque' => ['icon' => 'Package', 'order' => 1],
            'equipamento-movimentacoes' => ['icon' => 'Repeat2', 'order' => 2],
            'equipamento-manutencao' => ['icon' => 'Wrench', 'order' => 3],
        ];

        foreach ($items as $slug => $values) {
            DB::table('menus')
                ->where('slug', $slug)
                ->update($values);
        }
    }

    public function down(): void
    {
        $items = [
            'equipamento-estoque' => ['icon' => 'Package', 'order' => 1],
            'equipamento-manutencao' => ['icon' => 'Wrench', 'order' => 2],
            'equipamento-movimentacoes' => ['icon' => 'ArrowLeftRight', 'order' => 3],
        ];

        foreach ($items as $slug => $values) {
            DB::table('menus')
                ->where('slug', $slug)
                ->update($values);
        }
    }
};
