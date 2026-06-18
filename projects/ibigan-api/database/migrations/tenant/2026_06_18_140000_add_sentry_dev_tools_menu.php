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

        $parentId = DB::table('menus')->where('slug', 'ferramentas')->value('id');

        if ($parentId === null) {
            return;
        }

        $item = [
            'slug' => 'sentry',
            'title' => 'Sentry',
            'icon' => 'Bug',
            'path' => config('dev-tools.sentry_url'),
            'order' => 10,
            'translation_key' => 'menu.sentry',
        ];

        $now = now();
        $exists = DB::table('menus')->where('slug', $item['slug'])->exists();

        if ($exists) {
            DB::table('menus')
                ->where('slug', $item['slug'])
                ->update([
                    'title' => $item['title'],
                    'icon' => $item['icon'],
                    'path' => $item['path'],
                    'order' => $item['order'],
                    'translation_key' => $item['translation_key'],
                    'target' => '_blank',
                    'parent_id' => $parentId,
                    'is_active' => true,
                    'updated_at' => $now,
                ]);

            return;
        }

        DB::table('menus')->insert([
            'title' => $item['title'],
            'slug' => $item['slug'],
            'icon' => $item['icon'],
            'path' => $item['path'],
            'target' => '_blank',
            'parent_id' => $parentId,
            'order' => $item['order'],
            'is_active' => true,
            'requires_auth' => true,
            'roles' => json_encode(['admin', 'super-admin']),
            'translation_key' => $item['translation_key'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('menus')) {
            return;
        }

        DB::table('menus')->where('slug', 'sentry')->delete();
    }
};
