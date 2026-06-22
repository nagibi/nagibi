<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Roda no contexto do tenant — a tabela `menus` parece ser
        // compartilhada por tenant (mesma origem do GlobalSearchService).
        // Ajuste para database/migrations/tenant/ se essa tabela viver lá,
        // ou remova o comentário se for de fato central.

        $parentId = DB::table('menus')->where('slug', 'configuracoes')->value('id');

        if ($parentId === null) {
            // 'Configurações' (id 144 no dump) não foi encontrado — aborta
            // sem quebrar o deploy, mas alerta no log de migrations.
            return;
        }

        DB::table('menus')->insert([
            'title' => 'Configurações de Alertas',
            'translation_key' => 'menu.equipamento.alert_settings',
            'slug' => 'equipamento-configuracoes-alertas',
            'icon' => 'BellRing',
            'badge' => null,
            'path' => '/equipamentos/configuracoes-alertas',
            'target' => '_self',
            'parent_id' => $parentId,
            'order' => 0,
            'is_active' => 1,
            'requires_auth' => 1,
            // Mesmas roles de "Configurações" — ajuste se quiser restringir
            // mais (ex: só admin, sem super-admin, ou incluir manager).
            'roles' => json_encode(['admin', 'super-admin']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('menus')->where('slug', 'equipamento-configuracoes-alertas')->delete();
    }
};
