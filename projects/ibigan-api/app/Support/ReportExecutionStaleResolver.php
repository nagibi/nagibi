<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\ReportExecution;
use Illuminate\Database\Eloquent\Builder;

final class ReportExecutionStaleResolver
{
    /** Alinhado ao timeout do ProcessReportJob (300s) + margem. */
    public const STALE_AFTER_SECONDS = 600;

    public static function staleThreshold(): \Illuminate\Support\Carbon
    {
        return now()->subSeconds(self::STALE_AFTER_SECONDS);
    }

    public static function inProgressStatuses(): array
    {
        return ['pending', 'queued', 'running'];
    }

    public static function staleQuery(Builder $query): Builder
    {
        return $query
            ->whereIn('status', self::inProgressStatuses())
            ->where('executed_at', '<', self::staleThreshold());
    }

    public static function failStale(ReportExecution $execution): ReportExecution
    {
        if (! in_array($execution->status, self::inProgressStatuses(), true)) {
            return $execution;
        }

        if ($execution->executed_at === null || $execution->executed_at->gte(self::staleThreshold())) {
            return $execution;
        }

        $execution->update([
            'status' => 'failed',
            'error_message' => 'Execução expirada ou interrompida.',
            'progress_message' => 'Encerrada automaticamente.',
        ]);

        return $execution->refresh();
    }

    public static function failStaleForReport(int $reportTemplateId): int
    {
        return self::staleQuery(
            ReportExecution::query()->where('report_template_id', $reportTemplateId),
        )->update([
            'status' => 'failed',
            'error_message' => 'Execução expirada ou interrompida.',
            'progress_message' => 'Encerrada automaticamente.',
        ]);
    }
}
