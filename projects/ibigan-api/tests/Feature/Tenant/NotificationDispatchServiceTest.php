<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use App\Notifications\CatalogEventNotification;
use App\Services\NotificationDispatchService;
use App\Services\NotificationPreferenceService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'notif-dispatch-' . uniqid();

    /** @var TestCase&object{tenant: Tenant, admin: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Notification Dispatch',
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

it('nao reenvia email quando app esta desligado mas dedupe ja foi registrado', function (): void {
    Notification::fake();

    $this->tenant->run(function (): void {
        $pref = app(NotificationPreferenceService::class);
        $pref->update($this->admin, 'loan.overdue', 'app', false);
        $pref->update($this->admin, 'loan.overdue', 'email', true);

        $dispatch = app(NotificationDispatchService::class);
        $context = [
            'dedupe_key' => 'loan.overdue:99',
            'patrimonio' => 'EQ-001',
            'equipamento_nome' => 'Gerador',
            'dias_vencido' => 7,
            'colaborador' => 'João',
        ];

        $dispatch->dispatch('loan.overdue', $context);
        $dispatch->dispatch('loan.overdue', $context);

        Notification::assertSentToTimes($this->admin, CatalogEventNotification::class, 1);
    });
});

it('agrupa emails do scanner em um unico email consolidado', function (): void {
    Notification::fake();

    $this->tenant->run(function (): void {
        $pref = app(NotificationPreferenceService::class);
        $pref->update($this->admin, 'loan.overdue', 'app', false);
        $pref->update($this->admin, 'loan.overdue', 'email', true);
        $pref->update($this->admin, 'equipment.idle', 'app', false);
        $pref->update($this->admin, 'equipment.idle', 'email', true);

        $dispatch = app(NotificationDispatchService::class);
        $dispatch->deferEmails(true);

        foreach (range(1, 5) as $index) {
            $dispatch->dispatch('loan.overdue', [
                'dedupe_key' => "loan.overdue:{$index}",
                'patrimonio' => "EQ-{$index}",
                'equipamento_nome' => 'Gerador',
                'dias_vencido' => $index,
                'colaborador' => 'João',
            ]);
        }

        $dispatch->dispatch('equipment.idle', [
            'dedupe_key' => 'equipment.idle:1',
            'patrimonio' => 'EQ-99',
            'equipamento_nome' => 'Betoneira',
            'dias_parado' => 40,
            'valor_mensal' => '1.500,00',
        ]);

        $dispatch->flushDeferredEmails();

        Notification::assertSentToTimes($this->admin, CatalogEventNotification::class, 1);

        Notification::assertSentTo(
            $this->admin,
            CatalogEventNotification::class,
            fn(CatalogEventNotification $notification): bool => str_contains(
                (string) $notification->toMail($this->admin)->envelope()->subject,
                'Alertas Equipamento (6)',
            ),
        );
    });
});

it('envia no maximo um email consolidado do scanner por dia', function (): void {
    Notification::fake();

    $this->tenant->run(function (): void {
        Cache::flush();

        $pref = app(NotificationPreferenceService::class);
        $pref->update($this->admin, 'loan.overdue', 'app', false);
        $pref->update($this->admin, 'loan.overdue', 'email', true);

        $dispatch = app(NotificationDispatchService::class);
        $dispatch->deferEmails(true);

        $dispatch->dispatch('loan.overdue', [
            'dedupe_key' => 'loan.overdue:1',
            'patrimonio' => 'EQ-1',
            'equipamento_nome' => 'Gerador',
            'dias_vencido' => 1,
            'colaborador' => 'João',
        ]);
        $dispatch->flushDeferredEmails();

        Cache::forget(sprintf('notification_dedupe:%s:loan.overdue:loan.overdue:2', $this->admin->id));

        $dispatch->dispatch('loan.overdue', [
            'dedupe_key' => 'loan.overdue:2',
            'patrimonio' => 'EQ-2',
            'equipamento_nome' => 'Gerador',
            'dias_vencido' => 2,
            'colaborador' => 'Maria',
        ]);
        $dispatch->flushDeferredEmails();

        Notification::assertSentToTimes($this->admin, CatalogEventNotification::class, 1);
    });
});

it('usa cache para dedupe independente do canal app', function (): void {
    $this->tenant->run(function (): void {
        Cache::flush();

        $dispatch = app(NotificationDispatchService::class);
        $context = ['dedupe_key' => 'digest.daily:2026-06-17'];

        $dispatch->dispatch('digest.daily', $context);

        expect(Cache::has(sprintf(
            'notification_dedupe:%s:digest.daily:digest.daily:2026-06-17',
            $this->admin->id,
        )))->toBeTrue();
    });
});
