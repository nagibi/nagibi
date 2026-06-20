import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { NOTIFICATION_PREFERENCES_TITLE } from '@/lib/notification-preferences-path';
import { useNotificationPreferencesSheet } from '@/providers/notification-preferences-sheet-provider';
import { Bell, Camera, ChevronRight, LoaderCircle, Trash2 } from 'lucide-react';
import { applyApiFormErrors } from '@/lib/apply-api-form-errors';
import {
  mapUserProfileToFormValues,
  normalizeUserProfilePayload,
  userProfileSchema,
  type UserProfileFormData,
} from '@/lib/user-profile-fields';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { useApiMenuByPath } from '@/hooks/use-api-menu-by-path';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useFormKeyboard } from '@/hooks/use-form-keyboard';
import { useFormRefresh } from '@/hooks/use-form-refresh';
import { useFormToolbarAlert } from '@/hooks/use-form-toolbar-alert';
import { focusFirstFormError, validateFormWithFocus } from '@/lib/focus-first-form-error';
import { useCentralOnlySession } from '@/hooks/use-central-only-session';
import { useImpersonate } from '@/hooks/use-impersonate';
import { authService } from '@/services/auth.service';
import { adminTenantsService, type AdminTenant } from '@/services/admin-tenants.service';
import { profileService, type Profile } from '@/services/profile.service';
import { useTenantSwitch } from '@/hooks/use-tenant-switch';
import { useAuthStore } from '@/stores/auth.store';
import { useCentralAuthStore } from '@/stores/central-auth.store';
import { getInitials } from '@/lib/helpers';
import { resolveMenuIcon } from '@/lib/menu-icons';
import { SecurityContent } from '@/components/security/security-content';
import { UserProfileFields } from '@/components/profile/user-profile-fields';
import { AvatarCropDialog } from '@/components/profile/avatar-crop-dialog';
import { PageBody } from '@/components/common/page-body';
import { FormToolbar } from '@/components/grid/form-toolbar';
import { FormFieldGrid, FormFieldGridItem } from '@/components/grid/form-field-grid';
import { FormPanel } from '@/components/grid/form-panel';
import {
  AppearanceSettingsPanel,
  useAppearanceSettings,
} from '@/components/settings/appearance-settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { ProfileTenantSelect } from '@/components/profile/profile-tenant-select';
import { ProfilePageSkeleton } from '@/pages/profile/profile-page-skeleton';

const USER_PROFILE_FALLBACK = {
  name: '',
  email: '',
  cpf: '',
  phone: '',
  birth_date: '',
  gender: '' as const,
  bio: '',
};

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Senha atual é obrigatória.'),
  password: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres.'),
  password_confirmation: z.string(),
}).refine((d) => d.password === d.password_confirmation, {
  message: 'As senhas não coincidem.',
  path: ['password_confirmation'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

type ProfileTenantItem = {
  id: string;
  name: string | null;
  slug: string;
};

export function ProfilePage() {
  const queryClient = useQueryClient();
  const isCentralOnly = useCentralOnlySession();
  const centralToken = useCentralAuthStore((state) => state.centralToken);
  const centralUser = useCentralAuthStore((state) => state.centralUser);
  const setCentralAuth = useCentralAuthStore((state) => state.setCentralAuth);
  const { open: openPreferences } = useNotificationPreferencesSheet();
  const profileMenu = useApiMenuByPath('/profile');
  const notificationsMenu = useApiMenuByPath('/notifications');
  const notificationPreferencesMenu = useApiMenuByPath('/notification-preferences');
  const { user, setAuth, tenantId, token } = useAuthStore();
  const { switchToTenant, switchingId } = useTenantSwitch();
  const { impersonate, impersonatingId } = useImpersonate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const appearance = useAppearanceSettings();
  const apiNotify = useApiToolbarAlert();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileService.show(),
  });

  const { data: centralTenantsData, isLoading: isLoadingCentralTenants } = useQuery({
    queryKey: ['profile-tenants', 'central'],
    queryFn: () => adminTenantsService.list(1, 100),
    enabled: isCentralOnly,
    staleTime: 5 * 60 * 1000,
  });

  const { data: userTenantsData, isLoading: isLoadingUserTenants } = useQuery({
    queryKey: ['profile-tenants', 'tenant'],
    queryFn: () => authService.listTenants(),
    enabled: !isCentralOnly,
    staleTime: 5 * 60 * 1000,
  });

  const isLoadingTenants = isCentralOnly ? isLoadingCentralTenants : isLoadingUserTenants;

  const profile = data?.data.result as Profile | undefined;

  const tenants = useMemo<ProfileTenantItem[]>(() => {
    if (isCentralOnly) {
      const result = centralTenantsData?.data.result;
      if (!result) return [];

      return result.data.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      }));
    }

    return userTenantsData?.data.result ?? [];
  }, [isCentralOnly, centralTenantsData, userTenantsData]);

  const adminTenantsById = useMemo(() => {
    if (!isCentralOnly) return new Map<string, AdminTenant>();

    const result = centralTenantsData?.data.result;
    if (!result) return new Map<string, AdminTenant>();

    return new Map(result.data.map((tenant) => [tenant.id, tenant]));
  }, [isCentralOnly, centralTenantsData]);

  const NotificationsIcon = notificationsMenu
    ? resolveMenuIcon({
      icon: notificationsMenu.icon,
      path: notificationsMenu.path,
      slug: notificationsMenu.slug,
      title: notificationsMenu.title,
    })
    : Bell;

  const NotificationPreferencesIcon = notificationPreferencesMenu
    ? resolveMenuIcon({
      icon: notificationPreferencesMenu.icon,
      path: notificationPreferencesMenu.path,
      slug: notificationPreferencesMenu.slug,
      title: notificationPreferencesMenu.title,
    })
    : Bell;

  const profileForm = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: USER_PROFILE_FALLBACK,
  });

  useEffect(() => {
    if (!profile) return;

    profileForm.reset(mapUserProfileToFormValues(profile), {
      keepDirty: false,
      keepErrors: false,
      keepTouched: false,
    });
  }, [profile, profileForm]);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '', password: '', password_confirmation: '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (formData: UserProfileFormData) =>
      profileService.update(normalizeUserProfilePayload(formData)),
    onSuccess: (res) => {
      const result = res.data.result;
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      if (isCentralOnly && centralToken && centralUser) {
        setCentralAuth(centralToken, {
          id: result.id,
          name: result.name,
          email: result.email,
          is_super_admin: centralUser.is_super_admin,
        });
      } else if (token && tenantId && user) {
        setAuth(token, tenantId, {
          ...user,
          name: result.name,
          email: result.email,
        });
      }

      profileForm.reset(mapUserProfileToFormValues(result), {
        keepDirty: false,
        keepErrors: false,
        keepTouched: false,
      });
      apiNotify.showSuccess('Perfil atualizado!');
    },
    onError: (error: unknown) => {
      const handled = applyApiFormErrors(profileForm, error);
      if (handled) {
        focusFirstFormError(profileForm);
        return;
      }
      apiNotify.showError('Erro ao atualizar perfil.', error);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (formData: PasswordFormData) =>
      profileService.updatePassword({
        current_password: formData.current_password,
        password: formData.password,
        password_confirmation: formData.password_confirmation,
      }),
    onSuccess: () => {
      passwordForm.reset();
      apiNotify.showSuccess('Senha alterada!');
    },
    onError: (error: unknown) => {
      const handled = applyApiFormErrors(passwordForm, error);
      if (handled) {
        focusFirstFormError(passwordForm);
        return;
      }
      apiNotify.showError('Senha atual incorreta.', error);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: (res) => {
      queryClient.setQueryData(['profile'], res);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setAvatarPreview(null);
      apiNotify.showSuccess('Avatar atualizado!');
    },
    onError: (error: unknown) => {
      apiNotify.showError('Erro ao enviar avatar.', error);
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => profileService.deleteAvatar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setAvatarPreview(null);
      apiNotify.showSuccess('Avatar removido!');
    },
    onError: (error: unknown) => {
      apiNotify.showError('Erro ao remover avatar.', error);
    },
  });

  const { isDirty: profileIsDirty } = useFormState({ control: profileForm.control });
  const passwordValues = passwordForm.watch();
  const passwordHasUnsavedChanges = Boolean(
    passwordValues.current_password?.trim()
    || passwordValues.password?.trim()
    || passwordValues.password_confirmation?.trim(),
  );
  const profileHasUnsavedChanges = profileIsDirty;

  const resetProfilePhantomDirty = useCallback(() => {
    if (!profile) return;

    profileForm.reset(mapUserProfileToFormValues(profile), {
      keepDirty: false,
      keepErrors: false,
      keepTouched: false,
    });
  }, [profile, profileForm]);

  const resetPasswordPhantomDirty = useCallback(() => {
    passwordForm.reset(
      { current_password: '', password: '', password_confirmation: '' },
      { keepDirty: false, keepErrors: false, keepTouched: false },
    );
  }, [passwordForm]);

  const handleSave = useCallback(async () => {
    const appearanceDirty = appearance.hasChanges;

    if (!profileHasUnsavedChanges && !passwordHasUnsavedChanges && !appearanceDirty) {
      return;
    }

    if (profileHasUnsavedChanges) {
      const profileValid = await validateFormWithFocus(profileForm);
      if (!profileValid) return;
    }

    if (passwordHasUnsavedChanges) {
      const passwordValid = await validateFormWithFocus(passwordForm);
      if (!passwordValid) return;
    }

    if (profileHasUnsavedChanges) {
      await updateMutation.mutateAsync(profileForm.getValues());
    }

    if (passwordHasUnsavedChanges) {
      await passwordMutation.mutateAsync(passwordForm.getValues());
    }

    if (appearanceDirty) {
      await appearance.save();
    }
  }, [
    appearance,
    passwordForm,
    passwordHasUnsavedChanges,
    passwordMutation,
    profileForm,
    profileHasUnsavedChanges,
    updateMutation,
  ]);

  const profileAlert = useFormToolbarAlert(profileForm, {
    resetPhantomDirty: resetProfilePhantomDirty,
  });
  const passwordAlert = useFormToolbarAlert(passwordForm, {
    resetPhantomDirty: resetPasswordPhantomDirty,
  });

  const alert = profileAlert ?? passwordAlert ?? null;

  const isDirty =
    profileHasUnsavedChanges
    || passwordHasUnsavedChanges
    || appearance.hasChanges;
  const isSubmitting =
    updateMutation.isPending
    || passwordMutation.isPending
    || appearance.isSaving;

  const formRefresh = useFormRefresh({
    isEditing: true,
    isDirty,
    isFetching,
    refetch: () => refetch(),
  });

  useFormKeyboard({
    enabled: !isLoading,
    onSave: () => void handleSave(),
    isSubmitting,
  });

  usePageToolbar({
    title: profileMenu?.title ?? 'Meu perfil',
    alert,
    actions: (
      <FormToolbar
        isEditing
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        onSaveAndList={() => void handleSave()}
        onRefresh={formRefresh.onRefresh}
        isRefreshing={formRefresh.isRefreshing}
        entityLabel="perfil"
        recordLabel={profile?.name}
      />
    ),
  });

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc);
      }
    };
  }, [avatarPreview, cropImageSrc]);

  function resetCropState() {
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
    }
    setCropImageSrc(null);
    setPendingAvatarFile(null);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    resetCropState();
    setCropImageSrc(URL.createObjectURL(file));
    setPendingAvatarFile(file);
    setCropDialogOpen(true);
  }

  function handleCropDialogOpenChange(open: boolean) {
    setCropDialogOpen(open);
    if (!open) {
      resetCropState();
    }
  }

  function handleCropConfirm(file: File, previewUrl: string) {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarPreview(previewUrl);
    setCropDialogOpen(false);
    resetCropState();

    avatarMutation.mutate(file, {
      onError: () => {
        URL.revokeObjectURL(previewUrl);
        setAvatarPreview(null);
      },
    });
  }

  function handleTenantClick(tenant: ProfileTenantItem) {
    if (isCentralOnly) {
      const adminTenant = adminTenantsById.get(tenant.id);
      if (adminTenant) {
        void impersonate(adminTenant);
      }
      return;
    }

    void switchToTenant(tenant.id);
  }

  const tenantActionPendingId = isCentralOnly ? impersonatingId : switchingId;

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  return (
    <PageBody>
      <FormPanel title="Foto do perfil">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="size-20">
              <AvatarImage src={avatarPreview ?? profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                {getInitials(profile?.name ?? '', 2)}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              mode="icon"
              size="sm"
              className="absolute -bottom-1 -right-1 size-7 rounded-full"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarMutation.isPending || cropDialogOpen}
            >
              {avatarMutation.isPending
                ? <LoaderCircle className="size-3 animate-spin" />
                : <Camera className="size-3" />
              }
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">{profile?.name}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <div className="mt-1 flex gap-1">
              {profile?.roles?.map((role) => (
                <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
              ))}
            </div>
          </div>
          {profile?.avatar_url && (
            <Button
              variant="ghost"
              size="sm"
              className="size-8 shrink-0 px-0 text-destructive hover:text-destructive sm:h-7 sm:w-auto sm:px-2.5"
              aria-label="Remover foto"
              onClick={() => deleteAvatarMutation.mutate()}
              disabled={deleteAvatarMutation.isPending}
            >
              {deleteAvatarMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              <span className="hidden sm:inline">Remover foto</span>
            </Button>
          )}
        </div>
      </FormPanel>

      <Form {...profileForm}>
        <form
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <FormPanel title="Dados pessoais">
            <FormFieldGrid>
              <UserProfileFields control={profileForm.control} />
            </FormFieldGrid>
          </FormPanel>
        </form>
      </Form>

      <FormPanel title="Empresas">
        {tenants.length === 0 && !isLoadingTenants ? (
          <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada à sua conta.</p>
        ) : (
          <ProfileTenantSelect
            tenants={tenants}
            currentTenantId={isCentralOnly ? null : tenantId}
            pendingTenantId={tenantActionPendingId}
            loading={isLoadingTenants}
            onSelect={handleTenantClick}
          />
        )}
      </FormPanel>

      <FormPanel title="Notificações">
        <div className="space-y-2">
          <Link
            to="/notifications"
            className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary hover:bg-muted/50"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <NotificationsIcon className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {notificationsMenu?.title ?? 'Minhas notificações'}
              </p>
              <p className="text-xs text-muted-foreground">Ver e gerenciar notificações recebidas.</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={openPreferences}
            className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-muted/50"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <NotificationPreferencesIcon className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {notificationPreferencesMenu?.title ?? NOTIFICATION_PREFERENCES_TITLE}
              </p>
              <p className="text-xs text-muted-foreground">Configurar canais e tipos de alerta.</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </FormPanel>

      <AppearanceSettingsPanel state={appearance} />

      <Form {...passwordForm}>
        <form
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <FormPanel title="Alterar senha">
            <FormFieldGrid columns={3}>
              <FormFieldGridItem columns={3}>
                <FormField control={passwordForm.control} name="current_password" render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Senha atual</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Sua senha atual" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </FormFieldGridItem>
              <FormFieldGridItem columns={3}>
                <FormField control={passwordForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </FormFieldGridItem>
              <FormFieldGridItem columns={3}>
                <FormField control={passwordForm.control} name="password_confirmation" render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Repita a nova senha" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </FormFieldGridItem>
            </FormFieldGrid>
          </FormPanel>
        </form>
      </Form>

      <SecurityContent />

      <AvatarCropDialog
        open={cropDialogOpen}
        imageSrc={cropImageSrc}
        sourceFile={pendingAvatarFile}
        onOpenChange={handleCropDialogOpenChange}
        onConfirm={handleCropConfirm}
        isUploading={avatarMutation.isPending}
      />
    </PageBody>
  );
}
