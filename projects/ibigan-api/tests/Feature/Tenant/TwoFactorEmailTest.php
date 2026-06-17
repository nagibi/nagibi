<?php

declare(strict_types=1);

use App\Enums\TwoFactorMethod;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\TwoFactorCodeNotification;
use App\Support\MessageTemplateSlugs;
use App\Support\SystemMessageTemplates;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'email-2fa-'.uniqid();
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Email 2FA Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
        SystemMessageTemplates::seed();
    });

    $this->user = $this->tenant->run(function (): User {
        $user = User::factory()->create([
            'email' => 'user@test.com',
            'password' => bcrypt('senha123'),
        ]);
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

it('habilita 2FA por e-mail e confirma com código', function (): void {
    Notification::fake();

    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->postJson('/api/v1/two-factor/enable', ['method' => 'email'], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.method', 'email')
        ->assertJsonStructure(['result' => ['masked_email', 'recovery_codes']]);

    Notification::assertSentTo($this->user, TwoFactorCodeNotification::class);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $code = Cache::get('two_factor_setup_code:'.$user->id);

    expect($code)->not->toBeNull();

    $this->postJson('/api/v1/two-factor/confirm', ['code' => $code], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk();

    $user->refresh();
    expect($user->two_factor_confirmed_at)->not->toBeNull();
    expect($user->two_factor_method)->toBe(TwoFactorMethod::Email);
});

it('login com 2FA por e-mail envia código e valida challenge', function (): void {
    Notification::fake();

    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', ['method' => 'email'], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $setupCode = Cache::get('two_factor_setup_code:'.$user->id);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $setupCode], ['X-Tenant-ID' => $this->tenant->id]);

    Notification::fake();

    $loginResponse = $this->postJson('/api/v1/auth/login', [
        'email' => 'user@test.com',
        'password' => 'senha123',
        'tenant_id' => $this->tenant->id,
    ])
        ->assertOk()
        ->assertJsonPath('result.two_factor_method', 'email');

    Notification::assertSentTo($this->user, TwoFactorCodeNotification::class);

    $twoFactorToken = $loginResponse->json('result.two_factor_token');
    tenancy()->end();
    $loginCode = Cache::get('two_factor_login_code:'.$twoFactorToken);

    expect($loginCode)->not->toBeNull();

    $this->postJson('/api/v1/auth/two-factor-challenge', [
        'two_factor_token' => $twoFactorToken,
        'code' => $loginCode,
    ])
        ->assertOk()
        ->assertJsonStructure(['result' => ['token', 'user']]);
});

it('expõe status do 2FA com método', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->getJson('/api/v1/two-factor/status', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.enabled', false);

    Notification::fake();
    $this->postJson('/api/v1/two-factor/enable', ['method' => 'email'], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $setupCode = Cache::get('two_factor_setup_code:'.$user->id);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $setupCode], ['X-Tenant-ID' => $this->tenant->id]);

    $this->getJson('/api/v1/two-factor/status', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.enabled', true)
        ->assertJsonPath('result.method', 'email');
});
