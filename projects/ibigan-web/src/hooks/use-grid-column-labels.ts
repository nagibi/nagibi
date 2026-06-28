import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export function useGridColumnLabels() {
  const { t } = useTranslation();

  return useMemo(() => ({
    select: '#',
    id: t('columns.id'),
    actions: t('columns.actions'),
    active: t('columns.active'),
    search: t('columns.search'),
    createdAt: t('columns.created_at'),
    registrationDate: t('columns.registration_date'),
    createdBy: t('columns.created_by'),
    updatedAt: t('columns.updated_at'),
    updatedBy: t('columns.updated_by'),
    all: t('common.all'),
    edit: t('common.view'),
    remove: t('common.remove'),
  }), [t]);
}
