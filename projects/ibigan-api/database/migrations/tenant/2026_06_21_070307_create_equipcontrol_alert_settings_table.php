<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Roda no contexto do tenant (stancl/tenancy já direciona migrations
        // de database/migrations/tenant para a conexão correta). Não precisa
        // de tenant_id: o isolamento é por banco de dados físico.
        Schema::create('equipamento_alert_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('equipamento_alert_settings');
    }
};
