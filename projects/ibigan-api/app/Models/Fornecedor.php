<?php

declare(strict_types=1);

namespace App\Models;

use App\Search\TenantSearchable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Fornecedor extends Model
{
    use HasFactory;
    use SoftDeletes;
    use TenantSearchable;

    protected $table = 'fornecedores';

    protected $fillable = [
        'nome',
        'cnpj',
        'telefone',
        'email',
        'contato_responsavel',
        'is_ativo',
    ];

    protected function casts(): array
    {
        return [
            'is_ativo' => 'boolean',
        ];
    }

    public function equipamentos(): HasMany
    {
        return $this->hasMany(Equipamento::class);
    }

    protected function defaultSearchableAs(): string
    {
        return 'fornecedores';
    }

    /**
     * @return array<string, mixed>
     */
    public function toSearchableArray(): array
    {
        return [
            'id' => (string) $this->id,
            'type' => 'fornecedor',
            'title' => $this->nome,
            'cnpj' => $this->cnpj,
            'subtitle' => $this->cnpj,
            'path' => "/equipamentos/fornecedores/{$this->id}",
            'avatar_url' => null,
        ];
    }

    public function shouldBeSearchable(): bool
    {
        return (bool) $this->is_ativo;
    }
}
