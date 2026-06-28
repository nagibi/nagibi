<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Equipamento;
use App\Models\Fornecedor;
use App\Models\Menu;
use App\Models\Obra;
use App\Models\TipoEquipamento;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Meilisearch\Client as MeilisearchClient;

final class SearchReindexCommand extends Command
{
    protected $signature = 'search:reindex';

    protected $description = 'Reindexa todos os models searchable no tenant atual';

    /** @var list<class-string> */
    private array $models = [
        Equipamento::class,
        TipoEquipamento::class,
        Fornecedor::class,
        Obra::class,
        Menu::class,
        User::class,
        // TODO(docs): YAGNI — descomentar quando houver conteúdo real de documentação
        // Doc::class,
    ];

    public function handle(): int
    {
        foreach ($this->models as $model) {
            $this->info("Reindexando {$model}...");
            Artisan::call('scout:flush', ['model' => $model]);
            Artisan::call('scout:import', ['model' => $model]);
            $this->line(trim(Artisan::output()));

            if ($model === User::class) {
                $this->configureMeilisearchUserIndex();
            }
        }

        return self::SUCCESS;
    }

    private function configureMeilisearchUserIndex(): void
    {
        if (config('scout.driver') !== 'meilisearch') {
            return;
        }

        $client = app(MeilisearchClient::class);
        $index = $client->index((new User)->searchableAs());

        $index->updateSearchableAttributes([
            'title',
            'email',
            'cpf',
            'id',
        ]);

        $index->updateTypoTolerance([
            'disableOnAttributes' => ['cpf', 'id'],
        ]);
    }
}
