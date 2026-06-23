<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\TenantStoragePermissions;
use Illuminate\Console\Command;

final class FixTenantStoragePermissionsCommand extends Command
{
    protected $signature = 'storage:fix-tenant-permissions';

    protected $description = 'Corrige permissões dos diretórios de storage dos tenants para leitura via Nginx';

    public function handle(): int
    {
        $roots = TenantStoragePermissions::tenantStorageRoots();

        if ($roots === []) {
            $this->info('Nenhum diretório tenant* encontrado em storage/.');

            return self::SUCCESS;
        }

        foreach ($roots as $root) {
            TenantStoragePermissions::ensureReadable($root);
            $this->line(basename($root));
        }

        $this->info('Permissões ajustadas em '.count($roots).' tenant(s).');

        return self::SUCCESS;
    }
}
