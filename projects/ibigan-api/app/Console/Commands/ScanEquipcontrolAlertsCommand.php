<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\EquipcontrolAlertScanner;
use Illuminate\Console\Command;

final class ScanEquipcontrolAlertsCommand extends Command
{
    protected $signature = 'equipcontrol:scan-alerts';

    protected $description = 'Varre alertas do EquipControl e dispara notificações conforme preferências dos usuários';

    public function handle(EquipcontrolAlertScanner $scanner): int
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
