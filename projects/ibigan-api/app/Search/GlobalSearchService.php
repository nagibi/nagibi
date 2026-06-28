<?php

declare(strict_types=1);

namespace App\Search;

use App\Models\Equipamento;
use App\Models\Fornecedor;
use App\Models\Menu;
use App\Models\Obra;
use App\Models\TipoEquipamento;
use App\Models\User;
use App\Support\BrazilianDocuments;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
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
        $term = $this->normalizeSearchTerm($term);
        if ($term === '') {
            return [];
        }

        $groups = [];

        foreach (self::SOURCES as $model => $category) {
            $hits = match ($model) {
                User::class => $this->searchUsers($term, $perGroup * 3),
                Fornecedor::class => $this->searchFornecedores($term, $perGroup * 3),
                default => $this->searchWithScout($model, $term, $perGroup * 3),
            };

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

    /**
     * @param  class-string<Model>  $model
     * @return EloquentCollection<int, Model>
     */
    private function searchWithScout(string $model, string $term, int $limit): EloquentCollection
    {
        try {
            return $model::search($term)->take($limit)->get();
        } catch (ApiException $exception) {
            if ($this->isMissingSearchIndex($exception)) {
                return $model::query()->whereRaw('1 = 0')->get();
            }

            throw $exception;
        }
    }

    /**
     * @return EloquentCollection<int, User>
     */
    private function searchUsers(string $term, int $limit): EloquentCollection
    {
        if ($this->isNumericDocumentTerm($term)) {
            return User::query()
                ->where('cpf', 'like', "%{$term}%")
                ->orderBy('name')
                ->limit($limit)
                ->get();
        }

        return $this->searchWithScout(User::class, $term, $limit);
    }

    /**
     * @return EloquentCollection<int, Fornecedor>
     */
    private function searchFornecedores(string $term, int $limit): EloquentCollection
    {
        if ($this->isNumericDocumentTerm($term)) {
            $cnpjDigits = BrazilianDocuments::sqlDigitsOnlyColumn('cnpj');

            return Fornecedor::query()
                ->where('is_ativo', true)
                ->where(function ($query) use ($term, $cnpjDigits): void {
                    $query
                        ->where('cnpj', 'like', "%{$term}%")
                        ->orWhereRaw("{$cnpjDigits} LIKE ?", ["%{$term}%"]);
                })
                ->orderBy('nome')
                ->limit($limit)
                ->get();
        }

        return $this->searchWithScout(Fornecedor::class, $term, $limit);
    }

    private function isNumericDocumentTerm(string $term): bool
    {
        return preg_match('/^\d{3,}$/', $term) === 1;
    }

    private function isMissingSearchIndex(ApiException $exception): bool
    {
        return $exception->errorCode === 'index_not_found'
            || str_contains($exception->getMessage(), 'not found');
    }

    private function normalizeSearchTerm(string $term): string
    {
        $trimmed = trim($term);
        if ($trimmed === '') {
            return '';
        }

        if (! preg_match('/^[\d.\-\/\s]+$/', $trimmed)) {
            return $trimmed;
        }

        $digitsOnly = BrazilianDocuments::digitsOnly($trimmed);

        return ($digitsOnly !== null && strlen($digitsOnly) >= 3) ? $digitsOnly : $trimmed;
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
