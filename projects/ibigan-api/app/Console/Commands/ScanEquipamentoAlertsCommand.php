<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\EquipamentoAlertScanner;
use Illuminate\Console\Command;

final class ScanEquipamentoAlertsCommand extends Command
{
    protected $signature = 'equipamento:scan-alerts';

    protected $description = 'Varre alertas do Equipamento e dispara notificações conforme preferências dos usuários';

    public function handle(EquipamentoAlertScanner $scanner): int
    {
        if (! tenancy()->initialized) {
            $this->error('Execute este comando no contexto de um tenant.');

            return self::FAILURE;
        }

        $dispatched = $scanner->scan();
        $this->info("Alertas processados: {$dispatched}");

        return self::SUCCESS;
    }
}
