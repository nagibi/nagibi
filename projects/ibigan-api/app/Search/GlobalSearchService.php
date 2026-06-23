<?php

declare(strict_types=1);

namespace App\Search;

use App\Models\Equipamento;
use App\Models\Fornecedor;
use App\Models\Menu;
use App\Models\Obra;
use App\Models\TipoEquipamento;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Meilisearch\Exceptions\ApiException;

final class GlobalSearchService
{
    /** @var array<class-string<Model>, string> */
    private const SOURCES = [
        Equipamento::class => 'equipamentos',
        TipoEquipamento::class => 'tipos',
        Fornecedor::class => 'fornecedores',
        Obra::class => 'obras',
        Menu::class => 'settings',
        User::class => 'users',
        // TODO(docs): YAGNI — descomentar quando houver conteúdo real de documentação
        // Doc::class => 'docs',
    ];

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    public function search(string $term, ?User $actor, int $perGroup = 5): array
    {
        $term = trim($term);
        if ($term === '') {
            return [];
        }

        $groups = [];

        foreach (self::SOURCES as $model => $category) {
            try {
                $hits = $model::search($term)->take($perGroup * 3)->get();
            } catch (ApiException $exception) {
                if ($this->isMissingSearchIndex($exception)) {
                    continue;
                }

                throw $exception;
            }

            $visible = $hits
                ->filter(fn (Model $item) => $this->canView($actor, $item))
                ->take($perGroup)
                ->map(fn (Model $item) => $this->present($item))
                ->values()
                ->all();

            if ($visible !== []) {
                $groups[$category] = $visible;
            }
        }

        return $groups;
    }

    private function isMissingSearchIndex(ApiException $exception): bool
    {
        return $exception->errorCode === 'index_not_found'
            || str_contains($exception->getMessage(), 'not found');
    }

    private function canView(?User $actor, Model $item): bool
    {
        if ($actor === null) {
            return false;
        }

        $data = $item->toSearchableArray();

        if (($data['type'] ?? '') === 'menu') {
            $roles = $data['roles'] ?? [];
            if ($roles === []) {
                return true;
            }

            return $actor->hasAnyRole($roles);
        }

        $required = $data['searchable_by'] ?? null;
        if ($required === null) {
            return true;
        }

        return $actor->can($required);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Model $item): array
    {
        $data = $item->toSearchableArray();

        return [
            'id' => $data['id'],
            'type' => $data['type'],
            'title' => $data['title'],
            'subtitle' => $data['subtitle'] ?? $data['email'] ?? $data['excerpt'] ?? $data['path'] ?? null,
            'path' => $data['path'] ?? null,
            'avatar_url' => $data['avatar_url'] ?? null,
        ];
    }
}
