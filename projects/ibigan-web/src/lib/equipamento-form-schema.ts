import { z } from 'zod';
import { currencyDigitsToNumber } from '@/lib/brazilian-masks';
import { todayIsoDate } from '@/lib/equipamento-utils';
import { zRequiredId, zRequiredString } from '@/lib/zod-validators';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const equipamentoFormSchema = z.object({
  patrimonio: zRequiredString('Patrimônio', 50),
  tipo_id: zRequiredId('Tipo'),
  fornecedor_id: zRequiredId('Fornecedor'),
  obra_id: zRequiredId('Obra'),
  data_entrada: z
    .string()
    .min(1, 'Data de cadastro é obrigatória.')
    .refine((value) => isoDatePattern.test(value), 'Data de cadastro inválida.')
    .refine((value) => value <= todayIsoDate(), 'A data de cadastro não pode ser no futuro.'),
  valor_mensal: z
    .number({ invalid_type_error: 'Valor mensal é obrigatório.' })
    .min(0.01, 'Valor mensal é obrigatório.'),
  is_critico: z.boolean(),
});

export type EquipamentoFormValues = z.infer<typeof equipamentoFormSchema>;

export function parseEquipamentoValorMensal(digits: string): number {
  const amount = currencyDigitsToNumber(digits);
  return Number.isNaN(amount) ? 0 : amount;
}

export function buildEquipamentoFormValues(input: {
  patrimonio: string;
  tipoId: string;
  fornecedorId: string;
  obraId: string;
  dataEntrada: string;
  valorMensalDigits: string;
  isCritico: boolean;
}): EquipamentoFormValues {
  return {
    patrimonio: input.patrimonio,
    tipo_id: Number(input.tipoId),
    fornecedor_id: Number(input.fornecedorId),
    obra_id: Number(input.obraId),
    data_entrada: input.dataEntrada,
    valor_mensal: parseEquipamentoValorMensal(input.valorMensalDigits),
    is_critico: input.isCritico,
  };
}
