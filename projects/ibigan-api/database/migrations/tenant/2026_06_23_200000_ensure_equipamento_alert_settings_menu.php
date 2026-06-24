<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $parentId = DB::table('menus')->where('slug', 'configuracoes')->value('id');

        if ($parentId === null) {
            return;
        }

        if (DB::table('menus')->where('slug', 'equipamento-configuracoes-alertas')->exists()) {
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
