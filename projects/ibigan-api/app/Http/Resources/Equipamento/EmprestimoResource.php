<?php

declare(strict_types=1);

namespace App\Http\Resources\Equipamento;

use App\Models\Emprestimo;
use App\Support\StorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Emprestimo */
final class EmprestimoResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $prazoTotal = $this->prazo_dias + ($this->relationLoaded('renovacoes')
            ? (int) $this->renovacoes->sum('prazo_adicional_dias')
            : 0);
        $vencimento = $this->data_retirada->copy()->addDays($prazoTotal);

        return [
            'id' => $this->id,
            'equipamento_id' => $this->equipamento_id,
            'equipamento' => $this->whenLoaded('equipamento', function () {
                if (! $this->equipamento) {
                    return null;
                }

                return [
                    'id' => $this->equipamento->id,
                    'patrimonio' => $this->equipamento->patrimonio,
                    'tipo' => $this->equipamento->relationLoaded('tipo') && $this->equipamento->tipo ? [
                        'id' => $this->equipamento->tipo->id,
                        'nome' => $this->equipamento->tipo->nome,
                        'grupo' => $this->equipamento->tipo->relationLoaded('grupo') && $this->equipamento->tipo->grupo ? [
                            'id' => $this->equipamento->tipo->grupo->id,
                            'nome' => $this->equipamento->tipo->grupo->nome,
                        ] : null,
                    ] : null,
                    'fornecedor' => $this->equipamento->relationLoaded('fornecedor') && $this->equipamento->fornecedor ? [
                        'id' => $this->equipamento->fornecedor->id,
                        'nome' => $this->equipamento->fornecedor->nome,
                    ] : null,
                ];
            }),
            'obra_id' => $this->obra_id,
            'obra' => $this->whenLoaded('obra', fn () => [
                'id' => $this->obra->id,
                'codigo' => $this->obra->codigo,
                'nome' => $this->obra->nome,
            ]),
            'colaborador_nome' => $this->colaborador_nome,
            'colaborador_matricula' => $this->colaborador_matricula,
            'colaborador_whatsapp' => $this->colaborador_whatsapp,
            'encarregado_nome' => $this->encarregado_nome,
            'data_retirada' => $this->data_retirada->toDateString(),
            'data_devolucao' => $this->data_devolucao?->toDateString(),
            'observacao_devolucao' => $this->observacao_devolucao,
            'prazo_dias' => $this->prazo_dias,
            'prazo_total_dias' => $prazoTotal,
            'data_vencimento' => $vencimento->toDateString(),
            'is_ativo' => $this->is_ativo,
            'is_vencido' => $this->is_ativo && $vencimento->lt(now()->startOfDay()),
            'dias_em_uso' => $this->dias_em_uso,
            'observacoes' => $this->observacoes,
            'foto_cracha_path' => $this->foto_cracha_path,
            'foto_cracha_url' => StorageUrl::public($this->foto_cracha_path),
            'foto_equipamento_retirada_path' => $this->foto_equipamento_retirada_path,
            'foto_equipamento_retirada_url' => StorageUrl::public($this->foto_equipamento_retirada_path),
            'foto_assinatura_path' => $this->foto_assinatura_path,
            'foto_assinatura_url' => StorageUrl::public($this->foto_assinatura_path),
            'foto_equipamento_devolucao_path' => $this->foto_equipamento_devolucao_path,
            'foto_equipamento_devolucao_url' => StorageUrl::public($this->foto_equipamento_devolucao_path),
            'fotos_equipamento_devolucao_paths' => $this->fotos_equipamento_devolucao_paths ?? [],
            'fotos_equipamento_devolucao_urls' => collect($this->fotos_equipamento_devolucao_paths ?? [])
                ->map(fn (string $path) => StorageUrl::public($path))
                ->filter()
                ->values()
                ->all(),
            'autorizado_por' => $this->whenLoaded('autorizadoPor', fn () => $this->autorizadoPor ? [
                'id' => $this->autorizadoPor->id,
                'name' => $this->autorizadoPor->name,
            ] : null),
            'renovacoes' => $this->whenLoaded('renovacoes', fn () => $this->renovacoes->map(fn ($renovacao) => [
                'id' => $renovacao->id,
                'data_renovacao' => $renovacao->data_renovacao->toDateString(),
                'prazo_adicional_dias' => $renovacao->prazo_adicional_dias,
                'observacao' => $renovacao->observacao,
                'autorizado_por' => $renovacao->relationLoaded('autorizadoPor') && $renovacao->autorizadoPor ? [
                    'id' => $renovacao->autorizadoPor->id,
                    'name' => $renovacao->autorizadoPor->name,
                ] : null,
            ])->values()->all()),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
