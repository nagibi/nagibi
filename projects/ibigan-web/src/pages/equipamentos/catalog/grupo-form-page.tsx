import { useCallback, useLayoutEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { z } from 'zod';
import { applyApiFormErrors } from '@/lib/apply-api-form-errors';
import {
  grupoCatalogFormSchema,
  mapGrupoToFormValues,
} from '@/lib/equipamento-catalog-form-schema';
import { focusFirstFormError } from '@/lib/focus-first-form-error';
import { formatFormPageTitle } from '@/lib/format-form-page-title';
import { resolveFormSavePath } from '@/lib/resolve-form-save-path';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { useFormKeyboard } from '@/hooks/use-form-keyboard';
import { useFormPage } from '@/hooks/use-form-page';
import { useFormRefresh } from '@/hooks/use-form-refresh';
import { useFormToolbarAlert } from '@/hooks/use-form-toolbar-alert';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { gruposCatalogService } from '@/services/equipamento-catalog.service';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageBody } from '@/components/common/page-body';
import {
  FormFieldGrid,
  FormFieldGridItem,
} from '@/components/grid/form-field-grid';
import { FormPageSkeleton } from '@/components/grid/form-page-skeleton';
import { FormPanel } from '@/components/grid/form-panel';
import { FormRecordIdField } from '@/components/grid/form-record-identifier';
import { FormToolbar } from '@/components/grid/form-toolbar';

const schema = grupoCatalogFormSchema;
type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  nome: '',
};

export function GrupoFormPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);
  const apiNotify = useApiToolbarAlert();

  const {
    data: grupoData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['equipamentos', 'grupo', id],
    queryFn: () => gruposCatalogService.show(Number(id)),
    enabled: isEditing,
  });

  const grupo = grupoData?.data.result;

  const formPage = useFormPage({
    backPath: '/equipamentos/grupos',
    newPath: '/equipamentos/grupos/new',
    entityLabel: 'Grupo',
    notify: apiNotify,
    onDelete: isEditing
      ? async () => {
          await gruposCatalogService.destroy(Number(id));
          await queryClient.invalidateQueries({ queryKey: ['equipamentos', 'grupos'] });
          await queryClient.invalidateQueries({ queryKey: ['equipamentos-lookups', 'grupos'] });
        }
      : undefined,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useLayoutEffect(() => {
    if (!isEditing || !grupo) return;

    form.reset(mapGrupoToFormValues(grupo), {
      keepDirty: false,
      keepErrors: false,
    });
  }, [isEditing, grupo, form]);

  useLayoutEffect(() => {
    if (!isEditing) {
      form.reset(DEFAULT_VALUES, { keepDirty: false, keepErrors: false });
    }
  }, [isEditing, form, location.key]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { nome: data.nome.trim() };

      return isEditing
        ? gruposCatalogService.update(Number(id), payload)
        : gruposCatalogService.store(payload);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['equipamentos', 'grupos'] });
      await queryClient.invalidateQueries({ queryKey: ['equipamentos-lookups', 'grupos'] });

      if (isEditing) {
        await queryClient.invalidateQueries({ queryKey: ['equipamentos', 'grupo', id] });
      }

      const createdId = !isEditing ? response.data.result.id : undefined;
      const nextPath = resolveFormSavePath({
        saveMode: formPage.saveMode,
        listPath: '/equipamentos/grupos',
        newPath: '/equipamentos/grupos/new',
        getEditPath: (recordId) => `/equipamentos/grupos/${recordId}`,
        isEditing,
        createdId,
      });
      if (nextPath) navigate(nextPath);
    },
    onError: (error: unknown) => {
      const handled = applyApiFormErrors(form, error);
      if (handled) {
        focusFirstFormError(form);
        return;
      }
      apiNotify.showError(
        isEditing ? 'Erro ao atualizar grupo.' : 'Erro ao criar grupo.',
        error,
      );
    },
  });

  const handleSaveAndList = useCallback(() => {
    formPage.setSaveMode('list');
    void form.handleSubmit((data) => saveMutation.mutate(data))();
  }, [form, formPage, saveMutation]);

  const handleSaveAndNew = useCallback(() => {
    formPage.setSaveMode('new');
    void form.handleSubmit((data) => saveMutation.mutate(data))();
  }, [form, formPage, saveMutation]);

  const handleSaveAndEdit = useCallback(() => {
    formPage.setSaveMode('edit');
    void form.handleSubmit((data) => saveMutation.mutate(data))();
  }, [form, formPage, saveMutation]);

  useFormKeyboard({
    enabled: !isEditing || !isLoading,
    onSave: handleSaveAndList,
    isSubmitting: saveMutation.isPending,
  });

  const formAlert = useFormToolbarAlert(form);
  const formRefresh = useFormRefresh({
    isEditing,
    isDirty: form.formState.isDirty,
    isFetching: isEditing && isFetching,
    refetch: isEditing ? () => void refetch() : undefined,
  });

  const pageTitle = formatFormPageTitle({
    isEditing,
    id,
    label: grupo?.nome,
    loading: isEditing && isLoading,
  });

  usePageToolbar({
    title: pageTitle,
    alert: formAlert,
    breadcrumbs: [
      { title: 'Equipamentos', path: '/equipamentos' },
      { title: 'Grupos', path: '/equipamentos/grupos' },
      { title: pageTitle },
    ],
    actions: (
      <FormToolbar
        isEditing={isEditing}
        isDirty={form.formState.isDirty}
        isSubmitting={saveMutation.isPending}
        isDeleting={formPage.isDeleting}
        onSaveAndList={handleSaveAndList}
        onSaveAndNew={handleSaveAndNew}
        onSaveAndEdit={handleSaveAndEdit}
        onBack={formPage.handleBack}
        onClear={() =>
          form.reset(DEFAULT_VALUES, { keepDirty: false, keepErrors: false })
        }
        onRefresh={formRefresh.onRefresh}
        isRefreshing={formRefresh.isRefreshing}
        onDelete={isEditing ? formPage.handleDelete : undefined}
        entityLabel="grupo"
        recordLabel={grupo?.nome}
      />
    ),
  });

  if (isEditing && isLoading) {
    return (
      <FormPageSkeleton panels={[{ titleWidth: 'w-32', fields: 1, showBadge: false }]} />
    );
  }

  const tipos = grupo?.tipos ?? [];

  return (
    <PageBody>
      <Form {...form}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSaveAndList();
          }}
          className="space-y-4"
        >
          <FormPanel title="Informações básicas">
            <FormFieldGrid columns={12}>
              {isEditing ? (
                <FormFieldGridItem md={3}>
                  <FormRecordIdField id={grupo!.id} />
                </FormFieldGridItem>
              ) : null}

              <FormFieldGridItem md={isEditing ? 9 : 12}>
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do grupo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormFieldGridItem>
            </FormFieldGrid>
          </FormPanel>

          {isEditing && tipos.length > 0 ? (
            <FormPanel title={`Tipos vinculados (${tipos.length})`}>
              <ul className="space-y-2">
                {tipos.map((tipo) => (
                  <li key={tipo.id}>
                    <Link
                      to={`/equipamentos/tipos/${tipo.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {tipo.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </FormPanel>
          ) : null}
        </form>
      </Form>
    </PageBody>
  );
}
