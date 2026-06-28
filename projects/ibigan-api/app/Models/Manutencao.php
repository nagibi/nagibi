<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class Manutencao extends Model
{
    use HasFactory;

    protected $table = 'manutencoes';

    protected $fillable = [
        'equipamento_id',
        'origem',
        'emprestimo_id',
        'responsabilidade',
        'motivo',
        'responsavel_user_id',
        'responsavel_manutencao',
        'observacoes_tecnicas',
        'foto_path',
        'fotos_paths',
        'valor_mensal_snapshot',
        'desconto_medicao',
        'data_entrada',
        'data_saida',
        'registrado_por',
    ];

    protected function casts(): array
    {
        return [
            'valor_mensal_snapshot' => 'decimal:2',
            'desconto_medicao' => 'boolean',
            'fotos_paths' => 'array',
            'data_entrada' => 'date',
            'data_saida' => 'date',
        ];
    }

    public function equipamento(): BelongsTo
    {
        return $this->belongsTo(Equipamento::class);
    }

    public function emprestimo(): BelongsTo
    {
        return $this->belongsTo(Emprestimo::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function responsavelUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsavel_user_id');
    }

    public function getDiasEmManutencaoAttribute(): int
    {
        $fim = $this->data_saida ?? now();

        return (int) $this->data_entrada->diffInDays($fim);
    }

    public function getDiasDescontoMedicaoAttribute(): int
    {
        return $this->dias_em_manutencao;
    }

    public function scopeNoPeriodo(Builder $query, Carbon $dataInicio, Carbon $dataFim): Builder
    {
        return $query
            ->where('data_entrada', '<=', $dataFim)
            ->where(fn (Builder $q) => $q
                ->whereNull('data_saida')
                ->orWhere('data_saida', '>=', $dataInicio));
    }

    public function scopeComDesconto(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            $q->where('desconto_medicao', true)
                ->orWhere('responsabilidade', 'equipamento');
        });
    }

    public static function diasEmManutencaoSqlExpression(): string
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return "CAST((julianday(date('now')) - julianday(date(data_entrada))) AS INTEGER)";
        }

        return 'DATEDIFF(CURDATE(), data_entrada)';
    }
}
