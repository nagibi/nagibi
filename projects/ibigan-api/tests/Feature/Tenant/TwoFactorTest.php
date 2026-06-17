<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Laravel\Sanctum\Sanctum;
use PragmaRX\Google2FA\Google2FA;

uses(RefreshDatabase::class);

beforeEach(function (): void {
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
    cleanupTenantDatabaseFiles($this->tenant->id);
});

// --- Enable ---

it('habilita 2FA e retorna QR code', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => ['qr_code_url', 'secret', 'recovery_codes'],
        ]);
});

it('nega habilitar 2FA sem autenticação', function (): void {
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnauthorized();
});

// --- Confirm ---

it('confirma 2FA com código OTP válido', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    // Habilitar primeiro
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $secret = Crypt::decryptString($user->two_factor_secret);

    $otp = (new Google2FA)->getCurrentOtp($secret);

    $this->postJson('/api/v1/two-factor/confirm', [
        'code' => $otp,
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function (): void {
        $user = User::find($this->user->id);
        expect($user->two_factor_confirmed_at)->not->toBeNull();
    });
});

it('nega confirmação com código inválido', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $this->postJson('/api/v1/two-factor/confirm', [
        'code' => '000000',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable();
});

// --- Disable ---

it('desabilita 2FA com senha correta', function (): void {
    // Setup: habilitar e confirmar
    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    // Desabilitar
    $this->postJson('/api/v1/two-factor/disable', [
        'password' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function (): void {
        $user = User::find($this->user->id);
        expect($user->two_factor_secret)->toBeNull();
        expect($user->two_factor_confirmed_at)->toBeNull();
    });
});

it('nega desabilitar 2FA com senha incorreta', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $this->postJson('/api/v1/two-factor/disable', [
        'password' => 'senha-errada',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable();
});

// --- Recovery Codes ---

it('retorna recovery codes', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $this->getJson('/api/v1/two-factor/recovery-codes', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonStructure(['result' => ['recovery_codes']]);
});

it('regenera recovery codes', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $first = $this->getJson('/api/v1/two-factor/recovery-codes', ['X-Tenant-ID' => $this->tenant->id])
        ->json('result.recovery_codes');

    $this->postJson('/api/v1/two-factor/recovery-codes', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk();

    $second = $this->getJson('/api/v1/two-factor/recovery-codes', ['X-Tenant-ID' => $this->tenant->id])
        ->json('result.recovery_codes');

    expect($first)->not->toBe($second);
});

// --- Login com 2FA ---

it('login retorna requires_2fa quando 2FA está ativo', function (): void {
    // Habilitar e confirmar 2FA
    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    // Logout
    $this->postJson('/api/v1/auth/logout', [], ['X-Tenant-ID' => $this->tenant->id]);

    // Login novamente
    $this->postJson('/api/v1/auth/login', [
        'email' => 'user@test.com',
        'password' => 'senha123',
        'tenant_id' => $this->tenant->id,
    ])
        ->assertOk()
        ->assertJsonPath('result.requires_2fa', true)
        ->assertJsonStructure(['result' => ['requires_2fa', 'two_factor_token']]);
});

it('two-factor-challenge retorna token com código válido', function (): void {
    // Setup completo
    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);
    $this->postJson('/api/v1/auth/logout', [], ['X-Tenant-ID' => $this->tenant->id]);

    // Login → pegar two_factor_token
    $loginResponse = $this->postJson('/api/v1/auth/login', [
        'email' => 'user@test.com',
        'password' => 'senha123',
        'tenant_id' => $this->tenant->id,
    ]);

    $twoFactorToken = $loginResponse->json('result.two_factor_token');
    $newOtp = (new Google2FA)->getCurrentOtp($secret);

    $this->postJson('/api/v1/auth/two-factor-challenge', [
        'two_factor_token' => $twoFactorToken,
        'code' => $newOtp,
        'tenant_id' => $this->tenant->id,
    ])
        ->assertOk()
        ->assertJsonStructure(['result' => ['token', 'user']]);
});

it('nega challenge com código inválido', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->user->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);
    $this->postJson('/api/v1/auth/logout', [], ['X-Tenant-ID' => $this->tenant->id]);

    $loginResponse = $this->postJson('/api/v1/auth/login', [
        'email' => 'user@test.com',
        'password' => 'senha123',
        'tenant_id' => $this->tenant->id,
    ]);

    $twoFactorToken = $loginResponse->json('result.two_factor_token');

    $this->postJson('/api/v1/auth/two-factor-challenge', [
        'two_factor_token' => $twoFactorToken,
        'code' => '000000',
        'tenant_id' => $this->tenant->id,
    ])->assertUnprocessable();
});
