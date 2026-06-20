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

        DB::table('menus')
            ->where('slug', 'equipcontrol-historico')
            ->delete();
    }

    public function down(): void
    {
        if (! Schema::hasTable('menus')) {
            return;
        }

        $parentId = DB::table('menus')->where('slug', 'equipcontrol-operacao')->value('id');

        if ($parentId === null) {
            return;
        }

        $exists = DB::table('menus')->where('slug', 'equipcontrol-historico')->exists();

        if ($exists) {
            return;
        }

        $now = now();

        DB::table('menus')->insert([
            'title' => 'Histórico',
            'slug' => 'equipcontrol-historico',
            'icon' => 'History',
            'path' => '/equipamentos/historico',
            'target' => '_self',
            'parent_id' => $parentId,
            'order' => 5,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => json_encode(['admin', 'manager', 'viewer', 'operator', 'super-admin']),
            'translation_key' => 'menu.equipcontrol.equipment_history',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
};
