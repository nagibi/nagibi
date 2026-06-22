<?php

declare(strict_types=1);

use App\Models\Emprestimo;
use App\Models\Equipamento;
use App\Models\Manutencao;
use App\Models\Obra;
use App\Models\Tenant;
use App\Models\User;
use App\Services\NotificationPreferenceService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'equip-notif-actions-' . uniqid();

    /** @var TestCase&object{tenant: Tenant, admin: User, obra: Obra} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Equipamento Action Notifications',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->admin = $this->tenant->run(function (): User {
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole('admin');

        return $user;
    });

    $this->obra = $this->tenant->run(fn() => Obra::factory()->create(['codigo' => '650']));
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function equipNotifHeaders(Tenant $tenant): array
{
    return ['X-Tenant-ID' => $tenant->id];
}

function enableAllEquipamentoPreferences(User $user): void
{
    $service = app(NotificationPreferenceService::class);

    foreach (
        [
            'loan.created',
            'loan.returned',
            'loan.renewed',
            'loan.renewal_limit_exceeded',
            'maintenance.sent',
            'maintenance.completed',
        ] as $event
    ) {
        $service->update($user, $event, 'app', true);
    }
}

function latestEventSlug(User $user, string $eventSlug): ?string
{
    $notification = $user->notifications()
        ->get()
        ->last(fn($notification) => ($notification->data['event_slug'] ?? null) === $eventSlug);

    return $notification?->data['event_slug'] ?? null;
}

it('dispara loan.created ao emprestar equipamento', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');
    $this->tenant->run(fn() => enableAllEquipamentoPreferences($this->admin));

    $equipamento = $this->tenant->run(fn() => Equipamento::factory()->create());

    $this->postJson("/api/v1/equipamentos/{$equipamento->id}/emprestar", [
        'obra_id' => $this->obra->id,
        'colaborador_nome' => 'João Silva',
        'colaborador_matricula' => '12345',
        'encarregado_nome' => 'Carlos',
        'data_retirada' => now()->toDateString(),
        'prazo_dias' => 15,
    ], equipNotifHeaders($this->tenant))->assertCreated();

    $this->tenant->run(function (): void {
        expect(latestEventSlug($this->admin, 'loan.created'))->toBe('loan.created');
    });
});

it('dispara loan.returned ao devolver equipamento', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');
    $this->tenant->run(fn() => enableAllEquipamentoPreferences($this->admin));

    $emprestimo = $this->tenant->run(function (): Emprestimo {
        $equipamento = Equipamento::factory()->create();

        return Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);
    });

    $this->postJson("/api/v1/emprestimos/{$emprestimo->id}/devolver", [
        'data_devolucao' => now()->toDateString(),
    ], equipNotifHeaders($this->tenant))->assertOk();

    $this->tenant->run(function (): void {
        expect(latestEventSlug($this->admin, 'loan.returned'))->toBe('loan.returned');
    });
});

function latestNotificationData(User $user, string $eventSlug): ?array
{
    $notification = $user->notifications()
        ->get()
        ->last(fn($notification) => ($notification->data['event_slug'] ?? null) === $eventSlug);

    return $notification?->data;
}

it('dispara loan.renewed ao renovar emprestimo', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');
    $this->tenant->run(fn() => enableAllEquipamentoPreferences($this->admin));

    $emprestimo = $this->tenant->run(function (): Emprestimo {
        $equipamento = Equipamento::factory()->create();

        return Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);
    });

    $this->postJson("/api/v1/emprestimos/{$emprestimo->id}/renovar", [
        'prazo_adicional_dias' => 10,
    ], equipNotifHeaders($this->tenant))->assertOk();

    $this->tenant->run(function () use ($emprestimo): void {
        expect(latestEventSlug($this->admin, 'loan.renewed'))->toBe('loan.renewed');

        $data = latestNotificationData($this->admin, 'loan.renewed');
        expect($data)->not->toBeNull();
        expect($data['emprestimo_id'])->toBe($emprestimo->id);
        expect($data['equipamento_id'])->toBe($emprestimo->equipamento_id);
        expect($data['renovacao_id'])->toBe($emprestimo->fresh()->renovacoes()->latest('id')->value('id'));
    });
});

it('dispara maintenance.completed ao finalizar manutencao', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');
    $this->tenant->run(fn() => enableAllEquipamentoPreferences($this->admin));

    $equipamento = $this->tenant->run(fn() => Equipamento::factory()->create());

    $manutencaoId = $this->postJson("/api/v1/equipamentos/{$equipamento->id}/manutencao", [
        'responsabilidade' => 'equipamento',
        'motivo' => 'Revisão',
        'responsavel_user_id' => $this->admin->id,
        'data_entrada' => now()->toDateString(),
    ], equipNotifHeaders($this->tenant))->json('result.id');

    $this->postJson("/api/v1/manutencoes/{$manutencaoId}/finalizar", [
        'data_saida' => now()->toDateString(),
    ], equipNotifHeaders($this->tenant))->assertOk();

    $this->tenant->run(function (): void {
        expect(latestEventSlug($this->admin, 'maintenance.completed'))->toBe('maintenance.completed');
    });
});

it('dispara loan.renewal_limit_exceeded apos limite de renovacoes', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');
    $this->tenant->run(fn() => enableAllEquipamentoPreferences($this->admin));

    $emprestimo = $this->tenant->run(function (): Emprestimo {
        $equipamento = Equipamento::factory()->create();

        return Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);
    });

    foreach (range(1, 5) as $index) {
        $this->postJson("/api/v1/emprestimos/{$emprestimo->id}/renovar", [
            'prazo_adicional_dias' => 5,
            'data_renovacao' => now()->subDays(5 - $index)->toDateString(),
        ], equipNotifHeaders($this->tenant))->assertOk();
    }

    $this->tenant->run(function (): void {
        expect(latestEventSlug($this->admin, 'loan.renewal_limit_exceeded'))
            ->toBe('loan.renewal_limit_exceeded');
    });
});
