<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant\Equipamento;

use App\Http\Controllers\Api\V1\Tenant\Equipamento\Concerns\RespondsWithPagination;
use App\Http\Controllers\Controller;
use App\Models\Equipamento;
use App\Models\HistoricoEquipamento;
use App\Support\StorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class HistoricoController extends Controller
{
    use RespondsWithPagination;

    public function index(Request $request, Equipamento $equipamento): JsonResponse
    {
        $historico = $equipamento->historico()
            ->with('registradoPor:id,name')
            ->when($request->filled('evento'), fn ($query) => $query->where('evento', $request->string('evento')->toString()))
            ->paginate($request->integer('per_page', 20));

        return $this->paginated($historico, fn (HistoricoEquipamento $item) => $this->present($item));
    }

    /**
     * @return array<string, mixed>
     */
    private function present(HistoricoEquipamento $item): array
    {
        $dados = $item->dados ?? [];

        if (isset($dados['fotos_equipamento_devolucao_paths']) && is_array($dados['fotos_equipamento_devolucao_paths'])) {
            $dados['fotos_equipamento_devolucao_urls'] = collect($dados['fotos_equipamento_devolucao_paths'])
                ->filter(fn (mixed $path): bool => is_string($path) && $path !== '')
                ->map(fn (string $path): ?string => StorageUrl::public($path))
                ->filter()
                ->values()
                ->all();
        }

        return [
            'id' => $item->id,
            'evento' => $item->evento,
            'dados' => $dados,
            'status_resultante' => $item->status_resultante,
            'observacao' => $item->observacao,
            'registrado_por' => $item->relationLoaded('registradoPor') && $item->registradoPor ? [
                'id' => $item->registradoPor->id,
                'name' => $item->registradoPor->name,
            ] : null,
            'created_at' => $item->created_at?->toIso8601String(),
        ];
    }
}
