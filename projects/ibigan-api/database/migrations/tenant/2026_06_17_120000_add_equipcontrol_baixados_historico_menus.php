<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('menus')) {
            return;
        }

        $parentId = DB::table('menus')->where('slug', 'equipcontrol-operacao')->value('id');

        if ($parentId === null) {
            return;
        }

        $roles = json_encode(['admin', 'manager', 'viewer', 'operator', 'super-admin']);
        $now = now();

        $items = [
            [
                'slug' => 'equipcontrol-baixados',
                'title' => 'Baixados',
                'icon' => 'Archive',
                'path' => '/equipamentos/baixados',
                'order' => 4,
                'translation_key' => 'menu.equipcontrol.decommissioned',
            ],
            [
                'slug' => 'equipcontrol-historico',
                'title' => 'Histórico',
                'icon' => 'History',
                'path' => '/equipamentos/historico',
                'order' => 5,
                'translation_key' => 'menu.equipcontrol.equipment_history',
            ],
        ];

        foreach ($items as $item) {
            $exists = DB::table('menus')->where('slug', $item['slug'])->exists();

            if ($exists) {
                DB::table('menus')
                    ->where('slug', $item['slug'])
                    ->update([
                        'title' => $item['title'],
                        'icon' => $item['icon'],
                        'path' => $item['path'],
                        'order' => $item['order'],
                        'parent_id' => $parentId,
                        'is_active' => true,
                        'translation_key' => $item['translation_key'],
                        'updated_at' => $now,
                    ]);

                continue;
            }

            DB::table('menus')->insert([
                'title' => $item['title'],
                'slug' => $item['slug'],
                'icon' => $item['icon'],
                'path' => $item['path'],
                'target' => '_self',
                'parent_id' => $parentId,
                'order' => $item['order'],
                'is_active' => true,
                'requires_auth' => true,
                'roles' => $roles,
                'translation_key' => $item['translation_key'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('menus')) {
            return;
        }

        DB::table('menus')
            ->whereIn('slug', ['equipcontrol-baixados', 'equipcontrol-historico'])
            ->delete();
    }
};
