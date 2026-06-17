<?php

declare(strict_types=1);

use App\Models\Campaign;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-'.uniqid();
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
        'is_active' => true,
    ]);

    $this->tenant->run(fn () => $this->seed(RolePermissionSeeder::class));

    $this->admin = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function dashboardHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

it('retorna estatísticas do dashboard para usuário autenticado', function (): void {
    $this->tenant->run(fn () => Campaign::factory()->count(2)->create(['created_by' => $this->admin->id]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/dashboard/stats', dashboardHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.campaigns.total', 2)
        ->assertJsonStructure([
            'result' => [
                'period',
                'tenants' => ['rows', 'by_status'],
                'users',
                'user_approvals',
                'campaigns',
                'webhooks' => ['recent_deliveries'],
                'message_templates' => ['items'],
                'invites',
                'docs',
                'reports',
                'report_templates',
                'menus',
                'notification_preferences',
                'user_preferences',
                'central_users',
                'recent_activity',
            ],
        ]);
});

it('filtra estatísticas do dashboard por intervalo de datas', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/dashboard/stats?date_from=2026-01-01&date_to=2026-06-30', dashboardHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.period.from', '2026-01-01')
        ->assertJsonPath('result.period.to', '2026-06-30');
});

it('nega estatísticas do dashboard sem autenticação', function (): void {
    $this->getJson('/api/v1/dashboard/stats', dashboardHeaders($this->tenant->id))
        ->assertUnauthorized();
});
