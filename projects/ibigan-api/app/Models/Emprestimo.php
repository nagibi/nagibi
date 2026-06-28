<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class Emprestimo extends Model
{
    use HasFactory;

    protected $table = 'emprestimos';

    protected $fillable = [
        'equipamento_id',
        'obra_id',
        'colaborador_nome',
        'colaborador_matricula',
        'colaborador_whatsapp',
        'data_retirada',
        'data_devolucao',
        'observacao_devolucao',
        'prazo_dias',
        'foto_cracha_path',
        'foto_equipamento_retirada_path',
        'foto_assinatura_path',
        'foto_equipamento_devolucao_path',
        'fotos_equipamento_devolucao_paths',
        'autorizado_por',
        'observacoes',
    ];

    protected function casts(): array
    {
        return [
            'data_retirada' => 'date',
            'data_devolucao' => 'date',
            'fotos_equipamento_devolucao_paths' => 'array',
            'prazo_dias' => 'integer',
        ];
    }

    public function equipamento(): BelongsTo
    {
        return $this->belongsTo(Equipamento::class);
    }

    public function obra(): BelongsTo
    {
        return $this->belongsTo(Obra::class);
    }

    public function autorizadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autorizado_por');
    }

    public function renovacoes(): HasMany
    {
        return $this->hasMany(EmprestimoRenovacao::class);
    }

    public function getDiasEmUsoAttribute(): int
    {
        $fim = $this->data_devolucao ?? now();

        return (int) $this->data_retirada->diffInDays($fim);
    }

    public function getIsAtivoAttribute(): bool
    {
        return $this->data_devolucao === null;
    }

    public function getPrazoTotalDiasAttribute(): int
    {
        $adicional = $this->relationLoaded('renovacoes')
            ? (int) $this->renovacoes->sum('prazo_adicional_dias')
            : (int) $this->renovacoes()->sum('prazo_adicional_dias');

        return $this->prazo_dias + $adicional;
    }

    public function getDataVencimentoAttribute(): Carbon
    {
        return $this->data_retirada->copy()->addDays($this->prazo_total_dias);
    }

    public function getDiasAteVencimentoAttribute(): int
    {
        return (int) now()->startOfDay()->diffInDays($this->data_vencimento->startOfDay(), false);
    }

    public function getIsVencidoAttribute(): bool
    {
        return $this->is_ativo && $this->data_vencimento->lt(now()->startOfDay());
    }

    public function getIsProximoVencimentoAttribute(): bool
    {
        if (! $this->is_ativo || $this->is_vencido) {
            return false;
        }

        $dias = $this->dias_ate_vencimento;

        return $dias >= 0 && $dias <= 3;
    }

    public function scopeVencidos(Builder $query): Builder
    {
        return $query
            ->whereNull('data_devolucao')
            ->whereRaw('DATE_ADD(data_retirada, INTERVAL prazo_dias DAY) < ?', [now()->toDateString()]);
    }

    public function scopeProximosVencimento(Builder $query, int $dias = 3): Builder
    {
        return $query
            ->whereNull('data_devolucao')
            ->whereRaw('DATE_ADD(data_retirada, INTERVAL prazo_dias DAY) BETWEEN ? AND ?', [
                now()->toDateString(),
                now()->addDays($dias)->toDateString(),
            ]);
    }

    public static function diasEmUsoSqlExpression(): string
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return "CAST((julianday(date('now')) - julianday(date(data_retirada))) AS INTEGER)";
        }

        return 'DATEDIFF(CURDATE(), data_retirada)';
    }
}
