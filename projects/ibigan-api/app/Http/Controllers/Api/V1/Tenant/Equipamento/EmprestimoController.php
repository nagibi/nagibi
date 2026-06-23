<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant\Equipamento;

use App\Http\Controllers\Controller;
use App\Http\Requests\Emprestimo\StoreEmprestimoRequest;
use App\Http\Resources\Equipamento\EmprestimoResource;
use App\Models\Emprestimo;
use App\Models\Equipamento;
use App\Services\EquipamentoStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

final class EmprestimoController extends Controller
{
    public function __construct(
        private readonly EquipamentoStatusService $service,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Emprestimo::query()->with([
            'equipamento.tipo.grupo',
            'equipamento.fornecedor',
            'obra',
            'renovacoes',
            'autorizadoPor',
        ])->whereNull('data_devolucao');

        if ($request->filled('obra_id')) {
            $query->where('obra_id', $request->integer('obra_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($q) use ($search) {
                $q->where('colaborador_nome', 'like', "%{$search}%")
                    ->orWhere('colaborador_matricula', 'like', "%{$search}%")
                    ->orWhereHas('equipamento', fn ($e) => $e->where('patrimonio', 'like', "%{$search}%"));
            });
        }

        if ($request->string('alerta')->toString() === 'vencidos') {
            $query->vencidos();
        }

        if ($request->string('alerta')->toString() === 'proximos') {
            $query->proximosVencimento();
        }

        $emprestimos = $query
            ->orderByDesc('data_retirada')
            ->paginate($request->integer('per_page', 20));

        return EmprestimoResource::collection($emprestimos);
    }

    public function show(Emprestimo $emprestimo): EmprestimoResource
    {
        $emprestimo->load([
            'equipamento.tipo.grupo',
            'equipamento.fornecedor',
            'obra',
            'renovacoes.autorizadoPor',
            'autorizadoPor',
        ]);

        return new EmprestimoResource($emprestimo);
    }

    public function store(StoreEmprestimoRequest $request, Equipamento $equipamento): JsonResponse
    {
        $data = $request->validated();

        foreach (['foto_cracha', 'foto_equipamento_retirada', 'foto_assinatura'] as $campo) {
            if ($request->hasFile($campo)) {
                $data["{$campo}_path"] = $request->file($campo)->store('emprestimos', 'public');
            }
            unset($data[$campo]);
        }

        $emprestimo = $this->service->emprestar($equipamento, $data);
        $emprestimo->load(['equipamento.tipo.grupo', 'obra', 'renovacoes', 'autorizadoPor']);

        return (new EmprestimoResource($emprestimo))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function devolver(Request $request, Emprestimo $emprestimo): EmprestimoResource|JsonResponse
    {
        if (! $emprestimo->is_ativo) {
            return response()->json([
                'message' => 'Este empréstimo já foi encerrado.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $data = $request->validate([
            'data_devolucao' => ['nullable', 'date', 'before_or_equal:today'],
            'observacao' => ['nullable', 'string', 'max:2000'],
            'foto_equipamento_devolucao' => ['nullable', 'image', 'max:5120'],
            'fotos_equipamento_devolucao' => ['nullable', 'array', 'max:10'],
            'fotos_equipamento_devolucao.*' => ['image', 'max:5120'],
        ]);

        $devolucaoFotosPaths = [];

        if ($request->hasFile('foto_equipamento_devolucao')) {
            $devolucaoFotosPaths[] = $request->file('foto_equipamento_devolucao')
                ->store('devolucoes', 'public');
        }

        foreach ($request->file('fotos_equipamento_devolucao', []) as $foto) {
            $devolucaoFotosPaths[] = $foto->store('devolucoes', 'public');
        }

        unset($data['foto_equipamento_devolucao']);
        unset($data['fotos_equipamento_devolucao']);

        if ($devolucaoFotosPaths !== []) {
            $data['foto_equipamento_devolucao_path'] = $devolucaoFotosPaths[0];
            $data['fotos_equipamento_devolucao_paths'] = $devolucaoFotosPaths;
        }

        $emprestimo = $this->service->devolver($emprestimo, $data);

        return new EmprestimoResource($emprestimo->load([
            'equipamento.tipo.grupo',
            'obra',
            'renovacoes',
            'autorizadoPor',
        ]));
    }

    public function renovar(Request $request, Emprestimo $emprestimo): JsonResponse
    {
        if (! $emprestimo->is_ativo) {
            return response()->json([
                'message' => 'Este empréstimo já foi encerrado.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $data = $request->validate([
            'prazo_adicional_dias' => ['required', 'integer', 'min:1', 'max:365'],
            'data_renovacao' => ['nullable', 'date', 'before_or_equal:today'],
            'observacao' => ['nullable', 'string', 'max:500'],
        ]);

        $renovacao = $this->service->renovar($emprestimo, $data);
        $renovacao->load('autorizadoPor:id,name');

        return response()->json([
            'message' => 'Empréstimo renovado com sucesso.',
            'renovacao' => [
                'data' => $renovacao->data_renovacao->format('d/m/Y'),
                'prazo_adicional' => $renovacao->prazo_adicional_dias,
                'autorizado_por' => $renovacao->autorizadoPor?->name,
            ],
        ]);
    }
}
