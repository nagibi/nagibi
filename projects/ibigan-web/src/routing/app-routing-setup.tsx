import { ActivityLogsPage } from '@/pages/activity-logs/activity-logs-page';
import { AdminDevToolsPage } from '@/pages/admin/admin-devtools-page';
import { CentralUserFormPage } from '@/pages/admin/central-user-form-page';
import { CentralUsersPage } from '@/pages/admin/central-users-page';
import { AdminTenantFormPage } from '@/pages/admin/tenant-form-page';
import { AdminTenantsPage } from '@/pages/admin/tenants-page';
import { TranslationsTenantPickerPage } from '@/pages/admin/translations-tenant-picker-page';
import { CallbackPage } from '@/pages/auth/callback-page';
import { CentralCallbackPage } from '@/pages/auth/central-callback-page';
import { CentralLoginPage } from '@/pages/auth/central-login-page';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page';
import { InvitePage } from '@/pages/auth/invite-page';
import { LoginPage } from '@/pages/auth/login-page';
import { RegisterPage } from '@/pages/auth/register-page';
import { TenantSelectPage } from '@/pages/auth/tenant-select-page';
import { TwoFactorPage } from '@/pages/auth/two-factor-page';
import { CampaignFormPage } from '@/pages/campaigns/campaign-form-page';
import { CampaignIdPage } from '@/pages/campaigns/campaign-id-page';
import { CampaignsPage } from '@/pages/campaigns/campaigns-page';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { SystemDocsPage } from '@/pages/docs/system-docs-page';
import { FornecedorFormPage } from '@/pages/equipamentos/catalog/fornecedor-form-page';
import { FornecedoresPage } from '@/pages/equipamentos/catalog/fornecedores-page';
import { GrupoFormPage } from '@/pages/equipamentos/catalog/grupo-form-page';
import { GruposPage } from '@/pages/equipamentos/catalog/grupos-page';
import { ObraFormPage } from '@/pages/equipamentos/catalog/obra-form-page';
import { ObrasPage } from '@/pages/equipamentos/catalog/obras-page';
import { TipoFormPage } from '@/pages/equipamentos/catalog/tipo-form-page';
import { TiposPage } from '@/pages/equipamentos/catalog/tipos-page';
import { EquipamentosLayout } from '@/pages/equipamentos/equipamento-layout';
import EquipamentosAlertSettingsPage from '@/pages/equipamentos/equipamentos-alert-settings-page';
import { EquipamentosBaixadosPage } from '@/pages/equipamentos/equipamentos-baixados-page';
import { EquipamentosEstoquePage } from '@/pages/equipamentos/equipamentos-estoque-page';
import { EquipamentosGestaoPage } from '@/pages/equipamentos/equipamentos-gestao-page';
import { EquipamentosMaisPage } from '@/pages/equipamentos/equipamentos-mais-page';
import { EquipamentosManutencaoPage } from '@/pages/equipamentos/equipamentos-manutencao-page';
import { EquipamentosMovimentacoesPage } from '@/pages/equipamentos/equipamentos-movimentacoes-page';
import { InvitesPage } from '@/pages/invites/invites-page';
import { MenuFormPage } from '@/pages/menus/menu-form-page';
import { MenusPage } from '@/pages/menus/menus-page';
import { MessageTemplateFormPage } from '@/pages/message-templates/message-template-form-page';
import { MessageTemplatesPage } from '@/pages/message-templates/message-templates-page';
import { NotificationsPage } from '@/pages/notifications/notifications-page';
import { PermissionFormPage } from '@/pages/permissions/permission-form-page';
import { PermissionsPage } from '@/pages/permissions/permissions-page';
import { NotificationPreferencesPage } from '@/pages/profile/notification-preferences-page';
import { ProfilePage } from '@/pages/profile/profile-page';
import { MyExecutionsPage } from '@/pages/reports/my-executions-page';
import { ReportExecutePage } from '@/pages/reports/report-execute-page';
import { ReportFormPage } from '@/pages/reports/report-form-page';
import { ReportsPage } from '@/pages/reports/reports-page';
import { RoleFormPage } from '@/pages/roles/role-form-page';
import { RolesPage } from '@/pages/roles/roles-page';
import { SecurityPage } from '@/pages/security/security-page';
import { TranslationFormPage } from '@/pages/settings/translation-form-page';
import { TranslationsPage } from '@/pages/settings/translations-page';
import { UserApprovalsPage } from '@/pages/user-approvals/user-approvals-page';
import { UserFormPage } from '@/pages/users/user-form-page';
import { UsersPage } from '@/pages/users/users-page';
import { WebhookFormPage } from '@/pages/webhooks/webhook-form-page';
import { WebhooksPage } from '@/pages/webhooks/webhooks-page';
import { AccountLayout } from '@/routing/account-layout';
import { RequireAccountSession } from '@/routing/require-account-session';
import { RequirePermission } from '@/routing/require-permission';
import { RequireSuperAdmin } from '@/routing/require-super-admin';
import { useAuthStore } from '@/stores/auth.store';
import { useCentralAuthStore } from '@/stores/central-auth.store';
import { Navigate, Route, Routes, useParams } from 'react-router';
import {
  buildTenantLoginPath,
  resolveTenantSlugForLogin,
} from '@/lib/tenant-login-path';
import { CentralLayout } from '@/components/layouts/central-layout';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';

/**
 * Convenção de rotas (Opção C) — ver docs/ROUTING.md
 *
 * - Sem prefixo (/users, /menus, …) → tenant (admin do tenant)
 * - Com prefixo /admin/* → SaaS (somente super-admin)
 */

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={buildTenantLoginPath(resolveTenantSlugForLogin())}
        replace
      />
    );
  }

  return <>{children}</>;
}

function CentralGuestOnly({ children }: { children: React.ReactNode }) {
  const { isCentralAuthenticated } = useCentralAuthStore();

  if (isCentralAuthenticated) {
    return <Navigate to="/admin/tenants" replace />;
  }

  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function ReportExecuteRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/reports/${id}/execute`} replace />;
}

function AdminPlatformMessageTemplateRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/admin/message-templates/${id}`} replace />;
}

function AdminPlatformReportRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/admin/reports/${id}`} replace />;
}

function LegacyTenantEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/admin/tenants/${id}`} replace />;
}

function LegacySuperAdminEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/admin/super-admins/${id}`} replace />;
}

function LegacyCampaignEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/campaigns/${id}`} replace />;
}

export function AppRoutingSetup() {
  return (
    <Routes>
      <Route
        path="/central/login"
        element={
          <CentralGuestOnly>
            <CentralLoginPage />
          </CentralGuestOnly>
        }
      />
      <Route path="/central/auth/callback" element={<CentralCallbackPage />} />
      <Route
        path="/auth/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route path="/auth/two-factor" element={<TwoFactorPage />} />
      <Route
        path="/auth/forgot-password"
        element={
          <GuestOnly>
            <ForgotPasswordPage />
          </GuestOnly>
        }
      />
      <Route
        path="/auth/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />
      <Route
        path="/auth/invite"
        element={
          <GuestOnly>
            <InvitePage />
          </GuestOnly>
        }
      />
      <Route
        path="/auth/select-tenant"
        element={
          <RequireAuth>
            <TenantSelectPage />
          </RequireAuth>
        }
      />

      {/* Conta — tenant ou super-admin central sem tenant */}
      <Route element={<RequireAccountSession />}>
        <Route element={<AccountLayout />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/notification-preferences"
            element={<NotificationPreferencesPage />}
          />
          <Route path="/docs" element={<SystemDocsPage />} />
        </Route>
      </Route>

      {/* Painel central — layout próprio, sem fetch de tenant */}
      <Route element={<RequireSuperAdmin />}>
        <Route element={<CentralLayout />}>
          <Route path="/admin/tenants" element={<AdminTenantsPage />} />
          <Route
            path="/admin/tenants/new"
            element={<AdminTenantFormPage key="admin-tenant-new" />}
          />
          <Route
            path="/admin/tenants/:id"
            element={<AdminTenantFormPage key="admin-tenant-edit" />}
          />
          <Route
            path="/admin/tenants/nova"
            element={<Navigate to="/admin/tenants/new" replace />}
          />
          <Route
            path="/admin/tenants/:id/editar"
            element={<LegacyTenantEditRedirect />}
          />
          <Route path="/admin/super-admins" element={<CentralUsersPage />} />
          <Route
            path="/admin/super-admins/:id"
            element={<CentralUserFormPage />}
          />
          <Route
            path="/admin/super-admins/:id/editar"
            element={<LegacySuperAdminEditRedirect />}
          />
          <Route
            path="/admin/profile"
            element={<Navigate to="/profile" replace />}
          />
          <Route
            path="/central-users"
            element={<Navigate to="/admin/super-admins" replace />}
          />
          <Route path="/admin/devtools" element={<AdminDevToolsPage />} />
          <Route
            path="/admin/message-templates"
            element={<MessageTemplatesPage />}
          />
          <Route
            path="/admin/message-templates/:id"
            element={
              <MessageTemplateFormPage key="platform-message-template-edit" />
            }
          />
          <Route path="/admin/reports" element={<ReportsPage />} />
          <Route
            path="/admin/reports/:id"
            element={<ReportFormPage key="platform-report-edit" />}
          />
          <Route
            path="/admin/campaigns"
            element={<Navigate to="/admin/campaigns/new" replace />}
          />
          <Route
            path="/admin/campaigns/new"
            element={<CampaignFormPage key="platform-campaign-new" />}
          />
          <Route
            path="/admin/campaigns/:id"
            element={<CampaignFormPage key="platform-campaign-edit" />}
          />
          <Route
            path="/admin/translations"
            element={<TranslationsTenantPickerPage />}
          />
          <Route
            path="/admin/translations/:tenantId"
            element={<TranslationsPage key="central-translations-list" />}
          />
          <Route
            path="/admin/translations/:tenantId/new"
            element={<TranslationFormPage key="central-translation-new" />}
          />
          <Route
            path="/admin/translations/:tenantId/:id"
            element={<TranslationFormPage key="central-translation-edit" />}
          />
          <Route
            path="/admin/platform/message-templates"
            element={<Navigate to="/admin/message-templates" replace />}
          />
          <Route
            path="/admin/platform/message-templates/:id"
            element={<AdminPlatformMessageTemplateRedirect />}
          />
          <Route
            path="/admin/platform/reports"
            element={<Navigate to="/admin/reports" replace />}
          />
          <Route
            path="/admin/platform/reports/:id"
            element={<AdminPlatformReportRedirect />}
          />
        </Route>
      </Route>

      {/* Tenant — layout de tenant */}
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/new" element={<UserFormPage key="user-new" />} />
        <Route path="/users/:id" element={<UserFormPage key="user-edit" />} />
        <Route path="/user-approvals" element={<UserApprovalsPage />} />
        <Route element={<RequirePermission permission="menu-visualizar" />}>
          <Route path="/menus" element={<MenusPage />} />
          <Route path="/menus/new" element={<MenuFormPage key="menu-new" />} />
          <Route path="/menus/:id" element={<MenuFormPage key="menu-edit" />} />
        </Route>
        <Route
          element={<RequirePermission permission="permissao-visualizar" />}
        >
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/roles/new" element={<RoleFormPage key="role-new" />} />
          <Route path="/roles/:id" element={<RoleFormPage key="role-edit" />} />
          <Route path="/permissions" element={<PermissionsPage />} />
          <Route
            path="/permissions/new"
            element={<PermissionFormPage key="permission-new" />}
          />
          <Route
            path="/permissions/:id"
            element={<PermissionFormPage key="permission-edit" />}
          />
        </Route>
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/activity-logs" element={<ActivityLogsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/reports/new"
          element={<ReportFormPage key="report-new" />}
        />
        <Route path="/reports/executions" element={<MyExecutionsPage />} />
        <Route path="/reports/:id/execute" element={<ReportExecutePage />} />
        <Route
          path="/reports/:id/executar"
          element={<ReportExecuteRedirect />}
        />
        <Route
          path="/reports/:id"
          element={<ReportFormPage key="report-edit" />}
        />
        <Route path="/invites" element={<InvitesPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route
          path="/campaigns/new"
          element={<CampaignFormPage key="campaign-new" />}
        />
        <Route
          path="/campaigns/:id/edit"
          element={<LegacyCampaignEditRedirect />}
        />
        <Route path="/campaigns/:id" element={<CampaignIdPage />} />
        <Route path="/message-templates" element={<MessageTemplatesPage />} />
        <Route
          path="/message-templates/new"
          element={<MessageTemplateFormPage key="template-new" />}
        />
        <Route
          path="/message-templates/:id"
          element={<MessageTemplateFormPage key="template-edit" />}
        />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route
          path="/webhooks/new"
          element={<WebhookFormPage key="webhook-new" />}
        />
        <Route
          path="/webhooks/:id"
          element={<WebhookFormPage key="webhook-edit" />}
        />
        <Route path="/equipamentos" element={<EquipamentosLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="estoque" element={<EquipamentosEstoquePage />} />
          <Route
            path="movimentacoes"
            element={<EquipamentosMovimentacoesPage />}
          />
          <Route
            path="utilizacao"
            element={<Navigate to="/equipamentos/movimentacoes" replace />}
          />
          <Route path="manutencao" element={<EquipamentosManutencaoPage />} />
          <Route
            path="manutencoes"
            element={<Navigate to="/equipamentos/manutencao" replace />}
          />
          <Route path="mais" element={<EquipamentosMaisPage />} />
          <Route path="dashboard" element={<EquipamentosGestaoPage />} />
          <Route
            path="gestao"
            element={<Navigate to="/equipamentos/dashboard" replace />}
          />
          <Route
            path="historico"
            element={<Navigate to="/equipamentos/estoque" replace />}
          />
          <Route path="baixados" element={<EquipamentosBaixadosPage />} />
          <Route path="grupos" element={<GruposPage />} />
          <Route path="grupos/new" element={<GrupoFormPage key="grupo-new" />} />
          <Route path="grupos/:id" element={<GrupoFormPage key="grupo-edit" />} />
          <Route path="obras" element={<ObrasPage />} />
          <Route path="obras/new" element={<ObraFormPage key="obra-new" />} />
          <Route path="obras/:id" element={<ObraFormPage key="obra-edit" />} />
          <Route path="fornecedores" element={<FornecedoresPage />} />
          <Route
            path="fornecedores/new"
            element={<FornecedorFormPage key="fornecedor-new" />}
          />
          <Route
            path="fornecedores/:id"
            element={<FornecedorFormPage key="fornecedor-edit" />}
          />
          <Route path="tipos" element={<TiposPage />} />
          <Route path="tipos/new" element={<TipoFormPage key="tipo-new" />} />
          <Route path="tipos/:id" element={<TipoFormPage key="tipo-edit" />} />
          <Route
            path="configuracoes-alertas"
            element={<EquipamentosAlertSettingsPage />}
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
