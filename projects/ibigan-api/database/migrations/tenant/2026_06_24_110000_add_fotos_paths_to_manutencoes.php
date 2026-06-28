<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('manutencoes', function (Blueprint $table): void {
            $table->json('fotos_paths')->nullable()->after('foto_path');
        });

        DB::table('manutencoes')
            ->whereNotNull('foto_path')
            ->where('foto_path', '!=', '')
            ->orderBy('id')
            ->get(['id', 'foto_path'])
            ->each(function (object $manutencao): void {
                DB::table('manutencoes')
                    ->where('id', $manutencao->id)
                    ->update([
                        'fotos_paths' => json_encode([(string) $manutencao->foto_path]),
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('manutencoes', function (Blueprint $table): void {
            $table->dropColumn('fotos_paths');
        });
    }
};
