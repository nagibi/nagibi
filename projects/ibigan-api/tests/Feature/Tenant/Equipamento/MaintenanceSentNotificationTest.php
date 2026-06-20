<?php

declare(strict_types=1);

use App\Models\Equipamento;
use App\Models\Tenant;
use App\Models\User;
use App\Services\NotificationPreferenceService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'maintenance-notif-'.uniqid();

    /** @var TestCase&object{tenant: Tenant, admin: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Maintenance Notification Tenant',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->admin = $this->tenant->run(function (): User {
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function maintenanceNotificationHeaders(Tenant $tenant): array
{
    return ['X-Tenant-ID' => $tenant->id];
}

it('notifica usuarios com preferencia maintenance.sent habilitada ao enviar para manutencao', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->tenant->run(function (): void {
        app(NotificationPreferenceService::class)->update($this->admin, 'maintenance.sent', 'app', true);
    });

    $equipamento = $this->tenant->run(fn () => Equipamento::factory()->create());

    $this->postJson(
        "/api/v1/equipamentos/{$equipamento->id}/manutencao",
        [
            'responsabilidade' => 'equipamento',
            'motivo' => 'Não liga',
            'responsavel_user_id' => $this->admin->id,
            'data_entrada' => now()->toDateString(),
        ],
        maintenanceNotificationHeaders($this->tenant),
    )->assertCreated();

    $this->tenant->run(function () use ($equipamento): void {
        $notification = $this->admin->notifications()->first();

        expect($notification)->not->toBeNull()
            ->and($notification->data['event_slug'])->toBe('maintenance.sent')
            ->and($notification->data['subject'])->toBe('Enviado para manutenção')
            ->and($notification->data['patrimonio'])->toBe($equipamento->patrimonio);
    });
});

it('nao notifica usuarios com maintenance.sent desabilitado', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->tenant->run(function (): void {
        app(NotificationPreferenceService::class)->update($this->admin, 'maintenance.sent', 'app', false);
        app(NotificationPreferenceService::class)->update($this->admin, 'maintenance.sent', 'email', false);
    });

    $equipamento = $this->tenant->run(fn () => Equipamento::factory()->create());

    $this->postJson(
        "/api/v1/equipamentos/{$equipamento->id}/manutencao",
        [
            'responsabilidade' => 'equipamento',
            'motivo' => 'Revisão preventiva',
            'responsavel_user_id' => $this->admin->id,
            'data_entrada' => now()->toDateString(),
        ],
        maintenanceNotificationHeaders($this->tenant),
    )->assertCreated();

    $this->tenant->run(function (): void {
        expect($this->admin->notifications()->count())->toBe(0);
    });
});
