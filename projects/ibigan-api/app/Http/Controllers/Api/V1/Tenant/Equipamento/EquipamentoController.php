<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant\Equipamento;

use App\Http\Controllers\Controller;
use App\Http\Requests\Equipamento\StoreEquipamentoRequest;
use App\Http\Requests\ToggleActiveRequest;
use App\Http\Resources\Equipamento\EquipamentoResource;
use App\Actions\ToggleActiveAction;
use App\Models\Equipamento;
use App\Models\EquipamentoFoto;
use App\Models\HistoricoEquipamento;
use App\Models\Emprestimo;
use App\Models\Manutencao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

final class EquipamentoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Equipamento::query()->with([
            'tipo.grupo',
            'fornecedor',
            'obra',
            'fotos',
            'creator',
            'updater',
            'emprestimoAtivo.renovacoes',
            'manutencaoAtiva.responsavelUser',
            'baixa',
        ]);

        match ($request->string('status')->toString()) {
            'em_estoque' => $query->emEstoque(),
            'em_utilizacao' => $query->emUtilizacao(),
            'em_manutencao' => $query->emManutencao(),
            'baixados' => $query->baixados(),
            'perdidos' => $query->perdidos(),
            'baixados_todos' => $query->baixadosTodos(),
            default => null,
        };

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        } else {
            $query->where('is_active', true);
        }

        if ($request->filled('obra_id')) {
            $query->where('obra_id', $request->integer('obra_id'));
        }

        if ($request->filled('fornecedor_id')) {
            $query->where('fornecedor_id', $request->integer('fornecedor_id'));
        }

        if ($request->filled('tipo_id')) {
            $query->where('tipo_id', $request->integer('tipo_id'));
        }

        if ($request->filled('grupo_id')) {
            $query->whereHas('tipo', fn($q) => $q->where('grupo_id', $request->integer('grupo_id')));
        }

        if ($request->filled('id')) {
            $query->where('id', $request->integer('id'));
        }

        if ($request->filled('patrimonio')) {
            $patrimonio = $request->string('patrimonio')->toString();
            $query->where('patrimonio', 'like', "%{$patrimonio}%");
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($q) use ($search) {
                $q->where('patrimonio', 'like', "%{$search}%")
                    ->orWhereHas('tipo', function ($t) use ($search) {
                        $t->where('nome', 'like', "%{$search}%")
                            ->orWhereHas('grupo', fn($g) => $g->where('nome', 'like', "%{$search}%"));
                    })
                    ->orWhereHas('fornecedor', fn($f) => $f->where('nome', 'like', "%{$search}%"))
                    ->orWhereHas('obra', function ($o) use ($search) {
                        $o->where('codigo', 'like', "%{$search}%")
                            ->orWhere('nome', 'like', "%{$search}%");
                    })
                    ->orWhereHas('emprestimoAtivo', function ($e) use ($search) {
                        $e->where('colaborador_nome', 'like', "%{$search}%")
                            ->orWhere('colaborador_matricula', 'like', "%{$search}%")
                            ->orWhere('encarregado_nome', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('parado_dias_min') || $request->filled('parado_dias_max')) {
            $query->comDiasParados(
                $request->filled('parado_dias_min') ? $request->integer('parado_dias_min') : null,
                $request->filled('parado_dias_max') ? $request->integer('parado_dias_max') : null,
            );
        } elseif ($request->filled('parado_dias')) {
            $query->paradoHaMaisDe($request->integer('parado_dias'));
        }

        if ($request->filled('valor_mensal_min')) {
            $query->where('valor_mensal', '>=', $request->input('valor_mensal_min'));
        }

        if ($request->filled('valor_mensal_max')) {
            $query->where('valor_mensal', '<=', $request->input('valor_mensal_max'));
        }

        if ($request->filled('situacao')) {
            $query->comSituacaoEstoque($request->string('situacao')->toString());
        }

        if ($request->boolean('is_critico')) {
            $query->where('is_critico', true);
        } elseif ($request->has('is_critico') && ! $request->boolean('is_critico')) {
            $query->where('is_critico', false);
        }

        if ($request->filled('cadastrado_dias')) {
            $query->where('created_at', '>=', now()->subDays($request->integer('cadastrado_dias')));
        }

        if ($request->filled('created_at_from')) {
            $query->whereDate('created_at', '>=', $request->string('created_at_from')->toString());
        }

        if ($request->filled('created_at_to')) {
            $query->whereDate('created_at', '<=', $request->string('created_at_to')->toString());
        }

        if ($request->filled('data_entrada_from')) {
            $query->whereDate('data_entrada', '>=', $request->string('data_entrada_from')->toString());
        }

        if ($request->filled('data_entrada_to')) {
            $query->whereDate('data_entrada', '<=', $request->string('data_entrada_to')->toString());
        }

        if ($request->filled('updated_at_from')) {
            $query->whereDate('updated_at', '>=', $request->string('updated_at_from')->toString());
        }

        if ($request->filled('updated_at_to')) {
            $query->whereDate('updated_at', '<=', $request->string('updated_at_to')->toString());
        }

        if ($request->filled('created_by')) {
            $createdBy = $request->string('created_by')->toString();
            $query->whereHas(
                'creator',
                fn($creatorQuery) => $creatorQuery->where('name', 'like', "%{$createdBy}%"),
            );
        }

        if ($request->filled('updated_by')) {
            $updatedBy = $request->string('updated_by')->toString();
            $query->whereHas(
                'updater',
                fn($updaterQuery) => $updaterQuery->where('name', 'like', "%{$updatedBy}%"),
            );
        }

        if ($request->filled('emprestimo_alerta')) {
            match ($request->string('emprestimo_alerta')->toString()) {
                'vencidos' => $query->whereHas('emprestimoAtivo', fn($q) => $q->vencidos()),
                'proximos' => $query->whereHas('emprestimoAtivo', fn($q) => $q->proximosVencimento()),
                'normais' => $query->whereHas('emprestimoAtivo', function ($q) {
                    $q->whereNull('data_devolucao')
                        ->whereRaw('DATE_ADD(data_retirada, INTERVAL prazo_dias DAY) > ?', [
                            now()->addDays(3)->toDateString(),
                        ]);
                }),
                default => null,
            };
        }

        if ($request->filled('manutencao_filtro')) {
            match ($request->string('manutencao_filtro')->toString()) {
                'hoje' => $query->whereHas('manutencaoAtiva', fn($q) => $q->whereDate('data_entrada', today())),
                'atrasados' => $query->whereHas('manutencaoAtiva', fn($q) => $q->where(
                    'data_entrada',
                    '<',
                    now()->subDays(7)->toDateString(),
                )),
                'criticos' => $query->where('is_critico', true),
                default => null,
            };
        }

        if ($request->filled('colaborador')) {
            $colaborador = $request->string('colaborador')->toString();
            $query->whereHas('emprestimoAtivo', function ($q) use ($colaborador) {
                $q->where('colaborador_nome', 'like', "%{$colaborador}%")
                    ->orWhere('colaborador_matricula', 'like', "%{$colaborador}%");
            });
        }

        if ($request->filled('encarregado')) {
            $encarregado = $request->string('encarregado')->toString();
            $query->whereHas(
                'emprestimoAtivo',
                fn($q) => $q->where('encarregado_nome', 'like', "%{$encarregado}%"),
            );
        }

        if ($request->filled('data_retirada_from')) {
            $query->whereHas(
                'emprestimoAtivo',
                fn($q) => $q->whereDate('data_retirada', '>=', $request->string('data_retirada_from')->toString()),
            );
        }

        if ($request->filled('data_retirada_to')) {
            $query->whereHas(
                'emprestimoAtivo',
                fn($q) => $q->whereDate('data_retirada', '<=', $request->string('data_retirada_to')->toString()),
            );
        }

        if ($request->filled('dias_em_uso_min') || $request->filled('dias_em_uso_max')) {
            $diasEmUsoSql = Emprestimo::diasEmUsoSqlExpression();
            $query->whereHas('emprestimoAtivo', function ($q) use ($request, $diasEmUsoSql) {
                if ($request->filled('dias_em_uso_min')) {
                    $q->whereRaw("({$diasEmUsoSql}) >= ?", [$request->integer('dias_em_uso_min')]);
                }

                if ($request->filled('dias_em_uso_max')) {
                    $q->whereRaw("({$diasEmUsoSql}) <= ?", [$request->integer('dias_em_uso_max')]);
                }
            });
        }

        if ($request->filled('motivo')) {
            $motivo = $request->string('motivo')->toString();
            $query->whereHas(
                'manutencaoAtiva',
                fn($q) => $q->where('motivo', 'like', "%{$motivo}%"),
            );
        }

        if ($request->filled('responsabilidade')) {
            $query->whereHas(
                'manutencaoAtiva',
                fn($q) => $q->where('responsabilidade', $request->string('responsabilidade')->toString()),
            );
        }

        if ($request->filled('manutencao_data_entrada_from')) {
            $query->whereHas(
                'manutencaoAtiva',
                fn($q) => $q->whereDate('data_entrada', '>=', $request->string('manutencao_data_entrada_from')->toString()),
            );
        }

        if ($request->filled('manutencao_data_entrada_to')) {
            $query->whereHas(
                'manutencaoAtiva',
                fn($q) => $q->whereDate('data_entrada', '<=', $request->string('manutencao_data_entrada_to')->toString()),
            );
        }

        if ($request->filled('dias_em_manutencao_min') || $request->filled('dias_em_manutencao_max')) {
            $diasEmManutencaoSql = Manutencao::diasEmManutencaoSqlExpression();
            $query->whereHas('manutencaoAtiva', function ($q) use ($request, $diasEmManutencaoSql) {
                if ($request->filled('dias_em_manutencao_min')) {
                    $q->whereRaw("({$diasEmManutencaoSql}) >= ?", [$request->integer('dias_em_manutencao_min')]);
                }

                if ($request->filled('dias_em_manutencao_max')) {
                    $q->whereRaw("({$diasEmManutencaoSql}) <= ?", [$request->integer('dias_em_manutencao_max')]);
                }
            });
        }

        $equipamentos = $query
            ->applyGridSort(
                $request->filled('sort') ? $request->string('sort')->toString() : null,
                $request->string('direction', 'asc')->toString(),
            )
            ->paginate($request->integer('per_page', 20));

        return EquipamentoResource::collection($equipamentos);
    }

    public function store(StoreEquipamentoRequest $request): EquipamentoResource
    {
        $data = $request->validated();
        unset(
            $data['foto'],
            $data['fotos'],
            $data['fotos_remover'],
            $data['foto_principal_id'],
            $data['foto_principal_novo_indice'],
        );

        $actorId = $request->user()->id;
        $uploadedFotos = $this->collectUploadedFotos($request);

        $equipamento = DB::transaction(function () use ($data, $actorId, $uploadedFotos, $request) {
            $equipamento = Equipamento::query()->create([
                ...$data,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $createdFotoIds = $this->storeEquipamentoFotos($equipamento, $uploadedFotos);
            $this->applyFotoPrincipal($equipamento, $request, $createdFotoIds);

            HistoricoEquipamento::query()->create([
                'equipamento_id' => $equipamento->id,
                'evento' => 'cadastrado',
                'dados' => [
                    'patrimonio' => $equipamento->patrimonio,
                    'fornecedor_id' => $equipamento->fornecedor_id,
                    'obra_id' => $equipamento->obra_id,
                    'data_entrada' => $equipamento->data_entrada->toDateString(),
                ],
                'status_resultante' => 'em_estoque',
                'registrado_por' => $actorId,
            ]);

            return $equipamento;
        });

        $equipamento->load(['tipo.grupo', 'fornecedor', 'obra', 'fotos', 'creator', 'updater']);

        return new EquipamentoResource($equipamento);
    }

    public function show(Equipamento $equipamento): EquipamentoResource
    {
        $equipamento->load([
            'tipo.grupo',
            'fornecedor',
            'obra',
            'fotos',
            'creator',
            'updater',
            'emprestimoAtivo.renovacoes',
            'manutencaoAtiva.responsavelUser',
            'baixa',
        ]);

        return new EquipamentoResource($equipamento);
    }

    public function update(StoreEquipamentoRequest $request, Equipamento $equipamento): EquipamentoResource|JsonResponse
    {
        $data = $request->validated();
        unset(
            $data['foto'],
            $data['fotos'],
            $data['fotos_remover'],
            $data['foto_principal_id'],
            $data['foto_principal_novo_indice'],
        );

        if (isset($data['patrimonio']) && $data['patrimonio'] !== $equipamento->patrimonio) {
            $temRegistros = $equipamento->emprestimos()->exists()
                || $equipamento->manutencoes()->exists();

            if ($temRegistros) {
                return response()->json([
                    'message' => 'Não é possível alterar o patrimônio de um equipamento com histórico de movimentações.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        $actorId = $request->user()->id;
        $uploadedFotos = $this->collectUploadedFotos($request);
        $fotosRemover = array_map(
            static fn ($id) => (int) $id,
            $request->input('fotos_remover', []),
        );
        $wasUpdated = false;

        DB::transaction(function () use (
            $equipamento,
            $data,
            $actorId,
            $uploadedFotos,
            $fotosRemover,
            $request,
            &$wasUpdated,
        ): void {
            $equipamento->update([
                ...$data,
                'updated_by' => $actorId,
            ]);
            $wasUpdated = $equipamento->wasChanged();

            if ($fotosRemover !== []) {
                $this->removeEquipamentoFotos($equipamento, $fotosRemover);
                $wasUpdated = true;
            }

            $createdFotoIds = [];
            if ($uploadedFotos !== []) {
                $createdFotoIds = $this->storeEquipamentoFotos($equipamento, $uploadedFotos);
                $wasUpdated = true;
            }

            if ($this->applyFotoPrincipal($equipamento, $request, $createdFotoIds)) {
                $wasUpdated = true;
            }
        });

        $equipamento->refresh();

        if ($wasUpdated) {
            HistoricoEquipamento::query()->create([
                'equipamento_id' => $equipamento->id,
                'evento' => 'editado',
                'dados' => collect($data)->except(['foto_path'])->all(),
                'status_resultante' => $equipamento->fresh(['emprestimoAtivo', 'manutencaoAtiva', 'baixa'])->status,
                'registrado_por' => $actorId,
            ]);
        }

        $equipamento->load([
            'tipo.grupo',
            'fornecedor',
            'obra',
            'fotos',
            'creator',
            'updater',
            'emprestimoAtivo.renovacoes',
            'manutencaoAtiva.responsavelUser',
            'baixa',
        ]);

        return new EquipamentoResource($equipamento);
    }

    public function toggleActive(ToggleActiveRequest $request, Equipamento $equipamento): EquipamentoResource|JsonResponse
    {
        $equipamento->load(['emprestimoAtivo', 'manutencaoAtiva']);

        if (! $request->boolean('is_active') && $equipamento->emprestimoAtivo) {
            return response()->json([
                'message' => 'Equipamento com empréstimo ativo não pode ser inativado.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $request->boolean('is_active') && $equipamento->manutencaoAtiva) {
            return response()->json([
                'message' => 'Equipamento em manutenção não pode ser inativado.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $equipamento->forceFill(['updated_by' => $request->user()->id]);

        $updated = app(ToggleActiveAction::class)->execute(
            $equipamento,
            $request->boolean('is_active'),
        );

        $updated->load([
            'tipo.grupo',
            'fornecedor',
            'obra',
            'fotos',
            'creator',
            'updater',
            'emprestimoAtivo.renovacoes',
            'manutencaoAtiva.responsavelUser',
            'baixa',
        ]);

        return new EquipamentoResource($updated);
    }

    public function destroy(Equipamento $equipamento): JsonResponse
    {
        $equipamento->load(['emprestimoAtivo', 'manutencaoAtiva']);

        if ($equipamento->emprestimoAtivo) {
            return response()->json([
                'message' => 'Equipamento com empréstimo ativo não pode ser removido.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($equipamento->manutencaoAtiva) {
            return response()->json([
                'message' => 'Equipamento em manutenção não pode ser removido.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $equipamento->delete();

        return response()->json([
            'message' => 'Equipamento removido com sucesso.',
        ]);
    }

    /**
     * @return array<int, \Illuminate\Http\UploadedFile>
     */
    private function collectUploadedFotos(StoreEquipamentoRequest $request): array
    {
        if ($request->hasFile('fotos')) {
            $uploaded = $request->file('fotos');

            return array_values(array_filter(is_array($uploaded) ? $uploaded : [$uploaded]));
        }

        if ($request->hasFile('foto')) {
            return [$request->file('foto')];
        }

        return [];
    }

    /**
     * @param  array<int, \Illuminate\Http\UploadedFile>  $files
     * @return array<int, int>
     */
    private function storeEquipamentoFotos(Equipamento $equipamento, array $files): array
    {
        if ($files === []) {
            return [];
        }

        $hasExisting = $equipamento->fotos()->exists();
        $ordem = $hasExisting ? ((int) $equipamento->fotos()->max('ordem')) + 1 : 0;
        $createdIds = [];

        foreach ($files as $file) {
            $path = $file->store('equipamentos', 'public');
            $foto = $equipamento->fotos()->create([
                'path' => $path,
                'ordem' => $ordem,
            ]);
            $createdIds[] = $foto->id;
            $ordem++;
        }

        $this->syncEquipamentoFotoPath($equipamento);

        return $createdIds;
    }

    /**
     * @param  array<int, int>  $createdFotoIds
     */
    private function applyFotoPrincipal(
        Equipamento $equipamento,
        StoreEquipamentoRequest $request,
        array $createdFotoIds,
    ): bool {
        if ($request->filled('foto_principal_id')) {
            $this->setFotoPrincipal($equipamento, (int) $request->input('foto_principal_id'));

            return true;
        }

        if ($request->has('foto_principal_novo_indice') && $createdFotoIds !== []) {
            $index = (int) $request->input('foto_principal_novo_indice');
            if (isset($createdFotoIds[$index])) {
                $this->setFotoPrincipal($equipamento, $createdFotoIds[$index]);

                return true;
            }
        }

        return false;
    }

    private function setFotoPrincipal(Equipamento $equipamento, int $fotoId): void
    {
        $foto = $equipamento->fotos()->whereKey($fotoId)->first();
        if ($foto === null) {
            return;
        }

        $others = $equipamento->fotos()
            ->where('id', '!=', $fotoId)
            ->orderBy('ordem')
            ->orderBy('id')
            ->get();

        $foto->update(['ordem' => 0]);
        $ordem = 1;
        foreach ($others as $other) {
            $other->update(['ordem' => $ordem]);
            $ordem++;
        }

        $this->syncEquipamentoFotoPath($equipamento);
    }

    /**
     * @param  array<int, int>  $fotoIds
     */
    private function removeEquipamentoFotos(Equipamento $equipamento, array $fotoIds): void
    {
        $fotos = $equipamento->fotos()->whereIn('id', $fotoIds)->get();

        foreach ($fotos as $foto) {
            $this->deleteEquipamentoFotoFile($foto);
            $foto->delete();
        }

        $this->syncEquipamentoFotoPath($equipamento);
    }

    private function syncEquipamentoFotoPath(Equipamento $equipamento): void
    {
        $firstPath = $equipamento->fotos()->orderBy('ordem')->orderBy('id')->value('path');

        $equipamento->updateQuietly([
            'foto_path' => $firstPath,
        ]);
    }

    private function deleteEquipamentoFotoFile(EquipamentoFoto $foto): void
    {
        if ($foto->path !== '' && ! str_starts_with($foto->path, 'http')) {
            Storage::disk('public')->delete($foto->path);
        }
    }
}
