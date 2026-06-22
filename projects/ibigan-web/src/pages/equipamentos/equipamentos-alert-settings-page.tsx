import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import {
  equipamentosAlertSettingsService,
  type AlertSettingsMap,
} from '@/services/equipamentos-alert-settings.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaskedInput } from '@/components/ui/masked-input';
import { PageBody } from '@/components/common/page-body';

const schema = z.object({
  equipment_idle_days: z.coerce.number().int().min(0),
  equipment_unused_since_registration_days: z.coerce.number().int().min(0),
  equipment_minimum_stock: z.coerce.number().int().min(0),
  maintenance_overdue_days: z.coerce.number().int().min(0),
  maintenance_frequency_threshold: z.coerce.number().int().min(0),
  maintenance_frequency_months: z.coerce.number().int().min(1),
  maintenance_cost_threshold: z.coerce.number().min(0),
  site_idle_equipment_threshold: z.coerce.number().int().min(0),
  site_overdue_equipment_threshold: z.coerce.number().int().min(0),
  site_high_cost_threshold: z.coerce.number().min(0),
  employee_overload_multiplier: z.coerce.number().min(1),
  employee_long_possession_days: z.coerce.number().int().min(0),
  max_renovacoes_recomendadas: z.coerce.number().int().min(0),
  loan_due_soon_days: z.coerce.number().int().min(0),
});

type FormValues = z.infer<typeof schema>;

type SettingsResponse = AlertSettingsMap;

type FieldConfig = {
  key: keyof FormValues;
  label: string;
  description: string;
  suffix?: string;
  step?: string;
  isCurrency?: boolean; // Nova flag para identificar campos monetários
};

type GroupConfig = {
  title: string;
  fields: FieldConfig[];
};

const GROUPS: GroupConfig[] = [
  {
    title: 'Estoque',
    fields: [
      {
        key: 'equipment_idle_days',
        label: 'Equipamento parado',
        description: 'Dias sem uso para considerar um equipamento ocioso.',
        suffix: 'dias',
      },
      {
        key: 'equipment_unused_since_registration_days',
        label: 'Cadastrado sem utilização',
        description:
          'Dias após o cadastro sem nenhuma movimentação registrada.',
        suffix: 'dias',
      },
      {
        key: 'equipment_minimum_stock',
        label: 'Estoque abaixo do mínimo',
        description: 'Quantidade mínima disponível por tipo de equipamento.',
        suffix: 'unidades',
      },
    ],
  },
  {
    title: 'Empréstimos',
    fields: [
      {
        key: 'loan_due_soon_days',
        label: 'Próximo do vencimento',
        description: 'Dias de antecedência para avisar antes do vencimento.',
        suffix: 'dias',
      },
      {
        key: 'max_renovacoes_recomendadas',
        label: 'Excesso de renovações',
        description: 'Quantidade de renovações a partir da qual alertar.',
        suffix: 'renovações',
      },
    ],
  },
  {
    title: 'Manutenção',
    fields: [
      {
        key: 'maintenance_overdue_days',
        label: 'Manutenção atrasada',
        description: 'Dias em manutenção além do prazo previsto.',
        suffix: 'dias',
      },
      {
        key: 'maintenance_frequency_threshold',
        label: 'Excesso de manutenções',
        description: 'Quantidade de manutenções no período para alertar.',
        suffix: 'manutenções',
      },
      {
        key: 'maintenance_frequency_months',
        label: 'Período de referência',
        description:
          'Janela de meses considerada para o excesso de manutenções.',
        suffix: 'meses',
      },
      {
        key: 'maintenance_cost_threshold',
        label: 'Custo elevado de manutenção',
        description: 'Valor acumulado no período a partir do qual alertar.',
        suffix: 'R$',
        isCurrency: true, // Configurado como moeda
      },
    ],
  },
  {
    title: 'Obras',
    fields: [
      {
        key: 'site_idle_equipment_threshold',
        label: 'Equipamentos ociosos na obra',
        description:
          'Quantidade de equipamentos parados na mesma obra para alertar.',
        suffix: 'equipamentos',
      },
      {
        key: 'site_overdue_equipment_threshold',
        label: 'Muitos vencimentos na obra',
        description:
          'Quantidade de empréstimos vencidos na mesma obra para alertar.',
        suffix: 'empréstimos',
      },
      {
        key: 'site_high_cost_threshold',
        label: 'Custo elevado na obra',
        description: 'Custo mensal de equipamentos acima do qual alertar.',
        suffix: 'R$',
        isCurrency: true, // Configurado como moeda
      },
    ],
  },
  {
    title: 'Colaboradores',
    fields: [
      {
        key: 'employee_overload_multiplier',
        label: 'Excesso de equipamentos',
        description: 'Múltiplo da média da empresa para considerar sobrecarga.',
        suffix: 'x',
        step: '0.1',
      },
      {
        key: 'employee_long_possession_days',
        label: 'Maior tempo médio de posse',
        description: 'Média de dias de posse acima da qual alertar.',
        suffix: 'dias',
      },
    ],
  },
];

const ALL_KEYS = GROUPS.flatMap((g) => g.fields.map((f) => f.key));

async function fetchSettings(): Promise<SettingsResponse> {
  const { data } = await equipamentosAlertSettingsService.show();
  return data.result;
}

async function saveSettings(values: FormValues): Promise<SettingsResponse> {
  const { data } = await equipamentosAlertSettingsService.update(values);
  return data.result;
}

async function resetSetting(key: string): Promise<SettingsResponse> {
  const { data } = await equipamentosAlertSettingsService.reset(key);
  return data.result;
}

export default function EquipamentosAlertSettingsPage() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useApiToolbarAlert();

  const { data, isLoading } = useQuery({
    queryKey: ['equipamento', 'alert-settings'],
    queryFn: fetchSettings,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      ALL_KEYS.map((k) => [k, 0]),
    ) as FormValues,
  });

  useEffect(() => {
    if (!data) return;
    const values = Object.fromEntries(
      ALL_KEYS.map((key) => [key, data[key]?.value ?? 0]),
    ) as FormValues;
    form.reset(values);
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      showSuccess('Configurações de alertas atualizadas.');
      queryClient.invalidateQueries({
        queryKey: ['equipamento', 'alert-settings'],
      });
    },
    onError: (error) => {
      showError('Erro ao salvar configurações.', error);
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetSetting,
    onSuccess: () => {
      showSuccess('Restaurado para o valor padrão.');
      queryClient.invalidateQueries({
        queryKey: ['equipamento', 'alert-settings'],
      });
    },
    onError: (error) => {
      showError('Erro ao restaurar valor padrão.', error);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    saveMutation.mutate(values);
  });

  usePageToolbar({
    title: 'Configurações de alertas',
    description:
      'Ajuste os limites que disparam os alertas e notificações do Equipamento para a sua empresa.',
    actions: (
      <Button
        type="submit"
        form="equipamento-alert-settings-form"
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    ),
  });

  if (isLoading) {
    return (
      <PageBody>
        <div className="p-6 text-sm text-muted-foreground">
          Carregando configurações…
        </div>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <form
        id="equipamento-alert-settings-form"
        onSubmit={onSubmit}
        autoComplete="off"
      >
        {GROUPS.map((group) => (
          <section key={group.title} className="space-y-4">
            <h2 className="text-sm mt-4 font-semibold text-muted-foreground">
              {group.title}
            </h2>
            <div className="space-y-4 rounded-lg border p-4">
              {group.fields.map((field) => {
                const entry = data?.[field.key];
                const isOverride = entry?.is_override ?? false;

                return (
                  <div
                    key={field.key}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="flex-1">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <p className="text-xs text-muted-foreground">
                        {field.description}
                      </p>
                      {isOverride && (
                        <button
                          type="button"
                          className="mt-1 text-xs text-blue-600 hover:underline"
                          onClick={() => resetMutation.mutate(field.key)}
                        >
                          Restaurar padrão ({entry?.default})
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Controller
                        control={form.control}
                        name={field.key}
                        render={({ field: rhfField }) =>
                          field.isCurrency ? (
                            <MaskedInput
                              id={field.key}
                              mask="currency"
                              placeholder="R$ 0,00"
                              className="w-36 text-right"
                              value={rhfField.value}
                              // Garante que o RHF capture as mudanças numéricas se o componente expuser onValueChange ou similar,
                              // caso contrário o onChange padrão do componente resolve se ele já tratar o valor interno.
                              onChange={rhfField.onChange}
                              onBlur={rhfField.onBlur}
                            />
                          ) : (
                            <Input
                              id={field.key}
                              type="number"
                              step={field.step ?? '1'}
                              className="w-28 text-right"
                              {...rhfField}
                            />
                          )
                        }
                      />
                      {field.suffix && (
                        <span className="w-20 text-xs text-muted-foreground">
                          {field.suffix}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </form>
    </PageBody>
  );
}
