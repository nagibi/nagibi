<?php

declare(strict_types=1);

use App\Models\Emprestimo;
use App\Models\Equipamento;
use App\Models\Manutencao;
use App\Models\Obra;
use App\Models\Tenant;
use App\Models\User;
use App\Services\EquipamentoAlertScanner;
use App\Services\NotificationPreferenceService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'equip-notif-scanner-' . uniqid();

    /** @var TestCase&object{tenant: Tenant, admin: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Equipamento Scanner Notifications',
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

function enableScannerPreferences(User $user, array $events): void
{
    $service = app(NotificationPreferenceService::class);

    foreach ($events as $event) {
        $service->update($user, $event, 'app', true);
    }
}

function hasNotification(User $user, string $eventSlug): bool
{
    return $user->notifications()
        ->get()
        ->contains(fn($notification) => ($notification->data['event_slug'] ?? null) === $eventSlug);
}

it('scanner dispara loan.overdue para emprestimo vencido', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['loan.overdue']);

        $obra = Obra::factory()->create();
        $equipamento = Equipamento::factory()->create(['obra_id' => $obra->id]);
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $obra->id,
            'data_retirada' => now()->subDays(30)->toDateString(),
            'prazo_dias' => 10,
            'data_devolucao' => null,
        ]);

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'loan.overdue'))->toBeTrue();
    });
});

it('scanner dispara loan.due_soon para emprestimo proximo do vencimento', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['loan.due_soon']);

        $obra = Obra::factory()->create();
        $equipamento = Equipamento::factory()->create(['obra_id' => $obra->id]);
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $obra->id,
            'data_retirada' => now()->subDays(12)->toDateString(),
            'prazo_dias' => 15,
            'data_devolucao' => null,
        ]);

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'loan.due_soon'))->toBeTrue();
    });
});

it('scanner dispara maintenance.overdue para manutencao atrasada', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['maintenance.overdue']);

        $equipamento = Equipamento::factory()->create();
        Manutencao::factory()->create([
            'equipamento_id' => $equipamento->id,
            'data_entrada' => now()->subDays(20)->toDateString(),
            'data_saida' => null,
            'responsavel_user_id' => $this->admin->id,
        ]);

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'maintenance.overdue'))->toBeTrue();
    });
});

it('scanner dispara equipment.idle para equipamento parado', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['equipment.idle']);

        $equipamento = Equipamento::factory()->create([
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'equipment.idle'))->toBeTrue();
    });
});

it('scanner dispara digest.daily', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['digest.daily']);

        $equipamento = Equipamento::factory()->create([
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'data_retirada' => now()->subDays(30)->toDateString(),
            'prazo_dias' => 10,
            'data_devolucao' => null,
        ]);

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'digest.daily'))->toBeTrue();
    });
});

it('scanner dispara digest.weekly nas segundas-feiras', function (): void {
    Carbon::setTestNow(Carbon::parse('2026-06-15')); // segunda-feira

    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['digest.weekly']);

        $equipamento = Equipamento::factory()->create([
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'data_retirada' => now()->subDays(30)->toDateString(),
            'prazo_dias' => 10,
            'data_devolucao' => null,
        ]);

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'digest.weekly'))->toBeTrue();
    });

    Carbon::setTestNow();
});

it('scanner dispara equipment.below_minimum_stock', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['equipment.below_minimum_stock']);

        $tipo = \App\Models\TipoEquipamento::factory()->create();
        Equipamento::factory()->create(['tipo_id' => $tipo->id]);

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'equipment.below_minimum_stock'))->toBeTrue();
    });
});

it('scanner dispara site.idle_equipment', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['site.idle_equipment']);

        $obra = Obra::factory()->create(['codigo' => '650']);
        foreach (range(1, 2) as $index) {
            Equipamento::factory()->create([
                'obra_id' => $obra->id,
                'data_entrada' => now()->subDays(45)->toDateString(),
            ]);
        }

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'site.idle_equipment'))->toBeTrue();
    });
});

it('scanner dispara site.overdue_equipment', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, ['site.overdue_equipment']);

        $obra = Obra::factory()->create(['codigo' => '651']);
        foreach (range(1, 3) as $index) {
            $equipamento = Equipamento::factory()->create(['obra_id' => $obra->id]);
            Emprestimo::factory()->create([
                'equipamento_id' => $equipamento->id,
                'obra_id' => $obra->id,
                'data_retirada' => now()->subDays(40)->toDateString(),
                'prazo_dias' => 10,
                'data_devolucao' => null,
            ]);
        }

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'site.overdue_equipment'))->toBeTrue();
    });
});

it('scanner dispara eventos criticos e de colaborador', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, [
            'critical.idle',
            'critical.overdue',
            'critical.in_maintenance',
            'employee.equipment_overload',
            'employee.long_possession',
        ]);

        Equipamento::factory()->create([
            'is_critico' => true,
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);

        $criticoVencido = Equipamento::factory()->create(['is_critico' => true]);
        Emprestimo::factory()->create([
            'equipamento_id' => $criticoVencido->id,
            'data_retirada' => now()->subDays(40)->toDateString(),
            'prazo_dias' => 10,
            'data_devolucao' => null,
        ]);

        $criticoManutencao = Equipamento::factory()->create(['is_critico' => true]);
        Manutencao::factory()->create([
            'equipamento_id' => $criticoManutencao->id,
            'data_entrada' => now()->subDays(5)->toDateString(),
            'data_saida' => null,
            'responsavel_user_id' => $this->admin->id,
        ]);

        foreach (range(1, 4) as $index) {
            $equipamento = Equipamento::factory()->create();
            Emprestimo::factory()->create([
                'equipamento_id' => $equipamento->id,
                'colaborador_nome' => 'João Silva',
                'colaborador_matricula' => 'A100',
                'data_retirada' => now()->subDays(120)->toDateString(),
                'prazo_dias' => 30,
                'data_devolucao' => null,
            ]);
        }

        app(EquipamentoAlertScanner::class)->scan();

        expect(hasNotification($this->admin, 'critical.idle'))->toBeTrue()
            ->and(hasNotification($this->admin, 'critical.overdue'))->toBeTrue()
            ->and(hasNotification($this->admin, 'critical.in_maintenance'))->toBeTrue()
            ->and(hasNotification($this->admin, 'employee.equipment_overload'))->toBeTrue()
            ->and(hasNotification($this->admin, 'employee.long_possession'))->toBeTrue();
    });
});

it('scanner dispara insights e manutencoes recorrentes', function (): void {
    $this->tenant->run(function (): void {
        enableScannerPreferences($this->admin, [
            'equipment.unused_since_registration',
            'maintenance.frequency_high',
            'maintenance.cost_high',
            'insight.return',
            'insight.reallocation',
            'insight.replacement',
            'insight.cost_reduction',
            'insight.anomaly',
            'site.high_cost',
        ]);

        $obraA = Obra::factory()->create(['codigo' => '650']);
        $obraB = Obra::factory()->create(['codigo' => '720']);

        foreach (range(1, 3) as $index) {
            Equipamento::factory()->create([
                'obra_id' => $obraA->id,
                'data_entrada' => now()->subDays(45)->toDateString(),
                'valor_mensal' => 2500,
            ]);
        }

        Equipamento::factory()->create([
            'obra_id' => $obraB->id,
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);

        Equipamento::factory()->create([
            'data_entrada' => now()->subDays(25)->toDateString(),
        ]);

        $equipamentoFrequente = Equipamento::factory()->create(['valor_mensal' => 9000]);
        foreach (range(1, 6) as $index) {
            Manutencao::factory()->create([
                'equipamento_id' => $equipamentoFrequente->id,
                'data_entrada' => now()->subMonths(2)->addDays($index)->toDateString(),
                'data_saida' => now()->subMonth()->addDays($index)->toDateString(),
                'responsavel_user_id' => $this->admin->id,
                'valor_mensal_snapshot' => 9000,
            ]);
        }

        foreach (range(1, 3) as $index) {
            $equipamento = Equipamento::factory()->create(['obra_id' => $obraA->id, 'valor_mensal' => 12000]);
            Emprestimo::factory()->create([
                'equipamento_id' => $equipamento->id,
                'obra_id' => $obraA->id,
                'data_retirada' => now()->subDays(10)->toDateString(),
                'prazo_dias' => 30,
                'data_devolucao' => null,
            ]);
        }

        app(EquipamentoAlertScanner::class)->scan();

        foreach (
            [
                'equipamento.unused_since_registration',
                'maintenance.frequency_high',
                'maintenance.cost_high',
                'insight.return',
                'insight.reallocation',
                'insight.replacement',
                'insight.cost_reduction',
                'insight.anomaly',
                'site.high_cost',
            ] as $event
        ) {
            expect(hasNotification($this->admin, $event))
                ->toBeTrue("Evento {$event} não foi disparado pelo scanner");
        }
    });
});
