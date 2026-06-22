<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotificationPreference;
use App\Services\NotificationPreferenceService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'notif-prefs-api-' . uniqid();

    /** @var TestCase&object{tenant: Tenant, admin: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Notification Prefs API Tenant',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->admin = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function notificationPreferenceHeaders(Tenant $tenant): array
{
    return ['X-Tenant-ID' => $tenant->id];
}

it('lista preferências com defaults de app e e-mail', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->getJson(
        '/api/v1/notification-preferences',
        notificationPreferenceHeaders($this->tenant),
    );

    $response->assertOk()
        ->assertJsonPath('status', 1);

    $result = $response->json('result');

    expect($result)->toHaveKeys([
        'report.completed',
        'campaign.sent',
        'invite.accepted',
        'user.created',
    ])
        ->and($result['report.completed'])->toMatchArray(['app' => true, 'email' => true])
        ->and($result['campaign.sent'])->toMatchArray(['app' => true, 'email' => false]);
});

it('atualiza preferência de app via PATCH', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->patchJson(
        '/api/v1/notification-preferences',
        [
            'event' => 'report.completed',
            'channel' => 'app',
            'enabled' => false,
        ],
        notificationPreferenceHeaders($this->tenant),
    );

    $response->assertOk()
        ->assertJsonPath('status', 1);

    $result = $response->json('result');

    expect($result['report.completed']['app'])->toBeFalse()
        ->and($result['report.completed']['email'])->toBeTrue();

    $this->tenant->run(function (): void {
        expect(UserNotificationPreference::query()
            ->where('user_id', $this->admin->id)
            ->where('event', 'report.completed')
            ->where('channel', 'app')
            ->value('enabled'))->toBeFalse();
    });
});

it('atualiza preferência de e-mail via PATCH', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->patchJson(
        '/api/v1/notification-preferences',
        [
            'event' => 'campaign.sent',
            'channel' => 'email',
            'enabled' => true,
        ],
        notificationPreferenceHeaders($this->tenant),
    );

    $response->assertOk();

    $result = $response->json('result');

    expect($result['campaign.sent']['email'])->toBeTrue()
        ->and($result['campaign.sent']['app'])->toBeTrue();
});

it('atualiza preferência de evento equipamento via PATCH', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->patchJson(
        '/api/v1/notification-preferences',
        [
            'event' => 'maintenance.sent',
            'channel' => 'email',
            'enabled' => true,
        ],
        notificationPreferenceHeaders($this->tenant),
    );

    $response->assertOk()
        ->assertJsonPath('status', 1);

    $result = $response->json('result');

    expect($result['maintenance.sent']['email'])->toBeTrue()
        ->and($result['maintenance.sent']['app'])->toBeTrue();
});

it('rejeita evento inválido', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->patchJson(
        '/api/v1/notification-preferences',
        [
            'event' => 'unknown.event',
            'channel' => 'app',
            'enabled' => true,
        ],
        notificationPreferenceHeaders($this->tenant),
    );

    expectApiValidationErrors($response, 'event');
});

it('rejeita canal inválido', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->patchJson(
        '/api/v1/notification-preferences',
        [
            'event' => 'report.completed',
            'channel' => 'whatsapp',
            'enabled' => true,
        ],
        notificationPreferenceHeaders($this->tenant),
    );

    expectApiValidationErrors($response, 'channel');
});

it('exige autenticação para listar preferências', function (): void {
    $this->getJson(
        '/api/v1/notification-preferences',
        notificationPreferenceHeaders($this->tenant),
    )->assertUnauthorized();
});

it('exige autenticação para atualizar preferências', function (): void {
    $this->patchJson(
        '/api/v1/notification-preferences',
        [
            'event' => 'report.completed',
            'channel' => 'app',
            'enabled' => false,
        ],
        notificationPreferenceHeaders($this->tenant),
    )->assertUnauthorized();
});

it('retorna preferências atualizadas após múltiplas alterações', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson(
        '/api/v1/notification-preferences',
        ['event' => 'invite.accepted', 'channel' => 'app', 'enabled' => false],
        notificationPreferenceHeaders($this->tenant),
    )->assertOk();

    $this->patchJson(
        '/api/v1/notification-preferences',
        ['event' => 'invite.accepted', 'channel' => 'email', 'enabled' => false],
        notificationPreferenceHeaders($this->tenant),
    )->assertOk();

    $this->getJson(
        '/api/v1/notification-preferences',
        notificationPreferenceHeaders($this->tenant),
    )
        ->assertOk()
        ->tap(function ($response): void {
            $result = $response->json('result');

            expect($result['invite.accepted']['app'])->toBeFalse()
                ->and($result['invite.accepted']['email'])->toBeFalse();
        });
});

it('expõe eventos de plataforma e equipamento no serviço', function (): void {
    $events = array_keys(NotificationPreferenceService::EVENTS);

    expect($events)->toContain(
        'report.completed',
        'maintenance.sent',
        'loan.overdue',
        'digest.weekly',
    )
        ->and(count($events))->toBe(33);
});
