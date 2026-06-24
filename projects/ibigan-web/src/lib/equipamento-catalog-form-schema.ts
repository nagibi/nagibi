import { z } from 'zod';
import type { Fornecedor, GrupoEquipamento, Obra, TipoEquipamentoCatalog } from '@/types/equipamento-catalog';
import { zOptionalEmail, zRequiredSelectId, zRequiredString } from '@/lib/zod-validators';

export const grupoCatalogFormSchema = z.object({
  nome: zRequiredString('Nome', 255),
});

export function mapGrupoToFormValues(grupo: GrupoEquipamento) {
  return {
    nome: grupo.nome,
  };
}

export const obraCatalogFormSchema = z.object({
  codigo: zRequiredString('Código', 50),
  nome: zRequiredString('Nome', 255),
  endereco: z.string().trim().max(255, 'Máximo de 255 caracteres.').optional(),
  responsavel_user_id: z.string().optional(),
});

export function mapObraToFormValues(obra: Obra) {
  return {
    codigo: obra.codigo,
    nome: obra.nome ?? '',
    endereco: obra.endereco ?? '',
    responsavel_user_id: obra.responsavel_user_id
      ? String(obra.responsavel_user_id)
      : '',
  };
}

export const fornecedorCatalogFormSchema = z.object({
  nome: zRequiredString('Nome', 255),
  cnpj: z.string().max(14).optional(),
  telefone: z.string().max(11).optional(),
  email: zOptionalEmail(),
  contato_responsavel: z.string().trim().max(150, 'Máximo de 150 caracteres.').optional(),
});

export function mapFornecedorToFormValues(fornecedor: Fornecedor) {
  return {
    nome: fornecedor.nome,
    cnpj: fornecedor.cnpj ?? '',
    telefone: fornecedor.telefone ?? '',
    email: fornecedor.email ?? '',
    contato_responsavel: fornecedor.contato_responsavel ?? '',
  };
}

export const tipoCatalogFormSchema = z.object({
  nome: zRequiredString('Nome', 255),
  grupo_id: zRequiredSelectId('Grupo'),
});

export function resolveTipoGrupoId(tipo: {
  grupo_id?: number | string | null;
  grupo?: { id?: number | string; nome: string } | null;
}): number {
  const relationId = Number(tipo.grupo?.id);
  if (relationId > 0) return relationId;

  const fieldId = Number(tipo.grupo_id);
  if (fieldId > 0) return fieldId;

  return 0;
}

export function mapTipoToFormValues(tipo: TipoEquipamentoCatalog) {
  const grupoId = resolveTipoGrupoId(tipo);

  return {
    nome: tipo.nome,
    grupo_id: grupoId > 0 ? String(grupoId) : '',
  };
}
