<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Equipamento extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'patrimonio',
        'tipo_id',
        'fornecedor_id',
        'obra_id',
        'valor_mensal',
        'foto_path',
        'is_critico',
        'is_active',
        'data_entrada',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'data_entrada' => 'date',
            'valor_mensal' => 'decimal:2',
            'is_critico' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function tipo(): BelongsTo
    {
        return $this->belongsTo(TipoEquipamento::class, 'tipo_id');
    }

    public function fornecedor(): BelongsTo
    {
        return $this->belongsTo(Fornecedor::class);
    }

    public function obra(): BelongsTo
    {
        return $this->belongsTo(Obra::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function emprestimos(): HasMany
    {
        return $this->hasMany(Emprestimo::class);
    }

    public function manutencoes(): HasMany
    {
        return $this->hasMany(Manutencao::class);
    }

    public function baixa(): HasOne
    {
        return $this->hasOne(Baixa::class);
    }

    public function historico(): HasMany
    {
        return $this->hasMany(HistoricoEquipamento::class)->orderByDesc('created_at');
    }

    public function fotos(): HasMany
    {
        return $this->hasMany(EquipamentoFoto::class)->orderBy('ordem')->orderBy('id');
    }

    public function emprestimoAtivo(): HasOne
    {
        return $this->hasOne(Emprestimo::class)
            ->whereNull('data_devolucao')
            ->latest();
    }

    public function manutencaoAtiva(): HasOne
    {
        return $this->hasOne(Manutencao::class)
            ->whereNull('data_saida')
            ->latest();
    }

    public function getStatusAttribute(): string
    {
        if ($this->baixa) {
            return $this->baixa->tipo === 'perda' ? 'perdido' : 'baixado';
        }

        if ($this->relationLoaded('manutencaoAtiva') && $this->manutencaoAtiva) {
            return 'em_manutencao';
        }

        if ($this->relationLoaded('emprestimoAtivo') && $this->emprestimoAtivo) {
            return 'em_utilizacao';
        }

        return 'em_estoque';
    }

    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'em_estoque' => 'Em Estoque',
            'em_utilizacao' => 'Em Utilização',
            'em_manutencao' => 'Em Manutenção',
            'baixado' => 'Baixado',
            'perdido' => 'Perdido',
            default => 'Desconhecido',
        };
    }

    public function getValorDiarioAttribute(): float
    {
        return round((float) $this->valor_mensal / 30, 2);
    }

    public function getTempoEmEstoqueAttribute(): int
    {
        if ($this->status !== 'em_estoque') {
            return 0;
        }

        $ultimoEvento = $this->historico()
            ->where('status_resultante', 'em_estoque')
            ->latest()
            ->first();

        $inicio = $ultimoEvento
            ? $ultimoEvento->created_at->copy()->startOfDay()
            : $this->data_entrada->copy()->startOfDay();

        return (int) $inicio->diffInDays(now()->startOfDay());
    }

    public function scopeEmEstoque(Builder $query): Builder
    {
        return $query
            ->whereDoesntHave('baixa')
            ->whereDoesntHave('emprestimos', fn (Builder $q) => $q->whereNull('data_devolucao'))
            ->whereDoesntHave('manutencoes', fn (Builder $q) => $q->whereNull('data_saida'));
    }

    public function scopeEmUtilizacao(Builder $query): Builder
    {
        return $query->whereHas('emprestimos', fn (Builder $q) => $q->whereNull('data_devolucao'));
    }

    public function scopeEmManutencao(Builder $query): Builder
    {
        return $query->whereHas('manutencoes', fn (Builder $q) => $q->whereNull('data_saida'));
    }

    public function scopeBaixados(Builder $query): Builder
    {
        return $query->whereHas('baixa', fn (Builder $q) => $q->where('tipo', 'devolucao'));
    }

    public function scopePerdidos(Builder $query): Builder
    {
        return $query->whereHas('baixa', fn (Builder $q) => $q->where('tipo', 'perda'));
    }

    public function scopeBaixadosTodos(Builder $query): Builder
    {
        return $query->whereHas('baixa');
    }

    public function scopeParadoHaMaisDe(Builder $query, int $dias): Builder
    {
        return $query->comDiasParados(min: $dias);
    }

    public function scopeComDiasParados(Builder $query, ?int $min = null, ?int $max = null): Builder
    {
        $diasEmEstoque = self::diasEmEstoqueSqlExpression();

        $query = $query->emEstoque();

        if ($min !== null) {
            $query->whereRaw("({$diasEmEstoque}) >= ?", [$min]);
        }

        if ($max !== null) {
            $query->whereRaw("({$diasEmEstoque}) <= ?", [$max]);
        }

        return $query;
    }

    public function scopeComSituacaoEstoque(Builder $query, string $situacao): Builder
    {
        $diasEmEstoque = self::diasEmEstoqueSqlExpression();

        return match ($situacao) {
            'disponivel' => $query->whereRaw("{$diasEmEstoque} = 0"),
            'parado' => $query->whereRaw("{$diasEmEstoque} BETWEEN 1 AND 29"),
            'parado_30' => $query->whereRaw("{$diasEmEstoque} >= 30"),
            default => $query,
        };
    }

    public function scopeApplyGridSort(Builder $query, ?string $sort, string $direction = 'asc'): Builder
    {
        $direction = $direction === 'desc' ? 'desc' : 'asc';

        return match ($sort) {
            'id', 'patrimonio', 'valor_mensal', 'created_at', 'updated_at', 'data_entrada', 'is_critico', 'is_active' => $query->orderBy(
                $sort,
                $direction,
            ),
            'tipo' => $query->orderBy(
                TipoEquipamento::query()
                    ->select('nome')
                    ->whereColumn('tipos_equipamento.id', 'equipamentos.tipo_id')
                    ->limit(1),
                $direction,
            ),
            'grupo' => $query->orderBy(
                GrupoEquipamento::query()
                    ->select('grupos_equipamento.nome')
                    ->join('tipos_equipamento', 'tipos_equipamento.grupo_id', '=', 'grupos_equipamento.id')
                    ->whereColumn('tipos_equipamento.id', 'equipamentos.tipo_id')
                    ->limit(1),
                $direction,
            ),
            'obra' => $query->orderBy(
                Obra::query()
                    ->select('codigo')
                    ->whereColumn('obras.id', 'equipamentos.obra_id')
                    ->limit(1),
                $direction,
            ),
            'fornecedor' => $query->orderBy(
                Fornecedor::query()
                    ->select('nome')
                    ->whereColumn('fornecedores.id', 'equipamentos.fornecedor_id')
                    ->limit(1),
                $direction,
            ),
            'tempo_em_estoque' => $query->orderByRaw(self::diasEmEstoqueSqlExpression().' '.$direction),
            default => $query->orderByDesc('created_at'),
        };
    }

    private static function diasEmEstoqueSqlExpression(): string
    {
        $historicoSubquery = '(
            SELECT h.created_at
            FROM historico_equipamentos h
            WHERE h.equipamento_id = equipamentos.id
              AND h.status_resultante = \'em_estoque\'
            ORDER BY h.created_at DESC
            LIMIT 1
        )';

        $hoje = now()->toDateString();

        if (DB::connection()->getDriverName() === 'sqlite') {
            return "COALESCE(
                CAST((julianday('{$hoje}') - julianday(date({$historicoSubquery}))) AS INTEGER),
                CAST((julianday('{$hoje}') - julianday(date(equipamentos.data_entrada))) AS INTEGER)
            )";
        }

        return "COALESCE(
            DATEDIFF(
                '{$hoje}',
                DATE({$historicoSubquery})
            ),
            DATEDIFF('{$hoje}', equipamentos.data_entrada)
        )";
    }
}
