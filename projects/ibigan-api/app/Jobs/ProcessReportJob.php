<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Jobs\Concerns\TenantAwareJob;
use App\Models\ReportExecution;
use App\Models\User;
use App\Notifications\ReportCompletedNotification;
use App\Services\NotificationPreferenceService;
use App\Services\ReportService;
use App\Support\ReportResultStorage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

final class ProcessReportJob implements ShouldQueue
{
    use TenantAwareJob;

    public int $timeout = 300;

    public function __construct(
        private readonly int $executionId,
    ) {}

    public function handle(
        ReportService $reportService,
        NotificationPreferenceService $prefService,
        ReportResultStorage $resultStorage,
    ): void {
        if (! tenancy()->initialized) {
            Log::error('ProcessReportJob executed without tenant context.', [
                'execution_id' => $this->executionId,
            ]);

            return;
        }

        $execution = ReportExecution::with(['template', 'executor'])->findOrFail($this->executionId);
        $template = $execution->template;
        $user = $execution->executor;

        try {
            $execution->update([
                'status' => 'running',
                'progress_message' => 'Executando query...',
            ]);

            $start = microtime(true);
            $results = $reportService->executeRaw($template, $execution->parameters ?? []);
            $duration = (int) ((microtime(true) - $start) * 1000);

            $path = $resultStorage->store($execution->id, $results);

            $execution->update([
                'status' => 'completed',
                'result_path' => $path,
                'result_rows_count' => count($results),
                'result_expires_at' => now()->addDays(7),
                'duration_ms' => $duration,
                'progress_message' => 'Concluído.',
            ]);

            $this->notifyReportCompleted($prefService, $user, $execution);
        } catch (\Exception $e) {
            $execution->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'progress_message' => 'Erro na execução.',
            ]);
        }
    }

    public function failed(?\Throwable $exception = null): void
    {
        if (! tenancy()->initialized) {
            return;
        }

        $execution = ReportExecution::query()->find($this->executionId);

        if ($execution === null || ! in_array($execution->status, ['pending', 'queued', 'running'], true)) {
            return;
        }

        $execution->update([
            'status' => 'failed',
            'error_message' => $exception?->getMessage() ?? 'Falha ao processar relatório.',
            'progress_message' => 'Erro na execução.',
        ]);
    }

    private function notifyReportCompleted(
        NotificationPreferenceService $prefService,
        User $user,
        ReportExecution $execution,
    ): void {
        if ($prefService->isEnabled($user, 'report.completed', 'app')) {
            try {
                $user->notify(new ReportCompletedNotification($execution, 'app'));
            } catch (\Throwable $e) {
                Log::warning('Falha ao enviar notificação in-app de relatório concluído.', [
                    'execution_id' => $execution->id,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($prefService->isEnabled($user, 'report.completed', 'email')) {
            if (! is_string($user->email) || trim($user->email) === '') {
                Log::warning('Relatório concluído sem e-mail: usuário sem endereço cadastrado.', [
                    'execution_id' => $execution->id,
                    'user_id' => $user->id,
                ]);
            } else {
                try {
                    $user->notify(new ReportCompletedNotification($execution, 'email'));
                } catch (\Throwable $e) {
                    Log::warning('Falha ao enviar e-mail de relatório concluído.', [
                        'execution_id' => $execution->id,
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
    }
}
