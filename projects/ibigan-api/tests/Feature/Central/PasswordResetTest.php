<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-'.uniqid();
    /** @var TestCase&object{tenant: Tenant, user: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
        'timezone' => config('app.default_timezone'),
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->user = $this->tenant->run(function (): User {
        $user = User::factory()->create([
            'email' => 'admin@test.com',
            'password' => bcrypt('senha123'),
        ]);
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

// --- Forgot Password ---

it('envia link de reset para email válido', function (): void {
    Notification::fake();

    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'admin@test.com',
        'tenant_id' => $this->tenant->id,
    ])->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function (): void {
        Notification::assertSentTo($this->user, ResetPasswordNotification::class);
    });
});

it('responde ok mesmo para email inexistente (segurança)', function (): void {
    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'naoexiste@test.com',
        'tenant_id' => $this->tenant->id,
    ])->assertOk()
        ->assertJsonPath('status', 1);
});

it('nega forgot-password com tenant inexistente', function (): void {
    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'admin@test.com',
        'tenant_id' => 'tenant-inexistente',
    ])->assertUnprocessable();
});

it('nega forgot-password sem campos obrigatórios', function (): void {
    $response = $this->postJson('/api/v1/auth/forgot-password', [])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed');

    $fields = collect($response->json('errors'))->pluck('field')->all();

    expect($fields)->toContain('email', 'tenant_id');
});

// --- Reset Password ---

it('redefine senha com token válido', function (): void {
    $token = null;

    $this->tenant->run(function () use (&$token): void {
        $token = Password::broker()->createToken($this->user);
    });

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'admin@test.com',
        'token' => $token,
        'tenant_id' => $this->tenant->id,
        'password' => 'novaSenha123',
        'password_confirmation' => 'novaSenha123',
    ])->assertOk()
        ->assertJsonPath('status', 1);

    // Confirmar que login funciona com nova senha
    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@test.com',
        'password' => 'novaSenha123',
        'tenant_id' => $this->tenant->id,
    ])->assertOk();
});

it('nega reset com token inválido', function (): void {
    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'admin@test.com',
        'token' => 'token-invalido',
        'tenant_id' => $this->tenant->id,
        'password' => 'novaSenha123',
        'password_confirmation' => 'novaSenha123',
    ])->assertUnprocessable();
});

it('nega reset com senha fraca', function (): void {
    $token = null;

    $this->tenant->run(function () use (&$token): void {
        $token = Password::broker()->createToken($this->user);
    });

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'admin@test.com',
        'token' => $token,
        'tenant_id' => $this->tenant->id,
        'password' => '123',
        'password_confirmation' => '123',
    ])->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'password');
});

it('nega reset sem campos obrigatórios', function (): void {
    $response = $this->postJson('/api/v1/auth/reset-password', [])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed');

    $fields = collect($response->json('errors'))->pluck('field')->all();

    expect($fields)->toContain('email', 'token', 'tenant_id', 'password');
});

it('invalida tokens anteriores após reset', function (): void {
    $token = null;

    $this->tenant->run(function () use (&$token): void {
        $token = Password::broker()->createToken($this->user);
    });

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'admin@test.com',
        'token' => $token,
        'tenant_id' => $this->tenant->id,
        'password' => 'novaSenha123',
        'password_confirmation' => 'novaSenha123',
    ])->assertOk();

    // Tentar usar o mesmo token novamente deve falhar
    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'admin@test.com',
        'token' => $token,
        'tenant_id' => $this->tenant->id,
        'password' => 'outraSenha123',
        'password_confirmation' => 'outraSenha123',
    ])->assertUnprocessable();
});
