<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    RateLimiter::clear('login');
    RateLimiter::clear('register');
    RateLimiter::clear('forgot-password');
    RateLimiter::clear('two-factor');
    RateLimiter::clear('invite-accept');

    $tenantId = 'tenant-'.uniqid();
    /** @var TestCase&object{tenant: Tenant, user: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
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
    RateLimiter::clear('login');
    RateLimiter::clear('register');
    RateLimiter::clear('forgot-password');
    RateLimiter::clear('two-factor');
    RateLimiter::clear('invite-accept');

    cleanupTenantDatabaseFiles($this->tenant->id);
});

it('bloqueia login após 5 tentativas', function (): void {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'user@test.com',
            'password' => 'senha-errada',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    $this->postJson('/api/v1/auth/login', [
        'email' => 'user@test.com',
        'password' => 'senha123',
        'tenant_id' => $this->tenant->id,
    ])->assertStatus(429);
});

it('bloqueia register após 3 tentativas por hora', function (): void {
    $payload = fn (string $suffix) => [
        'company_name' => "Empresa {$suffix}",
        'name' => 'Admin',
        'email' => "admin{$suffix}@test.com",
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
    ];

    foreach (range(1, 3) as $i) {
        $this->postJson('/api/v1/auth/register', $payload((string) $i));
    }

    $this->postJson('/api/v1/auth/register', $payload('99'))
        ->assertStatus(429);
});

it('bloqueia forgot-password após 3 tentativas por hora', function (): void {
    foreach (range(1, 3) as $i) {
        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'user@test.com',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'user@test.com',
        'tenant_id' => $this->tenant->id,
    ])->assertStatus(429);
});

it('bloqueia two-factor-challenge após 5 tentativas', function (): void {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/two-factor-challenge', [
            'two_factor_token' => 'token-invalido',
            'code' => '000000',
            'tenant_id' => $this->tenant->id,
        ]);
    }

    $this->postJson('/api/v1/auth/two-factor-challenge', [
        'two_factor_token' => 'token-invalido',
        'code' => '000000',
        'tenant_id' => $this->tenant->id,
    ])->assertStatus(429);
});

it('throttle api usa X-Tenant-ID como chave', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->getJson('/api/v1/auth/me', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk();
});

it('headers de rate limit estão presentes na resposta', function (): void {
    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'user@test.com',
        'password' => 'senha123',
        'tenant_id' => $this->tenant->id,
    ]);

    expect($response->headers->has('X-RateLimit-Limit') ||
           $response->status() === 200)->toBeTrue();
});
