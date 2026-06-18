import type { ReportExecution } from '@/services/reports.service';

/** Alinhado ao timeout do job no backend (600s). */
export const REPORT_EXECUTION_POLL_WINDOW_MS = 10 * 60 * 1000;

const IN_PROGRESS_STATUSES = new Set(['pending', 'queued', 'running']);

export function isReportExecutionInProgress(execution: {
  status: string;
  executed_at?: string | null;
}): boolean {
  if (!IN_PROGRESS_STATUSES.has(execution.status)) {
    return false;
  }

  if (!execution.executed_at) {
    return false;
  }

  const startedAt = new Date(execution.executed_at).getTime();

  if (Number.isNaN(startedAt)) {
    return false;
  }

  return Date.now() - startedAt < REPORT_EXECUTION_POLL_WINDOW_MS;
}

export function hasRecentInProgressExecutions(executions: ReportExecution[]): boolean {
  return executions.some(isReportExecutionInProgress);
}
