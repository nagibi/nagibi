import { useCallback, useEffect, useRef, useState } from 'react';
import { EquipamentoDialogShell } from '@/pages/equipamentos/components/equipamento-dialog-shell';
import {
  buildEquipamentoStoreFormData,
  buildEquipamentoUpdateFormData,
  EquipamentoFotosField,
  getDefaultEquipamentoPrincipal,
  getEquipamentoExistingFotos,
  hasPrincipalChanged,
  resolvePrincipalPayload,
  type EquipamentoFotoPrincipal,
} from '@/pages/equipamentos/components/equipamento-foto-field';
import { EquipamentoFotoViewerDialog } from '@/pages/equipamentos/components/equipamento-foto-viewer-dialog';
import { EquipamentoThumbnail } from '@/pages/equipamentos/components/equipamento-thumbnail';
import {
  EquipamentoUserSelect,
  getUserMatricula,
} from '@/pages/equipamentos/components/equipamento-user-select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, History, Loader2 } from 'lucide-react';
import type {
  Equipamento,
  EquipamentoHistoricoItem,
} from '@/types/equipamento';
import { mapApiErrorsToRecord } from '@/lib/apply-api-form-errors';
import { numberToCurrencyDigits } from '@/lib/brazilian-masks';
import {
  buildEquipamentoFormValues,
  equipamentoFormSchema,
  type EquipamentoFormValues,
} from '@/lib/equipamento-form-schema';
import { HISTORICO_EVENTO_LABELS } from '@/lib/equipamento-labels';
import {
  orderFotosWithPrincipalFirst,
  todayIsoDate,
} from '@/lib/equipamento-utils';
import { getApiErrorMessage } from '@/lib/get-api-error-message';
import { showAppToast } from '@/lib/show-app-toast';
import { cn } from '@/lib/utils';
import { mapZodFieldErrors } from '@/lib/zod-validators';
import { equipamentosService } from '@/services/equipamentos.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { FieldMessage } from '@/components/ui/field-message';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaskedInput } from '@/components/ui/masked-input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  SidePanelSheet,
  SidePanelSheetActions,
  SidePanelSheetBody,
  SidePanelSheetContent,
  SidePanelSheetFooter,
  SidePanelSheetHeader,
} from '@/components/ui/side-panel-sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SheetPanelTitle } from '@/components/common/panel-title';

type ModalBaseProps = {
  equipamento: Equipamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function EquipamentoCreatedDateField({
  id,
  value,
  error,
  onChange,
  onClearError,
}: {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onClearError: () => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} required>
        Data de cadastro
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        max={todayIsoDate()}
        className={cn('w-full max-w-44', fieldErrorClass(Boolean(error)))}
        onChange={(event) => {
          onClearError();
          onChange(event.target.value);
        }}
      />
      <FieldMessage message={error} />
    </div>
  );
}

function useEquipamentoFieldErrors() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clear = useCallback(() => setFieldErrors({}), []);

  const clearField = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const applyApi = useCallback((error: unknown) => {
    const mapped = mapApiErrorsToRecord(error);
    if (!mapped) return false;
    setFieldErrors(mapped);
    return true;
  }, []);

  return { fieldErrors, clear, clearField, applyApi, setFieldErrors };
}

function fieldErrorClass(hasError: boolean) {
  return cn(hasError && 'border-destructive');
}

function useInvalidateEquipamentos() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
    queryClient.invalidateQueries({ queryKey: ['equipamentos-dashboard'] });
  };
}

export function EmprestarModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const invalidate = useInvalidateEquipamentos();
  const [obraId, setObraId] = useState('');
  const [colaboradorUserId, setColaboradorUserId] = useState('');
  const [colaboradorNome, setColaboradorNome] = useState('');
  const [colaboradorMatricula, setColaboradorMatricula] = useState('');
  const [encarregadoUserId, setEncarregadoUserId] = useState('');
  const [encarregadoNome, setEncarregadoNome] = useState('');
  const [prazoDias, setPrazoDias] = useState('15');

  const { data: obras = [], isLoading: loadingObras } = useQuery({
    queryKey: ['equipamentos-lookups', 'obras'],
    queryFn: () => equipamentosService.lookupObras(),
    enabled: open,
  });

  const obraOptions = obras.map((obra) => ({
    value: String(obra.id),
    label: `${obra.codigo ? `${obra.codigo} — ` : ''}${obra.nome}`,
    keywords: obra.codigo ?? undefined,
  }));

  useEffect(() => {
    if (!open) return;
    setObraId('');
    setColaboradorUserId('');
    setColaboradorNome('');
    setColaboradorMatricula('');
    setEncarregadoUserId('');
    setEncarregadoNome('');
    setPrazoDias('15');
  }, [open, equipamento?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      equipamentosService.emprestar(equipamento!.id, {
        obra_id: Number(obraId),
        colaborador_nome: colaboradorNome,
        colaborador_matricula: colaboradorMatricula,
        encarregado_nome: encarregadoNome,
        data_retirada: todayIsoDate(),
        prazo_dias: Number(prazoDias),
      }),
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Equipamento emprestado com sucesso.' });
      onOpenChange(false);
    },
    onError: (error) => {
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao emprestar equipamento.'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={<DialogTitle>Emprestar {equipamento?.patrimonio}</DialogTitle>}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !obraId ||
                !colaboradorUserId ||
                !encarregadoUserId
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Confirmar'
              )}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Obra destino</Label>
            <SearchableSelect
              value={obraId}
              onValueChange={setObraId}
              options={obraOptions}
              placeholder="Selecione a obra"
              searchPlaceholder="Buscar obra..."
              loading={loadingObras}
              disabled={loadingObras}
            />
          </div>
          <div className="grid gap-2">
            <Label>Colaborador</Label>
            <EquipamentoUserSelect
              value={colaboradorUserId}
              enabled={open}
              placeholder="Selecione o colaborador"
              onSelect={(user) => {
                setColaboradorUserId(String(user.id));
                setColaboradorNome(user.name);
                setColaboradorMatricula(getUserMatricula(user));
              }}
            />
            {colaboradorMatricula ? (
              <p className="text-xs text-muted-foreground">
                Matrícula: {colaboradorMatricula}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Encarregado / líder</Label>
            <EquipamentoUserSelect
              value={encarregadoUserId}
              enabled={open}
              placeholder="Selecione o encarregado"
              onSelect={(user) => {
                setEncarregadoUserId(String(user.id));
                setEncarregadoNome(user.name);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Prazo (dias)</Label>
            <Input
              type="number"
              min={1}
              value={prazoDias}
              onChange={(e) => setPrazoDias(e.target.value)}
            />
          </div>
        </div>
      </EquipamentoDialogShell>
    </Dialog>
  );
}

export function ManutencaoModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const invalidate = useInvalidateEquipamentos();
  const [responsabilidade, setResponsabilidade] = useState<
    'fortes' | 'equipamento'
  >('equipamento');
  const [motivo, setMotivo] = useState('');
  const [responsavelUserId, setResponsavelUserId] = useState('');

  useEffect(() => {
    if (!open) return;
    setResponsabilidade('equipamento');
    setMotivo('');
    setResponsavelUserId('');
  }, [open, equipamento?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      equipamentosService.enviarManutencao(equipamento!.id, {
        responsabilidade,
        motivo,
        responsavel_user_id: Number(responsavelUserId),
        data_entrada: todayIsoDate(),
      }),
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Equipamento enviado para manutenção.' });
      onOpenChange(false);
    },
    onError: (error) => {
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao enviar para manutenção.'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={
          <DialogTitle>Manutenção — {equipamento?.patrimonio}</DialogTitle>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending || !motivo.trim() || !responsavelUserId
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Enviar'
              )}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Responsabilidade</Label>
            <SearchableSelect
              value={responsabilidade}
              onValueChange={(value) =>
                setResponsabilidade(value as 'fortes' | 'equipamento')
              }
              options={[
                { value: 'equipamento', label: 'Equipamento (fornecedor)' },
                { value: 'fortes', label: 'Fortes' },
              ]}
              placeholder="Selecione a responsabilidade"
              searchPlaceholder="Buscar..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Responsável pela manutenção</Label>
            <EquipamentoUserSelect
              value={responsavelUserId}
              placeholder="Selecione o usuário"
              onSelect={(user) => setResponsavelUserId(String(user.id))}
            />
          </div>
        </div>
      </EquipamentoDialogShell>
    </Dialog>
  );
}

export function BaixaModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const invalidate = useInvalidateEquipamentos();
  const [tipo, setTipo] = useState<'devolucao' | 'perda'>('devolucao');
  const [motivo, setMotivo] = useState('');
  const [responsavel, setResponsavel] = useState('');

  useEffect(() => {
    if (!open) return;
    setTipo('devolucao');
    setMotivo('');
    setResponsavel('');
  }, [open, equipamento?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      equipamentosService.baixar(equipamento!.id, {
        tipo,
        data_baixa: todayIsoDate(),
        ...(tipo === 'perda'
          ? { motivo, responsavel_perda: responsavel }
          : { observacoes: motivo || undefined }),
      }),
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Baixa registrada com sucesso.' });
      onOpenChange(false);
    },
    onError: (error) => {
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao registrar baixa.'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={<DialogTitle>Baixar {equipamento?.patrimonio}</DialogTitle>}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                (tipo === 'perda' && (!motivo.trim() || !responsavel.trim()))
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Confirmar baixa'
              )}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Tipo de baixa</Label>
            <SearchableSelect
              value={tipo}
              onValueChange={(value) => setTipo(value as 'devolucao' | 'perda')}
              options={[
                { value: 'devolucao', label: 'Devolução ao fornecedor' },
                { value: 'perda', label: 'Perda / extravio' },
              ]}
              placeholder="Selecione o tipo"
              searchPlaceholder="Buscar..."
            />
          </div>
          {tipo === 'perda' ? (
            <>
              <div className="grid gap-2">
                <Label>Motivo</Label>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>Responsável pela perda</Label>
                <Input
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>
      </EquipamentoDialogShell>
    </Dialog>
  );
}

export function DevolverModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const invalidate = useInvalidateEquipamentos();
  const isMobile = useIsMobile();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const emprestimoId = equipamento?.emprestimo_ativo?.id;
  const [dataDevolucao, setDataDevolucao] = useState(todayIsoDate());
  const [observacao, setObservacao] = useState('');
  const [fotosDevolucao, setFotosDevolucao] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    setDataDevolucao(todayIsoDate());
    setObservacao('');
    setFotosDevolucao([]);
  }, [open, equipamento?.id]);

  const appendFotosDevolucao = (files: FileList | null) => {
    if (!files?.length) return;
    setFotosDevolucao((current) => [...current, ...Array.from(files)]);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append('data_devolucao', dataDevolucao);

      if (observacao.trim()) {
        formData.append('observacao', observacao.trim());
      }

      fotosDevolucao.forEach((file, index) => {
        formData.append(`fotos_equipamento_devolucao[${index}]`, file);
      });

      return equipamentosService.devolverEmprestimo(emprestimoId!, formData);
    },
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Devolução registrada com sucesso.' });
      onOpenChange(false);
    },
    onError: (error) => {
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao registrar devolução.'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={<DialogTitle>Devolver {equipamento?.patrimonio}</DialogTitle>}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={mutation.isPending || !emprestimoId || !dataDevolucao}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Confirmar devolução'
              )}
            </Button>
          </>
        }
      >
        <div className="grid gap-2">
          <Label htmlFor="data-devolucao">Data de devolução</Label>
          <Input
            id="data-devolucao"
            type="date"
            value={dataDevolucao}
            max={todayIsoDate()}
            className="w-full max-w-44"
            onChange={(event) => setDataDevolucao(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A data atual é carregada por padrão, mas pode ser ajustada antes de
            confirmar.
          </p>
          <div className="grid gap-2 pt-2">
            <Label htmlFor="observacao-devolucao">Observação</Label>
            <Textarea
              id="observacao-devolucao"
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              rows={3}
              placeholder="Descreva o estado do equipamento ou alguma ocorrência na devolução."
            />
          </div>
          <div className="grid gap-2 pt-2">
            <Label htmlFor="fotos-devolucao">Imagens da devolução</Label>
            <Input
              id="fotos-devolucao"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                appendFotosDevolucao(event.target.files);
                event.target.value = '';
              }}
            />
            {isMobile ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="size-4" />
                  Tirar foto
                </Button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    appendFotosDevolucao(event.target.files);
                    event.target.value = '';
                  }}
                />
              </>
            ) : null}
            {fotosDevolucao.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {fotosDevolucao.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="truncate">
                    {file.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Você pode selecionar uma ou mais imagens do equipamento no momento da devolução.
              </p>
            )}
          </div>
        </div>
      </EquipamentoDialogShell>
    </Dialog>
  );
}

export function RenovarModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const invalidate = useInvalidateEquipamentos();
  const emprestimoId = equipamento?.emprestimo_ativo?.id;
  const [prazoAdicional, setPrazoAdicional] = useState('7');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (!open) return;
    setPrazoAdicional('7');
    setObservacao('');
  }, [open, equipamento?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      equipamentosService.renovarEmprestimo(emprestimoId!, {
        prazo_adicional_dias: Number(prazoAdicional),
        data_renovacao: todayIsoDate(),
        observacao: observacao || undefined,
      }),
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Empréstimo renovado com sucesso.' });
      onOpenChange(false);
    },
    onError: (error) => {
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao renovar empréstimo.'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={
          <DialogTitle>
            Renovar empréstimo — {equipamento?.patrimonio}
          </DialogTitle>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !emprestimoId ||
                Number(prazoAdicional) < 1
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Renovar'
              )}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Prazo adicional (dias)</Label>
            <Input
              type="number"
              min={1}
              value={prazoAdicional}
              onChange={(e) => setPrazoAdicional(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </EquipamentoDialogShell>
    </Dialog>
  );
}

export function FinalizarManutencaoModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const invalidate = useInvalidateEquipamentos();
  const manutencaoId = equipamento?.manutencao_ativa?.id;

  const mutation = useMutation({
    mutationFn: () =>
      equipamentosService.finalizarManutencao(manutencaoId!, {
        data_saida: todayIsoDate(),
      }),
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Manutenção finalizada.' });
      onOpenChange(false);
    },
    onError: (error) => {
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao finalizar manutenção.'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={
          <DialogTitle>Finalizar — {equipamento?.patrimonio}</DialogTitle>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={mutation.isPending || !manutencaoId}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Finalizar'
              )}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          O equipamento voltará para o estoque após a finalização.
        </p>
      </EquipamentoDialogShell>
    </Dialog>
  );
}

export function HistoricoModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['equipamentos-historico', equipamento?.id],
    queryFn: () =>
      equipamentosService.historico(equipamento!.id, { per_page: 50 }),
    enabled: open && Boolean(equipamento?.id),
  });

  const items = data?.data ?? [];

  return (
    <SidePanelSheet open={open} onOpenChange={onOpenChange}>
      <SidePanelSheetContent width={520}>
        <SidePanelSheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-3 pe-8">
            {equipamento ? (
              <EquipamentoThumbnail
                equipamento={equipamento}
                size="sm"
                previewEnabled
              />
            ) : null}
            <SheetPanelTitle icon={History}>
              Histórico — {equipamento?.patrimonio ?? 'Equipamento'}
            </SheetPanelTitle>
          </div>
        </SidePanelSheetHeader>

        <SidePanelSheetBody>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <History className="mb-2 size-10 opacity-30" />
              <p className="text-sm">Nenhum registro.</p>
            </div>
          ) : (
            <ol className="relative space-y-0 ps-2">
              {items.map((item, index) => (
                <HistoricoTimelineItem
                  key={item.id}
                  item={item}
                  isLast={index === items.length - 1}
                />
              ))}
            </ol>
          )}
        </SidePanelSheetBody>

        <SidePanelSheetFooter>
          <SidePanelSheetActions>
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </SidePanelSheetActions>
        </SidePanelSheetFooter>
      </SidePanelSheetContent>
    </SidePanelSheet>
  );
}

const HISTORICO_EVENTO_COLORS: Record<string, string> = {
  emprestado: 'bg-blue-500',
  devolvido: 'bg-emerald-500',
  renovado: 'bg-indigo-500',
  manutencao_iniciada: 'bg-amber-500',
  manutencao_finalizada: 'bg-emerald-500',
  cadastrado: 'bg-primary',
  baixado: 'bg-zinc-500',
  perdido: 'bg-red-500',
};

function HistoricoTimelineItem({
  item,
  isLast,
}: {
  item: EquipamentoHistoricoItem;
  isLast: boolean;
}) {
  const [fotoViewerOpen, setFotoViewerOpen] = useState(false);
  const [fotoViewerIndex, setFotoViewerIndex] = useState(0);
  const label =
    HISTORICO_EVENTO_LABELS[item.evento] ?? item.evento.replace(/_/g, ' ');
  const date = item.created_at ? new Date(item.created_at) : null;
  const dotColor =
    HISTORICO_EVENTO_COLORS[item.evento] ?? 'bg-muted-foreground';
  const dataDevolucao =
    typeof item.dados?.data_devolucao === 'string'
      ? new Date(`${item.dados.data_devolucao}T00:00:00`)
      : null;
  const observacaoDevolucao =
    typeof item.dados?.observacao === 'string' ? item.dados.observacao : null;
  const fotosDevolucaoUrls = Array.isArray(
    item.dados?.fotos_equipamento_devolucao_urls,
  )
    ? item.dados.fotos_equipamento_devolucao_urls.filter(
        (url): url is string => typeof url === 'string' && url.length > 0,
      )
    : [];

  return (
    <li className="relative flex gap-3 pb-5">
      {!isLast ? (
        <span
          className="absolute start-[0.4rem] top-3 bottom-0 w-px bg-border"
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          'relative z-10 mt-1 size-3 shrink-0 rounded-full ring-4 ring-background',
          dotColor,
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <time className="shrink-0 text-xs font-medium text-muted-foreground">
            {date
              ? date.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                })
              : ''}
          </time>
        </div>
        {item.registrado_por?.name ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Por {item.registrado_por.name}
          </p>
        ) : null}
        {item.evento === 'devolvido' && dataDevolucao ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Data da devolução: {dataDevolucao.toLocaleDateString('pt-BR')}
          </p>
        ) : null}
        {item.evento === 'devolvido' && observacaoDevolucao ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Observação: {observacaoDevolucao}
          </p>
        ) : null}
        {item.evento === 'devolvido' && fotosDevolucaoUrls.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {fotosDevolucaoUrls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => {
                  setFotoViewerIndex(index);
                  setFotoViewerOpen(true);
                }}
                className="block overflow-hidden rounded-md border border-border transition-colors hover:border-primary/40 hover:ring-2 hover:ring-primary/20"
                aria-label={`Ver imagem da devolução ${index + 1}`}
              >
                <img
                  src={url}
                  alt={`Imagem da devolução ${index + 1}`}
                  className="size-14 object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
        {item.observacao ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {item.observacao}
          </p>
        ) : null}
      </div>

      <EquipamentoFotoViewerDialog
        open={fotoViewerOpen}
        onOpenChange={setFotoViewerOpen}
        images={fotosDevolucaoUrls.map((url) => ({ url }))}
        initialIndex={fotoViewerIndex}
        title="Fotos da devolução"
        subtitle={
          dataDevolucao
            ? `Devolvido em ${dataDevolucao.toLocaleDateString('pt-BR')}`
            : null
        }
      />
    </li>
  );
}

export function CadastroEquipamentoModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidateEquipamentos();
  const [patrimonio, setPatrimonio] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [obraId, setObraId] = useState('');
  const [dataEntrada, setDataEntrada] = useState(todayIsoDate());
  const [valorMensal, setValorMensal] = useState('');
  const [isCritico, setIsCritico] = useState(false);
  const [newFotos, setNewFotos] = useState<File[]>([]);
  const [principal, setPrincipal] = useState<EquipamentoFotoPrincipal | null>(
    null,
  );
  const { fieldErrors, clear, clearField, applyApi, setFieldErrors } =
    useEquipamentoFieldErrors();

  const { data: tipos = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'tipos'],
    queryFn: () => equipamentosService.lookupTipos(),
    enabled: open,
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'fornecedores'],
    queryFn: () => equipamentosService.lookupFornecedores(),
    enabled: open,
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'obras'],
    queryFn: () => equipamentosService.lookupObras(),
    enabled: open,
  });

  const tipoOptions = tipos.map((tipo) => ({
    value: String(tipo.id),
    label: tipo.nome,
  }));
  const fornecedorOptions = fornecedores.map((item) => ({
    value: String(item.id),
    label: item.nome,
  }));
  const obraOptions = obras.map((obra) => ({
    value: String(obra.id),
    label: `${obra.codigo ? `${obra.codigo} — ` : ''}${obra.nome}`,
    keywords: obra.codigo ?? undefined,
  }));

  useEffect(() => {
    if (!open) return;
    setPatrimonio('');
    setTipoId('');
    setFornecedorId('');
    setObraId('');
    setDataEntrada(todayIsoDate());
    setValorMensal('');
    setIsCritico(false);
    setNewFotos([]);
    setPrincipal(null);
    clear();
  }, [open, clear]);

  const mutation = useMutation({
    mutationFn: (values: EquipamentoFormValues) => {
      const orderedFotos =
        principal?.type === 'new'
          ? orderFotosWithPrincipalFirst(newFotos, principal.index)
          : newFotos;
      const principalForSubmit =
        principal?.type === 'new' && orderedFotos.length > 0
          ? ({ type: 'new', index: 0 } as const)
          : principal;

      return equipamentosService.store(
        buildEquipamentoStoreFormData({
          patrimonio: values.patrimonio,
          tipo_id: values.tipo_id,
          fornecedor_id: values.fornecedor_id,
          obra_id: values.obra_id,
          valor_mensal: values.valor_mensal,
          data_entrada: values.data_entrada,
          is_critico: values.is_critico,
          fotos: orderedFotos,
          principal: principalForSubmit,
        }),
      );
    },
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Equipamento cadastrado.' });
      onOpenChange(false);
    },
    onError: (error) => {
      if (applyApi(error)) return;
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao cadastrar equipamento.'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    const result = equipamentoFormSchema.safeParse(
      buildEquipamentoFormValues({
        patrimonio,
        tipoId,
        fornecedorId,
        obraId,
        dataEntrada,
        valorMensalDigits: valorMensal,
        isCritico,
      }),
    );

    if (!result.success) {
      setFieldErrors(mapZodFieldErrors(result.error));
      return;
    }

    clear();
    mutation.mutate(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={<DialogTitle>Novo equipamento</DialogTitle>}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={mutation.isPending} onClick={handleSubmit}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Cadastrar'
              )}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <EquipamentoFotosField
            patrimonio={patrimonio || 'Novo'}
            tipoNome={tipos.find((item) => String(item.id) === tipoId)?.nome}
            newFotos={newFotos}
            principal={principal}
            onPrincipalChange={setPrincipal}
            onNewFotosChange={(files) => {
              clearField('foto');
              setNewFotos(files);
            }}
            onRemoveNew={(index) => {
              clearField('foto');
              setNewFotos((current) =>
                current.filter((_, itemIndex) => itemIndex !== index),
              );
            }}
          />
          <FieldMessage message={fieldErrors.foto} />
          <div className="grid gap-2">
            <Label required>Patrimônio</Label>
            <Input
              value={patrimonio}
              onChange={(e) => {
                clearField('patrimonio');
                setPatrimonio(e.target.value);
              }}
              className={fieldErrorClass(Boolean(fieldErrors.patrimonio))}
            />
            <FieldMessage message={fieldErrors.patrimonio} />
          </div>
          <div className="grid gap-2">
            <Label required>Tipo</Label>
            <SearchableSelect
              value={tipoId}
              onValueChange={(value) => {
                clearField('tipo_id');
                setTipoId(value);
              }}
              options={tipoOptions}
              placeholder="Selecione"
              searchPlaceholder="Buscar tipo..."
              className={fieldErrorClass(Boolean(fieldErrors.tipo_id))}
            />
            <FieldMessage message={fieldErrors.tipo_id} />
          </div>
          <div className="grid gap-2">
            <Label required>Fornecedor</Label>
            <SearchableSelect
              value={fornecedorId}
              onValueChange={(value) => {
                clearField('fornecedor_id');
                setFornecedorId(value);
              }}
              options={fornecedorOptions}
              placeholder="Selecione"
              searchPlaceholder="Buscar fornecedor..."
              className={fieldErrorClass(Boolean(fieldErrors.fornecedor_id))}
            />
            <FieldMessage message={fieldErrors.fornecedor_id} />
          </div>
          <div className="grid gap-2">
            <Label required>Obra</Label>
            <SearchableSelect
              value={obraId}
              onValueChange={(value) => {
                clearField('obra_id');
                setObraId(value);
              }}
              options={obraOptions}
              placeholder="Selecione"
              searchPlaceholder="Buscar obra..."
              className={fieldErrorClass(Boolean(fieldErrors.obra_id))}
            />
            <FieldMessage message={fieldErrors.obra_id} />
          </div>
          <EquipamentoCreatedDateField
            id="cadastro-equipamento-created-date"
            value={dataEntrada}
            error={fieldErrors.data_entrada}
            onChange={setDataEntrada}
            onClearError={() => clearField('data_entrada')}
          />
          <div className="grid gap-2">
            <Label required>Valor mensal</Label>
            <MaskedInput
              mask="currency"
              placeholder="R$ 0,00"
              value={valorMensal}
              onChange={(value) => {
                clearField('valor_mensal');
                setValorMensal(value);
              }}
              className={fieldErrorClass(Boolean(fieldErrors.valor_mensal))}
            />
            <FieldMessage message={fieldErrors.valor_mensal} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="cadastro-equipamento-critico"
              className="font-normal"
            >
              Equipamento crítico
            </Label>
            <Switch
              id="cadastro-equipamento-critico"
              checked={isCritico}
              onCheckedChange={setIsCritico}
            />
          </div>
        </div>
      </EquipamentoDialogShell>
    </Dialog>
  );
}

export function EditarEquipamentoModal({
  equipamento,
  open,
  onOpenChange,
}: ModalBaseProps) {
  const invalidate = useInvalidateEquipamentos();
  const [patrimonio, setPatrimonio] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [obraId, setObraId] = useState('');
  const [dataEntrada, setDataEntrada] = useState(todayIsoDate());
  const [valorMensal, setValorMensal] = useState('');
  const [isCritico, setIsCritico] = useState(false);
  const [newFotos, setNewFotos] = useState<File[]>([]);
  const [removedFotoIds, setRemovedFotoIds] = useState<number[]>([]);
  const [principal, setPrincipal] = useState<EquipamentoFotoPrincipal | null>(
    null,
  );
  const [initialPrincipal, setInitialPrincipal] =
    useState<EquipamentoFotoPrincipal | null>(null);
  const { fieldErrors, clear, clearField, applyApi, setFieldErrors } =
    useEquipamentoFieldErrors();

  const { data: tipos = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'tipos'],
    queryFn: () => equipamentosService.lookupTipos(),
    enabled: open,
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'fornecedores'],
    queryFn: () => equipamentosService.lookupFornecedores(),
    enabled: open,
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'obras'],
    queryFn: () => equipamentosService.lookupObras(),
    enabled: open,
  });

  const tipoOptions = tipos.map((tipo) => ({
    value: String(tipo.id),
    label: tipo.nome,
  }));
  const fornecedorOptions = fornecedores.map((item) => ({
    value: String(item.id),
    label: item.nome,
  }));
  const obraOptions = obras.map((obra) => ({
    value: String(obra.id),
    label: `${obra.codigo ? `${obra.codigo} — ` : ''}${obra.nome}`,
    keywords: obra.codigo ?? undefined,
  }));

  useEffect(() => {
    if (!open || !equipamento) return;

    setPatrimonio(equipamento.patrimonio);
    setTipoId(String(equipamento.tipo_id));
    setFornecedorId(String(equipamento.fornecedor_id));
    setObraId(String(equipamento.obra_id));
    setDataEntrada(equipamento.data_entrada);
    setValorMensal(numberToCurrencyDigits(equipamento.valor_mensal));
    setIsCritico(equipamento.is_critico);
    setNewFotos([]);
    setRemovedFotoIds([]);
    const defaultPrincipal = getDefaultEquipamentoPrincipal(
      getEquipamentoExistingFotos(equipamento),
    );
    setPrincipal(defaultPrincipal);
    setInitialPrincipal(defaultPrincipal);
    clear();
  }, [open, equipamento, clear]);

  const mutation = useMutation({
    mutationFn: (values: EquipamentoFormValues) => {
      const orderedFotos =
        principal?.type === 'new'
          ? orderFotosWithPrincipalFirst(newFotos, principal.index)
          : newFotos;
      const principalForSubmit =
        principal?.type === 'new' && orderedFotos.length > 0
          ? ({ type: 'new', index: 0 } as const)
          : principal;
      const payload = {
        patrimonio: values.patrimonio,
        tipo_id: values.tipo_id,
        fornecedor_id: values.fornecedor_id,
        obra_id: values.obra_id,
        data_entrada: values.data_entrada,
        valor_mensal: values.valor_mensal,
        is_critico: values.is_critico,
        fotos: orderedFotos,
        fotos_remover: removedFotoIds,
        principal: principalForSubmit,
      };
      const principalChanged = hasPrincipalChanged(principal, initialPrincipal);
      const needsMultipart =
        orderedFotos.length > 0 ||
        removedFotoIds.length > 0 ||
        principalForSubmit?.type === 'new';

      if (needsMultipart) {
        return equipamentosService.update(
          equipamento!.id,
          buildEquipamentoUpdateFormData(payload),
        );
      }

      return equipamentosService.update(equipamento!.id, {
        patrimonio: values.patrimonio,
        tipo_id: values.tipo_id,
        fornecedor_id: values.fornecedor_id,
        obra_id: values.obra_id,
        data_entrada: values.data_entrada,
        valor_mensal: values.valor_mensal,
        is_critico: values.is_critico,
        ...(principalChanged ? resolvePrincipalPayload(principal) : {}),
      });
    },
    onSuccess: () => {
      invalidate();
      showAppToast({ title: 'Equipamento atualizado.' });
      onOpenChange(false);
    },
    onError: (error) => {
      if (applyApi(error)) return;
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao atualizar equipamento.'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!equipamento) return;

    const result = equipamentoFormSchema.safeParse(
      buildEquipamentoFormValues({
        patrimonio,
        tipoId,
        fornecedorId,
        obraId,
        dataEntrada,
        valorMensalDigits: valorMensal,
        isCritico,
      }),
    );

    if (!result.success) {
      setFieldErrors(mapZodFieldErrors(result.error));
      return;
    }

    clear();
    mutation.mutate(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EquipamentoDialogShell
        header={<DialogTitle>Editar {equipamento?.patrimonio}</DialogTitle>}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={mutation.isPending || !equipamento}
              onClick={handleSubmit}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Salvar'
              )}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {equipamento ? (
            <EquipamentoFotosField
              patrimonio={equipamento.patrimonio}
              tipoNome={equipamento.tipo?.nome}
              existingFotos={getEquipamentoExistingFotos(equipamento)}
              removedFotoIds={removedFotoIds}
              newFotos={newFotos}
              principal={principal}
              onPrincipalChange={setPrincipal}
              onNewFotosChange={(files) => {
                clearField('foto');
                setNewFotos(files);
              }}
              onRemoveExisting={(fotoId) => {
                if (fotoId <= 0) {
                  return;
                }
                clearField('foto');
                setRemovedFotoIds((current) =>
                  current.includes(fotoId) ? current : [...current, fotoId],
                );
              }}
              onRemoveNew={(index) => {
                clearField('foto');
                setNewFotos((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                );
              }}
            />
          ) : null}
          <FieldMessage message={fieldErrors.foto} />
          <div className="grid gap-2">
            <Label required>Patrimônio</Label>
            <Input
              value={patrimonio}
              onChange={(e) => {
                clearField('patrimonio');
                setPatrimonio(e.target.value);
              }}
              className={fieldErrorClass(Boolean(fieldErrors.patrimonio))}
            />
            <FieldMessage message={fieldErrors.patrimonio} />
          </div>
          <div className="grid gap-2">
            <Label required>Tipo</Label>
            <SearchableSelect
              value={tipoId}
              onValueChange={(value) => {
                clearField('tipo_id');
                setTipoId(value);
              }}
              options={tipoOptions}
              placeholder="Selecione"
              searchPlaceholder="Buscar tipo..."
              className={fieldErrorClass(Boolean(fieldErrors.tipo_id))}
            />
            <FieldMessage message={fieldErrors.tipo_id} />
          </div>
          <div className="grid gap-2">
            <Label required>Fornecedor</Label>
            <SearchableSelect
              value={fornecedorId}
              onValueChange={(value) => {
                clearField('fornecedor_id');
                setFornecedorId(value);
              }}
              options={fornecedorOptions}
              placeholder="Selecione"
              searchPlaceholder="Buscar fornecedor..."
              className={fieldErrorClass(Boolean(fieldErrors.fornecedor_id))}
            />
            <FieldMessage message={fieldErrors.fornecedor_id} />
          </div>
          <div className="grid gap-2">
            <Label required>Obra</Label>
            <SearchableSelect
              value={obraId}
              onValueChange={(value) => {
                clearField('obra_id');
                setObraId(value);
              }}
              options={obraOptions}
              placeholder="Selecione"
              searchPlaceholder="Buscar obra..."
              className={fieldErrorClass(Boolean(fieldErrors.obra_id))}
            />
            <FieldMessage message={fieldErrors.obra_id} />
          </div>
          <EquipamentoCreatedDateField
            id="editar-equipamento-created-date"
            value={dataEntrada}
            error={fieldErrors.data_entrada}
            onChange={setDataEntrada}
            onClearError={() => clearField('data_entrada')}
          />
          <div className="grid gap-2">
            <Label required>Valor mensal</Label>
            <MaskedInput
              mask="currency"
              placeholder="R$ 0,00"
              value={valorMensal}
              onChange={(value) => {
                clearField('valor_mensal');
                setValorMensal(value);
              }}
              className={fieldErrorClass(Boolean(fieldErrors.valor_mensal))}
            />
            <FieldMessage message={fieldErrors.valor_mensal} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="editar-equipamento-critico" className="font-normal">
              Equipamento crítico
            </Label>
            <Switch
              id="editar-equipamento-critico"
              checked={isCritico}
              onCheckedChange={setIsCritico}
            />
          </div>
        </div>
      </EquipamentoDialogShell>
    </Dialog>
  );
}
