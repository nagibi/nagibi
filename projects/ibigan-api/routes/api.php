<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\SocialAuthController;
use App\Http\Controllers\Api\V1\Auth\TenantContextController;
use App\Http\Controllers\Api\V1\Auth\TwoFactorChallengeController;
use App\Http\Controllers\Api\V1\Central\CentralAuthController;
use App\Http\Controllers\Api\V1\Central\CentralProfileController;
use App\Http\Controllers\Api\V1\Central\CentralSocialAuthController;
use App\Http\Controllers\Api\V1\Central\CentralTwoFactorController;
use App\Http\Controllers\Api\V1\Central\CentralTranslationController;
use App\Http\Controllers\Api\V1\Central\CentralUserController;
use App\Http\Controllers\Api\V1\Central\PlatformCampaignController;
use App\Http\Controllers\Api\V1\Central\PlatformMessageTemplateController;
use App\Http\Controllers\Api\V1\Central\PlatformReportTemplateController;
use App\Http\Controllers\Api\V1\Central\TenantAdminController;
use App\Http\Controllers\Api\V1\Central\TenantController;
use App\Http\Controllers\Api\V1\Central\TenantSettingsController;
use App\Http\Controllers\Api\V1\Tenant\ActivityLogController;
use App\Http\Controllers\Api\V1\Tenant\CampaignController;
use App\Http\Controllers\Api\V1\Tenant\DashboardController;
use App\Http\Controllers\Api\V1\Tenant\GlobalSearchController;
use App\Http\Controllers\Api\V1\Tenant\InviteController;
use App\Http\Controllers\Api\V1\Tenant\MenuController;
use App\Http\Controllers\Api\V1\Tenant\MessageTemplateController;
use App\Http\Controllers\Api\V1\Tenant\NotificationController;
use App\Http\Controllers\Api\V1\Tenant\NotificationPreferenceController;
use App\Http\Controllers\Api\V1\Tenant\PermissionController;
use App\Http\Controllers\Api\V1\Tenant\ProfileController;
use App\Http\Controllers\Api\V1\Tenant\RoleController;
use App\Http\Controllers\Api\V1\Tenant\ReportController;
use App\Http\Controllers\Api\V1\Tenant\TwoFactorController;
use App\Http\Controllers\Api\V1\Tenant\UserApprovalController;
use App\Http\Controllers\Api\V1\Tenant\UserController;
use App\Http\Controllers\Api\V1\Tenant\UserPreferenceController;
use App\Http\Controllers\Api\V1\Tenant\TranslationController;
use App\Http\Controllers\Api\V1\Tenant\WebhookController;
use App\Http\Middleware\InitializeTenancyByHeader;
use App\Http\Middleware\InitializeTenancyByRouteParameter;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

Broadcast::routes([
    'middleware' => [InitializeTenancyByHeader::class, 'auth:sanctum'],
]);


// Rotas públicas
Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::get('tenant-context', [TenantContextController::class, 'show']);
        Route::get('{provider}', [SocialAuthController::class, 'redirect'])
            ->where('provider', 'google|apple');
        Route::match(['get', 'post'], '{provider}/callback', [SocialAuthController::class, 'callback'])
            ->where('provider', 'google|apple');
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('register', [AuthController::class, 'register'])->middleware('throttle:register');
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:forgot-password');
        Route::post('reset-password', [AuthController::class, 'resetPassword']);
        Route::post('two-factor-challenge', [TwoFactorChallengeController::class, 'verify'])->middleware('throttle:two-factor');
        Route::post('two-factor-resend', [TwoFactorChallengeController::class, 'resend'])->middleware('throttle:two-factor');
    });

    Route::post('invites/accept', [InviteController::class, 'accept'])
        ->middleware([InitializeTenancyByHeader::class, 'throttle:invite-accept']);

    Route::get('translations', [TranslationController::class, 'index'])
        ->middleware([InitializeTenancyByHeader::class]);

    Route::get(
        'tenants/{tenant}/reports/{report}/executions/{execution}/download',
        [ReportController::class, 'downloadCsv'],
    )
        ->middleware(['signed', InitializeTenancyByRouteParameter::class, 'throttle:api'])
        ->name('reports.executions.download');
});

// ─── Auth central (público) ───────────────────────────────────────────────
Route::prefix('central/v1/auth')
    ->middleware(['throttle:api'])
    ->group(function () {
        Route::post('login', [CentralAuthController::class, 'login']);
        Route::get('{provider}', [CentralSocialAuthController::class, 'redirect'])
            ->where('provider', 'google|apple');
    });

// ─── Rotas centrais para usuários de TENANT (auth:sanctum) ───────────────
Route::prefix('central/v1')
    ->middleware([InitializeTenancyByHeader::class, 'auth:sanctum', 'tenant', 'throttle:api'])
    ->group(function () {
        Route::get('tenants', [TenantController::class, 'index']);
        Route::post('tenants/switch', [TenantController::class, 'switch']);
    });

// ─── Rotas centrais para SUPER-ADMIN (auth:central) ──────────────────────
Route::prefix('central/v1')
    ->middleware(['auth:central', 'throttle:api'])
    ->group(function () {
        Route::get('auth/me', [CentralAuthController::class, 'me']);
        Route::post('auth/logout', [CentralAuthController::class, 'logout']);

        Route::prefix('two-factor')->group(function () {
            Route::get('status', [CentralTwoFactorController::class, 'status']);
            Route::post('enable', [CentralTwoFactorController::class, 'enable']);
            Route::post('confirm', [CentralTwoFactorController::class, 'confirm']);
            Route::post('resend-setup-code', [CentralTwoFactorController::class, 'resendSetupCode']);
            Route::post('disable', [CentralTwoFactorController::class, 'disable']);
            Route::get('recovery-codes', [CentralTwoFactorController::class, 'recoveryCodes']);
            Route::post('recovery-codes', [CentralTwoFactorController::class, 'regenerateRecoveryCodes']);
        });

        Route::prefix('profile')->group(function () {
            Route::get('/', [CentralProfileController::class, 'show']);
            Route::put('/', [CentralProfileController::class, 'update']);
            Route::put('password', [CentralProfileController::class, 'updatePassword']);
            Route::post('avatar', [CentralProfileController::class, 'uploadAvatar']);
            Route::delete('avatar', [CentralProfileController::class, 'deleteAvatar']);
        });

        Route::prefix('admin')->group(function () {
            Route::get('tenants', [TenantAdminController::class, 'index']);
            Route::post('tenants', [TenantAdminController::class, 'store']);
            Route::get('tenants/{tenant}', [TenantAdminController::class, 'show']);
            Route::put('tenants/{tenant}', [TenantAdminController::class, 'update']);
            Route::patch('tenants/{tenant}/toggle-active', [TenantAdminController::class, 'toggleActive']);
            Route::get('tenants/{tenant}/activity-logs', [TenantAdminController::class, 'activityLogs']);
            Route::post('tenants/{tenant}/impersonate', [TenantAdminController::class, 'impersonate']);
            Route::delete('tenants/{tenant}', [TenantAdminController::class, 'destroy']);
            Route::get('tenants/{tenant}/translations', [CentralTranslationController::class, 'index']);
            Route::post('tenants/{tenant}/translations', [CentralTranslationController::class, 'store']);
            Route::put('tenants/{tenant}/translations/{tenantTranslation}', [CentralTranslationController::class, 'update']);

            Route::get('central-users', [CentralUserController::class, 'index']);
            Route::get('central-users/{centralUser}', [CentralUserController::class, 'show']);
            Route::put('central-users/{centralUser}', [CentralUserController::class, 'update']);
            Route::patch('central-users/{centralUser}/toggle-active', [CentralUserController::class, 'toggleActive']);
            Route::patch('central-users/{centralUser}/toggle-super-admin', [CentralUserController::class, 'toggleSuperAdmin']);

            Route::post('platform-catalog/sync', [PlatformMessageTemplateController::class, 'sync'])
                ->name('central.platform-catalog.sync');
            Route::post('platform/message-templates/{platformMessageTemplate}/duplicate', [PlatformMessageTemplateController::class, 'duplicate'])
                ->name('central.platform.message-templates.duplicate');
            Route::post('platform/message-templates/{platformMessageTemplate}/test-send', [PlatformMessageTemplateController::class, 'testSend'])
                ->name('central.platform.message-templates.test-send');
            Route::patch('platform/message-templates/{platformMessageTemplate}/toggle-active', [PlatformMessageTemplateController::class, 'toggleActive'])
                ->name('central.platform.message-templates.toggle-active');
            Route::apiResource('platform/message-templates', PlatformMessageTemplateController::class)
                ->only(['index', 'show', 'update'])
                ->names('central.platform.message-templates');
            Route::post('platform/campaigns', [PlatformCampaignController::class, 'store'])
                ->name('central.platform.campaigns.store');
            Route::patch('platform/report-templates/{platformReportTemplate}/toggle-active', [PlatformReportTemplateController::class, 'toggleActive'])
                ->name('central.platform.report-templates.toggle-active');
            Route::apiResource('platform/report-templates', PlatformReportTemplateController::class)
                ->only(['index', 'show', 'update'])
                ->names('central.platform.report-templates');
        });
    });

// Rotas protegidas — requer X-Tenant-ID + token Sanctum
Route::prefix('v1')
    ->middleware([InitializeTenancyByHeader::class, 'auth:sanctum', 'tenant', 'throttle:api'])
    ->group(function () {
        Route::get('search', GlobalSearchController::class)->name('search.global');
        Route::get('dashboard/stats', [DashboardController::class, 'stats']);

        Route::prefix('auth')->group(function () {
            Route::get('me', [AuthController::class, 'me']);
            Route::post('logout', [AuthController::class, 'logout']);
        });

        Route::prefix('two-factor')->group(function () {
            Route::get('status', [TwoFactorController::class, 'status']);
            Route::post('enable', [TwoFactorController::class, 'enable']);
            Route::post('confirm', [TwoFactorController::class, 'confirm']);
            Route::post('resend-setup-code', [TwoFactorController::class, 'resendSetupCode']);
            Route::post('disable', [TwoFactorController::class, 'disable']);
            Route::get('recovery-codes', [TwoFactorController::class, 'recoveryCodes']);
            Route::post('recovery-codes', [TwoFactorController::class, 'regenerateRecoveryCodes']);
        });

        Route::prefix('profile')->group(function () {
            Route::get('/', [ProfileController::class, 'show']);
            Route::put('/', [ProfileController::class, 'update']);
            Route::put('password', [ProfileController::class, 'updatePassword']);
            Route::post('avatar', [ProfileController::class, 'uploadAvatar']);
            Route::delete('avatar', [ProfileController::class, 'deleteAvatar']);
        });

        Route::get('tenant/settings', [TenantSettingsController::class, 'show']);
        Route::put('tenant/settings', [TenantSettingsController::class, 'update']);
        Route::post('tenant/settings/logo', [TenantSettingsController::class, 'uploadLogo']);
        Route::delete('tenant/settings/logo', [TenantSettingsController::class, 'deleteLogo']);

        Route::get('users/export', [UserController::class, 'export']);
        Route::patch('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
        Route::apiResource('users', UserController::class);
        Route::post('users/{user}/avatar', [UserController::class, 'uploadAvatar']);

        Route::prefix('user-approvals')->group(function () {
            Route::get('/', [UserApprovalController::class, 'index']);
            Route::patch('{userApproval}/approve', [UserApprovalController::class, 'approve']);
            Route::patch('{userApproval}/reject', [UserApprovalController::class, 'reject']);
        });

        Route::get('activity-logs', [ActivityLogController::class, 'index']);
        Route::get('activity-logs/{type}/{id}', [ActivityLogController::class, 'forSubject']);

        Route::get('menus/navigation', [MenuController::class, 'navigation']);
        Route::patch('menus/reorder', [MenuController::class, 'reorder']);
        Route::patch('menus/{menu}/toggle-active', [MenuController::class, 'toggleActive']);
        Route::apiResource('menus', MenuController::class);

        Route::apiResource('permissions', PermissionController::class)->only([
            'index',
            'show',
            'store',
            'update',
            'destroy',
        ]);
        Route::put('roles/{role}/permissions', [RoleController::class, 'syncPermissions']);
        Route::apiResource('roles', RoleController::class);

        Route::post('message-templates/upload-image', [MessageTemplateController::class, 'uploadImage']);
        Route::post('message-templates/{messageTemplate}/test-send', [MessageTemplateController::class, 'testSend']);
        Route::post('message-templates/{messageTemplate}/duplicate', [MessageTemplateController::class, 'duplicate']);
        Route::patch('message-templates/{messageTemplate}/toggle-active', [MessageTemplateController::class, 'toggleActive']);
        Route::apiResource('message-templates', MessageTemplateController::class);

        Route::patch('campaigns/{campaign}/toggle-active', [CampaignController::class, 'toggleActive']);
        Route::patch('campaigns/{campaign}/cancel', [CampaignController::class, 'cancel']);
        Route::get('campaigns/{campaign}/deliveries', [CampaignController::class, 'deliveries']);
        Route::apiResource('campaigns', CampaignController::class);

        Route::apiResource('invites', InviteController::class)->only(['index', 'store', 'destroy']);

        Route::get('notifications', [NotificationController::class, 'index']);
        Route::patch('notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::patch('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
        Route::patch('notifications/{notification}/unread', [NotificationController::class, 'markAsUnread']);
        Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);

        Route::get('notification-preferences', [NotificationPreferenceController::class, 'index']);
        Route::patch('notification-preferences', [NotificationPreferenceController::class, 'update']);

        Route::get('user-preferences', [UserPreferenceController::class, 'index']);
        Route::patch('user-preferences', [UserPreferenceController::class, 'update']);

        Route::get('webhooks/{webhook}/deliveries', [WebhookController::class, 'deliveries']);
        Route::patch('webhooks/{webhook}/toggle-active', [WebhookController::class, 'toggleActive']);
        Route::apiResource('webhooks', WebhookController::class);

        Route::get('reports/executions/my', [ReportController::class, 'myExecutions']);
        Route::patch('reports/{report}/toggle-active', [ReportController::class, 'toggleActive']);
        Route::post('reports/{report}/execute', [ReportController::class, 'execute']);
        Route::get('reports/{report}/executions', [ReportController::class, 'executions']);
        Route::get('reports/{report}/executions/{execution}/result', [ReportController::class, 'result']);
        Route::get('reports/{report}/executions/{execution}/status', [ReportController::class, 'executionStatus']);
        Route::apiResource('reports', ReportController::class);

        require __DIR__ . '/equipamento.php';
    });
