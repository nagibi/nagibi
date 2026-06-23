<?php

declare(strict_types=1);

namespace App\Models;

use App\Search\TenantSearchable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Obra extends Model
{
    use HasFactory;
    use SoftDeletes;
    use TenantSearchable;

    protected $fillable = [
        'codigo',
        'nome',
        'endereco',
        'responsavel',
        'responsavel_user_id',
        'is_ativa',
    ];

    protected function casts(): array
    {
        return [
            'is_ativa' => 'boolean',
        ];
    }

    public function equipamentos(): HasMany
    {
        return $this->hasMany(Equipamento::class);
    }

    public function responsavelUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsavel_user_id');
    }

    public function emprestimos(): HasMany
    {
        return $this->hasMany(Emprestimo::class);
    }

    protected function defaultSearchableAs(): string
    {
        return 'obras';
    }

    /**
     * @return array<string, mixed>
     */
    public function toSearchableArray(): array
    {
        return [
            'id' => (string) $this->id,
            'type' => 'obra',
            'title' => $this->codigo,
            'subtitle' => $this->nome,
            'path' => "/equipamentos/obras/{$this->id}",
            'avatar_url' => null,
        ];
    }

    public function shouldBeSearchable(): bool
    {
        return (bool) $this->is_ativa;
    }
}
