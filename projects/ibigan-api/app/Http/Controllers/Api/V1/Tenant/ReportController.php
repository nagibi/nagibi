<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Concerns\TogglesModelActive;
use App\Http\Controllers\Controller;
use App\Http\Requests\ToggleActiveRequest;
use App\Models\ReportExecution;
use App\Models\ReportTemplate;
use App\Support\PlatformCatalogGuard;
use App\Support\GridFilter;
use App\Services\ReportService;
use App\Support\ApiResponse;
use App\Support\ReportCsvExporter;
use App\Support\ReportExecutionStaleResolver;
use App\Support\ReportResultStorage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ReportController extends Controller
{
    use TogglesModelActive;

    public function __construct(
        private readonly ReportService $reportService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-visualizar'), Response::HTTP_FORBIDDEN);

        $templates = ReportTemplate::query()
            ->when($request->user()->cannot('relatorio-gerenciar'), fn ($q) => $q->where('is_active', true))
            ->when(
                $request->filled('filter_id'),
                fn ($q) => GridFilter::applyIdFromCsv($q, $request->string('filter_id')->toString()),
            )
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15));

        return response()->json([
            'status'  => 1,
            'message' => 'MSG000067',
            'result'  => [
                'data' => $templates->map(fn ($t) => $this->formatReportTemplate($t)),
                'meta' => [
                    'current_page' => $templates->currentPage(),
                    'last_page'    => $templates->lastPage(),
                    'per_page'     => $templates->perPage(),
                    'total'        => $templates->total(),
                ],
            ],
        ]);
    }

    public function show(Request $request, ReportTemplate $report): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-visualizar'), Response::HTTP_FORBIDDEN);

        return response()->json([
            'status'  => 1,
            'message' => 'MSG000067',
            'result'  => $this->formatReportTemplate(
                $report,
                includeQuery: $request->user()->can('relatorio-gerenciar'),
            ),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-gerenciar'), Response::HTTP_FORBIDDEN);

        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'description'   => ['nullable', 'string'],
            'query'         => ['required', 'string'],
            'parameters'    => ['nullable', 'array'],
            'columns'       => ['nullable', 'array'],
            'is_active'     => ['boolean'],
        ]);

        $template = ReportTemplate::create([
            ...$validated,
            'is_system' => false,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'status'  => 1,
            'message' => 'MSG000424',
            'result'  => $this->formatReportTemplate($template, includeQuery: true),
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, ReportTemplate $report): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-gerenciar'), Response::HTTP_FORBIDDEN);

        PlatformCatalogGuard::ensureCanEdit($report);

        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'query'       => ['sometimes', 'string'],
            'parameters'  => ['nullable', 'array'],
            'columns'     => ['nullable', 'array'],
            'is_active'   => ['boolean'],
        ]);

        $report->update($validated);

        return response()->json([
            'status'  => 1,
            'message' => 'MSG000425',
            'result'  => $this->formatReportTemplate($report->fresh(), includeQuery: true),
        ]);
    }

    /**
     * Ativar ou inativar template de relatório.
     *
     * Requer permissão `relatorio-gerenciar`.
     */
    public function toggleActive(ToggleActiveRequest $request, ReportTemplate $report): JsonResponse
    {
        return $this->performToggleActive($request, $report);
    }

    protected function toggleActivePermission(): string
    {
        return 'relatorio-gerenciar';
    }

    protected function formatToggleActiveResult(Model $model): ReportTemplate
    {
        /** @var ReportTemplate $model */
        return $model;
    }

    public function destroy(Request $request, ReportTemplate $report): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-gerenciar'), Response::HTTP_FORBIDDEN);

        PlatformCatalogGuard::ensureCanDelete($report);

        $report->delete();

        return response()->json([
            'status'  => 1,
            'message' => 'MSG000426',
            'result'  => null,
        ]);
    }

    public function execute(Request $request, ReportTemplate $report): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-visualizar'), Response::HTTP_FORBIDDEN);
        abort_unless($report->is_active, Response::HTTP_UNPROCESSABLE_ENTITY);

        $params = $request->validate([
            'parameters' => ['nullable', 'array'],
        ]);

        $execution = $this->reportService->execute(
            $report,
            $params['parameters'] ?? [],
            $request->user(),
        );

        return response()->json([
            'status' => 1,
            'message' => 'MSG000067',
            'result' => [
                'execution_id' => $execution->id,
                'status' => $execution->status,
                'progress_message' => $execution->progress_message,
            ],
        ]);
    }

    public function executionStatus(Request $request, ReportTemplate $report, ReportExecution $execution): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-visualizar'), Response::HTTP_FORBIDDEN);
        abort_unless($execution->report_template_id === $report->id, Response::HTTP_NOT_FOUND);

        ReportExecutionStaleResolver::failStale($execution);

        return response()->json([
            'status' => 1,
            'result' => [
                'id' => $execution->id,
                'status' => $execution->status,
                'progress_message' => $execution->progress_message,
                'rows_count' => $execution->result_rows_count,
                'duration_ms' => $execution->duration_ms,
                'error_message' => $execution->error_message,
                'expires_at' => $execution->result_expires_at?->toIso8601String(),
            ],
        ]);
    }

    public function result(Request $request, ReportTemplate $report, ReportExecution $execution): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-visualizar'), Response::HTTP_FORBIDDEN);
        abort_unless($execution->report_template_id === $report->id, Response::HTTP_NOT_FOUND);

        $resolved = $this->resolveExecutionResult($report, $execution);

        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        [$rows] = $resolved;

        $page = max(1, $request->integer('page', 1));
        $perPage = min(10_000, max(1, $request->integer('per_page', 50)));
        $total = count($rows);
        $sliced = array_slice($rows, ($page - 1) * $perPage, $perPage);

        return response()->json([
            'status' => 1,
            'result' => [
                'data' => $sliced,
                'meta' => [
                    'total' => $total,
                    'per_page' => $perPage,
                    'current_page' => $page,
                    'last_page' => max(1, (int) ceil($total / $perPage)),
                ],
            ],
        ]);
    }

    public function downloadCsv(string $tenant, int $report, int $execution): Response|JsonResponse
    {
        abort_unless(tenancy()->initialized, Response::HTTP_NOT_FOUND);

        $template = ReportTemplate::query()->findOrFail($report);
        $executionModel = ReportExecution::query()->findOrFail($execution);

        abort_unless($executionModel->report_template_id === $template->id, Response::HTTP_NOT_FOUND);

        $resolved = $this->resolveExecutionResult($template, $executionModel);

        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        [$rows] = $resolved;

        if ($rows === []) {
            return ApiResponse::error(
                'report.result_not_found',
                httpStatus: Response::HTTP_NOT_FOUND,
            );
        }

        $csv = ReportCsvExporter::toCsv($rows, $template->columns);
        $fileName = ReportCsvExporter::sanitizeFileName($template->name);

        return response($csv, Response::HTTP_OK, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'.csv"',
        ]);
    }

    public function executions(Request $request, ReportTemplate $report): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-visualizar'), Response::HTTP_FORBIDDEN);

        ReportExecutionStaleResolver::failStaleForReport($report->id);

        $executions = $report->executions()
            ->with('executor')
            ->orderByDesc('executed_at')
            ->paginate(10);

        return response()->json([
            'status'  => 1,
            'message' => 'MSG000067',
            'result'  => [
                'data' => $executions->map(fn($e) => [
                    'id' => $e->id,
                    'executed_by' => $e->executor?->name,
                    'parameters' => $e->parameters,
                    'rows_count' => $e->result_rows_count ?? $e->rows_count,
                    'duration_ms' => $e->duration_ms,
                    'status' => $e->status,
                    'progress_message' => $e->progress_message,
                    'error_message' => $e->error_message,
                    'executed_at' => $e->executed_at->toIso8601String(),
                ]),
                'meta' => [
                    'current_page' => $executions->currentPage(),
                    'last_page'    => $executions->lastPage(),
                    'total'        => $executions->total(),
                ],
            ],
        ]);
    }

    /**
     * Listar todas as execuções do usuário autenticado.
     */
    public function myExecutions(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('relatorio-visualizar'), Response::HTTP_FORBIDDEN);

        ReportExecutionStaleResolver::staleQuery(
            ReportExecution::query()->where('executed_by', $request->user()->id),
        )->update([
            'status' => 'failed',
            'error_message' => 'Execução expirada ou interrompida.',
            'progress_message' => 'Encerrada automaticamente.',
        ]);

        $executions = ReportExecution::with('template')
            ->where('executed_by', $request->user()->id)
            ->when(
                $request->filled('filter_id'),
                fn ($q) => GridFilter::applyIdFromCsv($q, $request->string('filter_id')->toString()),
            )
            ->orderByDesc('executed_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'status'  => 1,
            'message' => 'MSG000067',
            'result'  => [
                'data' => $executions->map(fn($e) => [
                    'id'               => $e->id,
                    'template_id'      => $e->report_template_id,
                    'template_name'    => $e->template?->name,
                    'status'           => $e->status,
                    'progress_message' => $e->progress_message,
                    'rows_count'       => $e->result_rows_count,
                    'duration_ms'      => $e->duration_ms,
                    'error_message'    => $e->error_message,
                    'expires_at'       => $e->result_expires_at?->toIso8601String(),
                    'executed_at'      => $e->executed_at->toIso8601String(),
                    'parameters'       => $e->parameters,
                ]),
                'meta' => [
                    'current_page' => $executions->currentPage(),
                    'last_page'    => $executions->lastPage(),
                    'per_page'     => $executions->perPage(),
                    'total'        => $executions->total(),
                ],
            ],
        ]);
    }

    /**
     * @return JsonResponse|array{0: array<int, array<string, mixed>>}
     */
    private function resolveExecutionResult(ReportTemplate $report, ReportExecution $execution): JsonResponse|array
    {
        if (in_array($execution->status, ['pending', 'queued', 'running'], true)) {
            return ApiResponse::error(
                'report.execution_in_progress',
                httpStatus: Response::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        if ($execution->result_expires_at?->isPast()) {
            return ApiResponse::error(
                'report.result_expired',
                httpStatus: Response::HTTP_GONE,
            );
        }

        $resultStorage = app(ReportResultStorage::class);
        $rows = $resultStorage->load($execution->result_path);

        if ($rows === null) {
            if ($execution->status === 'failed') {
                return ApiResponse::error(
                    'report.execution_failed',
                    params: ['error' => $execution->error_message],
                    httpStatus: Response::HTTP_UNPROCESSABLE_ENTITY,
                );
            }

            return ApiResponse::error(
                'report.result_not_found',
                httpStatus: Response::HTTP_NOT_FOUND,
            );
        }

        return [$rows];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatReportTemplate(ReportTemplate $report, bool $includeQuery = false): array
    {
        return [
            'id' => $report->id,
            'name' => $report->name,
            'platform_key' => $report->platform_key,
            'description' => $report->description,
            'query' => $includeQuery ? $report->query : null,
            'parameters' => $report->parameters,
            'columns' => $report->columns,
            'is_active' => $report->is_active,
            'is_system' => (bool) $report->is_system,
            'created_at' => $report->created_at->toIso8601String(),
        ];
    }
}
