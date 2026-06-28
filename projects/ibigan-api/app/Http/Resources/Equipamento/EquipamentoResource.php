<?php

declare(strict_types=1);

namespace App\Http\Resources\Equipamento;

use App\Models\Equipamento;
use App\Support\StorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Equipamento */
final class EquipamentoResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'patrimonio' => $this->patrimonio,
            'tipo_id' => $this->tipo_id,
            'tipo' => $this->whenLoaded('tipo', fn () => [
                'id' => $this->tipo->id,
                'nome' => $this->tipo->nome,
                'grupo' => $this->tipo->relationLoaded('grupo') && $this->tipo->grupo ? [
                    'id' => $this->tipo->grupo->id,
                    'nome' => $this->tipo->grupo->nome,
                ] : null,
            ]),
            'fornecedor_id' => $this->fornecedor_id,
            'fornecedor' => $this->whenLoaded('fornecedor', fn () => [
                'id' => $this->fornecedor->id,
                'nome' => $this->fornecedor->nome,
            ]),
            'obra_id' => $this->obra_id,
            'obra' => $this->whenLoaded('obra', fn () => [
                'id' => $this->obra->id,
                'codigo' => $this->obra->codigo,
                'nome' => $this->obra->nome,
            ]),
            'valor_mensal' => $this->valor_mensal,
            'valor_diario' => $this->valor_diario,
            'foto_path' => $this->foto_path,
            'foto_url' => StorageUrl::equipamentoFoto($this->foto_path, $this->patrimonio),
            'fotos' => $this->whenLoaded('fotos', function () {
                $sorted = $this->fotos->sortBy([
                    ['ordem', 'asc'],
                    ['id', 'asc'],
                ])->values();
                $principalId = $sorted->first()?->id;

                return $sorted->map(fn ($foto) => [
                    'id' => $foto->id,
                    'path' => $foto->path,
                    'url' => StorageUrl::equipamentoFoto($foto->path, $this->patrimonio),
                    'ordem' => $foto->ordem,
                    'is_principal' => $foto->id === $principalId,
                ])->all();
            }),
            'is_critico' => $this->is_critico,
            'is_active' => $this->is_active,
            'data_entrada' => $this->data_entrada->toDateString(),
            'status' => $this->status,
            'status_label' => $this->status_label,
            'tempo_em_estoque' => $this->when(
                $this->status === 'em_estoque',
                fn () => $this->tempo_em_estoque,
            ),
            'emprestimo_ativo' => $this->whenLoaded('emprestimoAtivo', function () {
                if (! $this->emprestimoAtivo) {
                    return null;
                }

                return [
                    'id' => $this->emprestimoAtivo->id,
                    'obra_id' => $this->emprestimoAtivo->obra_id,
                    'obra' => $this->emprestimoAtivo->relationLoaded('obra') && $this->emprestimoAtivo->obra
                        ? [
                            'id' => $this->emprestimoAtivo->obra->id,
                            'codigo' => $this->emprestimoAtivo->obra->codigo,
                            'nome' => $this->emprestimoAtivo->obra->nome,
                        ]
                        : null,
                    'colaborador_nome' => $this->emprestimoAtivo->colaborador_nome,
                    'colaborador_matricula' => $this->emprestimoAtivo->colaborador_matricula,
                    'data_retirada' => $this->emprestimoAtivo->data_retirada->toDateString(),
                    'prazo_dias' => $this->emprestimoAtivo->prazo_dias,
                    'renovacoes' => $this->emprestimoAtivo->relationLoaded('renovacoes')
                        ? $this->emprestimoAtivo->renovacoes->map(fn ($renovacao) => [
                            'id' => $renovacao->id,
                            'data_renovacao' => $renovacao->data_renovacao->toDateString(),
                            'prazo_adicional_dias' => $renovacao->prazo_adicional_dias,
                        ])->values()->all()
                        : [],
                ];
            }),
            'manutencao_ativa' => $this->whenLoaded('manutencaoAtiva', function () {
                if (! $this->manutencaoAtiva) {
                    return null;
                }

                return [
                    'id' => $this->manutencaoAtiva->id,
                    'motivo' => $this->manutencaoAtiva->motivo,
                    'responsabilidade' => $this->manutencaoAtiva->responsabilidade,
                    'responsavel_user_id' => $this->manutencaoAtiva->responsavel_user_id,
                    'responsavel_manutencao' => $this->manutencaoAtiva->responsavel_manutencao
                        ?? $this->manutencaoAtiva->responsavelUser?->name,
                    'responsavel_user' => $this->manutencaoAtiva->relationLoaded('responsavelUser')
                        && $this->manutencaoAtiva->responsavelUser
                        ? [
                            'id' => $this->manutencaoAtiva->responsavelUser->id,
                            'name' => $this->manutencaoAtiva->responsavelUser->name,
                            'email' => $this->manutencaoAtiva->responsavelUser->email,
                        ]
                        : null,
                    'data_entrada' => $this->manutencaoAtiva->data_entrada->toDateString(),
                    'fotos_paths' => $this->manutencaoAtiva->fotos_paths ?? [],
                    'fotos_urls' => collect($this->manutencaoAtiva->fotos_paths ?? [])
                        ->filter(fn (mixed $path): bool => is_string($path) && $path !== '')
                        ->map(fn (string $path): ?string => StorageUrl::public($path))
                        ->filter()
                        ->values()
                        ->all(),
                ];
            }),
            'baixa' => $this->whenLoaded('baixa', function () {
                if (! $this->baixa) {
                    return null;
                }

                return [
                    'id' => $this->baixa->id,
                    'tipo' => $this->baixa->tipo,
                    'data_baixa' => $this->baixa->data_baixa->toDateString(),
                ];
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ] : null),
            'updated_by' => $this->whenLoaded('updater', fn () => $this->updater ? [
                'id' => $this->updater->id,
                'name' => $this->updater->name,
            ] : null),
        ];
    }
}
