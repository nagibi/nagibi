<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $parentId = DB::table('menus')->where('slug', 'equipamento-cadastros')->value('id');

        if ($parentId === null) {
            return;
        }

        if (DB::table('menus')->where('slug', 'equipamento-grupos')->exists()) {
            return;
        }

        DB::table('menus')
            ->where('parent_id', $parentId)
            ->whereIn('slug', ['equipamento-tipos', 'equipamento-fornecedores', 'equipamento-obras'])
            ->increment('order');

        DB::table('menus')->insert([
            'title' => 'Grupos',
            'translation_key' => 'menu.equipamento.groups',
            'slug' => 'equipamento-grupos',
            'icon' => 'Layers',
            'badge' => null,
            'path' => '/equipamentos/grupos',
            'target' => '_self',
            'parent_id' => $parentId,
            'order' => 0,
            'is_active' => 1,
            'requires_auth' => 1,
            'roles' => json_encode(['admin', 'manager', 'super-admin']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        $parentId = DB::table('menus')->where('slug', 'equipamento-cadastros')->value('id');

        DB::table('menus')->where('slug', 'equipamento-grupos')->delete();

        if ($parentId !== null) {
            DB::table('menus')
                ->where('parent_id', $parentId)
                ->whereIn('slug', ['equipamento-tipos', 'equipamento-fornecedores', 'equipamento-obras'])
                ->decrement('order');
        }
    }
};
