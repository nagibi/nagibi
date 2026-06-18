import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  CheckCircle,
  Clock,
  LoaderCircle,
  Play,
  XCircle,
} from 'lucide-react';
import { GridDownloadIcon } from '@/components/icons/grid-download-icon';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { useFormToolbarAlert } from '@/hooks/use-form-toolbar-alert';
import { useFormRefresh } from '@/hooks/use-form-refresh';
import { formatBrl } from '@/lib/brazilian-masks';
import { applyApiFormErrors } from '@/lib/apply-api-form-errors';
import {
  buildReportExecuteDefaults,
  reportParameterRules,
} from '@/lib/report-execute-form';
import {
  hasRecentInProgressExecutions,
} from '@/lib/report-execution-polling';
import {
  reportsService,
  type ReportColumn,
  type ReportExecution,
  type ReportParameter,
} from '@/services/reports.service';
import { buildInactiveAlert, mergeToolbarAlerts } from '@/components/grid/toolbar-alert';
import { FormToolbar } from '@/components/grid/form-toolbar';
import { PageBody } from '@/components/common/page-body';
import { FormFieldGrid, FormFieldGridItem } from '@/components/grid/form-field-grid';
import { GridTableScroll } from '@/components/grid/grid-table-scroll';
import { FormPageSkeleton } from '@/components/grid/form-page-skeleton';
import { FormPanel } from '@/components/grid/form-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function formatCell(value: unknown, fmt: string): string {
  if (value === null || value === undefined) return '—';
  if (fmt === 'datetime') {
    try { return format(new Date(String(value)), 'dd/MM/yyyy HH:mm', { locale: ptBR }); }
    catch { return String(value); }
  }
  if (fmt === 'date') {
    try { return format(new Date(String(value)), 'dd/MM/yyyy', { locale: ptBR }); }
    catch { return String(value); }
  }
  if (fmt === 'currency') {
    const amount = Number(value);
    return Number.isNaN(amount) ? String(value) : formatBrl(amount);
  }
  if (fmt === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function formatExecutionDate(value?: string | null): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), "dd/MM 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

function normalizeParameters(value: unknown): ReportParameter[] {
  if (Array.isArray(value)) {
    return value;
  }

  return EMPTY_PARAMETERS;
}

const EMPTY_PARAMETERS: ReportParameter[] = [];

function normalizeColumns(
  value: unknown,
  rows: Record<string, unknown>[] = [],
): ReportColumn[] {
  if (Array.isArray(value) && value.length > 0) {
    return value;
  }

  if (rows.length === 0) {
    return [];
  }

  return Object.keys(rows[0] ?? {}).map((key) => ({
    key,
    label: key,
    format: 'text' as const,
  }));
}

function formatReportResultMessage(reportName: string, count: number): string {
  const records = count === 1 ? '1 registro' : `${count} registros`;
  return `${reportName} — ${records}`;
}

function ExecutionStatusIcon({ status }: { status: string }) {
  if (status === 'running') {
    return <LoaderCircle className="size-4 animate-spin text-blue-500" />;
  }
  if (status === 'completed' || status === 'success') {
    return <CheckCircle className="size-4 text-green-600" />;
  }
  if (status === 'failed' || status === 'error') {
    return <XCircle className="size-4 text-destructive" />;
  }
  return <Clock className="size-4 text-muted-foreground" />;
}

export function ReportExecutePage() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const navigate = useNavigate();
  const { apiAlert, showSuccess, showError } = useApiToolbarAlert();
  const [activeExecutionId, setActiveExecutionId] = useState<number | null>(null);
  const [results, setResults] = useState<{
    rows: Record<string, unknown>[];
    count: number;
    duration: number;
  } | null>(null);

  const form = useForm<Record<string, string>>({
    defaultValues: {},
    mode: 'onSubmit',
  });
  const formAlert = useFormToolbarAlert(form);

  const { data: reportData, isLoading, isFetched, isError: isReportError, isFetching: isReportFetching, refetch: refetchReport } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsService.show(reportId),
    enabled: Number.isFinite(reportId),
  });

  const { data: executionsData, refetch: refetchExecutions, isFetching: isExecutionsFetching } = useQuery({
    queryKey: ['report-executions', id],
    queryFn: () => reportsService.executions(reportId),
    enabled: Number.isFinite(reportId),
    refetchInterval: (query) => {
      const items = query.state.data?.data?.result?.data ?? [];
      return hasRecentInProgressExecutions(items) ? 3000 : false;
    },
  });

  const { data: executionStatusData } = useQuery({
    queryKey: ['report-execution-status', id, activeExecutionId],
    queryFn: () => reportsService.executionStatus(reportId, activeExecutionId!),
    enabled: Number.isFinite(reportId) && activeExecutionId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.result?.status;
      return status === 'queued' || status === 'running' ? 2000 : false;
    },
  });

  const report = reportData?.data?.result;
  const executions = executionsData?.data?.result?.data ?? [];
  const parameters = useMemo(
    () => normalizeParameters(report?.parameters),
    [report?.parameters],
  );

  const executeMutation = useMutation({
    mutationFn: (params: Record<string, string>) =>
      reportsService.execute(reportId, params),
    onSuccess: (response) => {
      setResults(null);
      setActiveExecutionId(response.data.result.execution_id);
      void refetchExecutions();
      showSuccess('Relatório enviado para execução.');
    },
    onError: (error) => {
      if (!applyApiFormErrors(form, error)) {
        showError('Erro ao executar relatório.', error);
      }
    },
  });

  const executionStatus = executionStatusData?.data?.result?.status;
  const isExecuting = executeMutation.isPending || isExecutionRunning(activeExecutionId, executionStatus);
  const isReportInactive = report != null && !report.is_active;

  useEffect(() => {
    if (isReportError) {
      showError('Erro ao carregar relatório.');
    }
  }, [isReportError, showError]);

  useEffect(() => {
    if (parameters.length === 0) {
      return;
    }

    form.reset(buildReportExecuteDefaults(parameters));
  }, [form, parameters]);

  const loadResults = useCallback(async (executionId: number, durationMs = 0) => {
    const response = await reportsService.result(reportId, executionId, 1, 10000);
    setResults({
      rows: response.data.result.data,
      count: response.data.result.meta.total,
      duration: durationMs,
    });
  }, [reportId]);

  useEffect(() => {
    if (!activeExecutionId || executionStatus !== 'completed') {
      return;
    }

    let cancelled = false;
    const durationMs = executionStatusData?.data?.result?.duration_ms ?? 0;

    void loadResults(activeExecutionId, durationMs)
      .then(() => {
        if (cancelled) return;
        const count = executionStatusData?.data?.result?.rows_count ?? 0;
        showSuccess(formatReportResultMessage(report?.name ?? 'Relatório', count));
      })
      .catch(() => {
        if (cancelled) return;
        showError('Erro ao carregar resultado do relatório.');
      })
      .finally(() => {
        if (!cancelled) {
          setActiveExecutionId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeExecutionId,
    executionStatus,
    executionStatusData,
    loadResults,
    report?.name,
    showError,
    showSuccess,
  ]);

  useEffect(() => {
    if (executionStatus !== 'failed') {
      return;
    }

    showError(executionStatusData?.data?.result?.error_message ?? 'Erro ao executar relatório.');
    setActiveExecutionId(null);
  }, [executionStatus, executionStatusData, showError]);

  const handleExecute = useCallback(() => {
    if (isReportInactive) {
      showError('Relatório inativo.');
      return;
    }

    void form.handleSubmit((data) => executeMutation.mutate(data))();
  }, [executeMutation, form, isReportInactive, showError]);

  const exportCSV = useCallback(() => {
    if (!results || !report) return;

    const cols = normalizeColumns(report.columns, results.rows);
    const header = cols.map((column) => column.label).join(',');
    const rows = results.rows.map((row) =>
      cols.map((column) => `"${String(row[column.key] ?? '').replace(/"/g, '""')}"`).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.name}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [report, results]);

  const pageAlert = useMemo(
    () => mergeToolbarAlerts(
      apiAlert,
      formAlert,
      isReportInactive ? buildInactiveAlert('report') : null,
    ),
    [apiAlert, formAlert, isReportInactive],
  );

  const refreshReport = useCallback(() => {
    void refetchReport();
    void refetchExecutions();
  }, [refetchExecutions, refetchReport]);

  const formRefresh = useFormRefresh({
    isEditing: true,
    isDirty: form.formState.isDirty,
    isFetching: isReportFetching || isExecutionsFetching,
    refetch: refreshReport,
  });

  const toolbarActions = useMemo(
    () => (
      <FormToolbar
        isEditing={false}
        isSubmitting={isExecuting}
        onSaveAndList={handleExecute}
        onBack={() => navigate('/reports')}
        onRefresh={formRefresh.onRefresh}
        isRefreshing={formRefresh.isRefreshing}
        primarySaveLabel="Executar"
        primarySaveTooltip="Executa o relatório com os parâmetros informados."
        primarySaveIcon={Play}
        primarySaveDisabled={isReportInactive}
        entityLabel="relatório"
        recordLabel={report?.name}
        extra={results ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs font-medium"
            onClick={exportCSV}
          >
            <GridDownloadIcon className="size-3.5" />
            Exportar CSV
          </Button>
        ) : undefined}
      />
    ),
    [exportCSV, formRefresh.isRefreshing, formRefresh.onRefresh, handleExecute, isExecuting, isReportInactive, navigate, report?.name, results],
  );

  usePageToolbar({
    title: report?.name ?? 'Executar relatório',
    description: report?.description ?? 'Configure os parâmetros e execute o relatório.',
    alert: pageAlert,
    actions: toolbarActions,
  });

  if (isLoading) {
    return (
      <FormPageSkeleton
        panels={[
          { titleWidth: 'w-28', fields: 2 },
          { titleWidth: 'w-24', fields: 1 },
        ]}
      />
    );
  }

  if (isFetched && !report) {
    return (
      <PageBody>
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Relatório não encontrado ou indisponível.</p>
          <Button type="button" variant="outline" onClick={() => navigate('/reports')}>
            Voltar para relatórios
          </Button>
        </div>
      </PageBody>
    );
  }

  const cols = normalizeColumns(report?.columns, results?.rows ?? []);

  return (
    <PageBody>
      <Form {...form}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleExecute();
          }}
        >
          <FormPanel title="Parâmetros">
            <FormFieldGrid>
              {parameters.length === 0 ? (
                <FormFieldGridItem span={2}>
                  <p className="text-sm text-muted-foreground">Sem parâmetros necessários.</p>
                </FormFieldGridItem>
              ) : (
                parameters.map((parameter) => (
                  <FormFieldGridItem key={parameter.name}>
                    <FormField
                      control={form.control}
                      name={parameter.name}
                      rules={reportParameterRules(parameter)}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required={parameter.required}>{parameter.label}</FormLabel>
                          <FormControl>
                            {parameter.type === 'select' ? (
                              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  {parameter.options?.map((option) => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={parameter.type === 'date' ? 'date' : parameter.type === 'number' ? 'number' : 'text'}
                                {...field}
                                value={field.value ?? ''}
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FormFieldGridItem>
                ))
              )}
            </FormFieldGrid>
          </FormPanel>
        </form>
      </Form>

      {executions.length > 0 && (
        <FormPanel title="Histórico recente">
          <div className="divide-y rounded-md border">
            {executions.slice(0, 5).map((execution: ReportExecution) => {
              const isCompleted = execution.status === 'completed' || execution.status === 'success';

              return (
                <div key={execution.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {formatExecutionDate(execution.executed_at)}
                      {execution.executed_by ? ` · ${execution.executed_by}` : ''}
                    </p>
                    {execution.progress_message && !isCompleted && execution.status !== 'failed' && (
                      <p className="truncate text-xs text-muted-foreground">{execution.progress_message}</p>
                    )}
                    {execution.error_message && (
                      <p className="truncate text-xs text-destructive">{execution.error_message}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ExecutionStatusIcon status={execution.status} />
                    {isCompleted && (
                      <span className="text-xs text-muted-foreground">
                        {execution.rows_count} linhas · {execution.duration_ms}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </FormPanel>
      )}

      <FormPanel
        title="Resultados"
        description={results ? `${results.count} registros · ${results.duration}ms` : undefined}
      >
        {isExecuting ? (
          <div className="flex h-48 items-center justify-center rounded-md border text-muted-foreground">
            <div className="text-center">
              <LoaderCircle className="mx-auto mb-2 size-8 animate-spin opacity-60" />
              <p className="text-sm">
                {executionStatusData?.data?.result?.progress_message ?? 'Executando relatório...'}
              </p>
            </div>
          </div>
        ) : !results ? (
          <div className="flex h-48 items-center justify-center rounded-md border text-muted-foreground">
            <div className="text-center">
              <Clock className="mx-auto mb-2 size-8 opacity-20" />
              <p className="text-sm">Execute o relatório para ver os resultados.</p>
            </div>
          </div>
        ) : (
          <GridTableScroll className="rounded-md border max-xl:h-auto max-xl:flex-none">
            <table className="w-max min-w-full table-auto caption-bottom text-sm text-foreground">
              <TableHeader>
                <TableRow>
                  {cols.map((column) => (
                    <TableHead key={column.key} className="whitespace-nowrap">{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(cols.length, 1)} className="py-8 text-center text-muted-foreground">
                      Nenhum resultado encontrado para os filtros informados.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.rows.map((row, index) => (
                    <TableRow key={index}>
                      {cols.map((column) => (
                        <TableCell key={column.key} className="whitespace-nowrap text-sm">
                          {formatCell(row[column.key], column.format ?? 'text')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </GridTableScroll>
        )}
      </FormPanel>
    </PageBody>
  );
}

function isExecutionRunning(
  activeExecutionId: number | null,
  executionStatus?: string,
): boolean {
  if (activeExecutionId == null) {
    return false;
  }

  return executionStatus == null || executionStatus === 'queued' || executionStatus === 'running';
}
