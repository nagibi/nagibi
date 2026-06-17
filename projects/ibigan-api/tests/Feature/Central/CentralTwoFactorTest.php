<?php

declare(strict_types=1);

use App\Models\Central\CentralUser;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\TwoFactorCodeNotification;
use App\Services\TwoFactorSyncService;
use App\Support\SystemMessageTemplates;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use PragmaRX\Google2FA\Google2FA;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'central-2fa-'.uniqid();
    /** @var TestCase&object{tenant: Tenant, tenantUser: User, centralUser: CentralUser} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Central 2FA Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->centralUser = CentralUser::create([
        'name' => 'Super Admin',
        'email' => 'super@ibigan.com',
        'password' => 'senha123',
        'is_super_admin' => true,
        'is_active' => true,
    ]);

    $this->tenantUser = $this->tenant->run(function (): User {
        $user = User::factory()->create([
            'email' => 'super@ibigan.com',
            'password' => bcrypt('senha123'),
        ]);
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

it('login central retorna requires_2fa quando 2FA está ativo', function (): void {
    Sanctum::actingAs($this->tenantUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->tenantUser->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $this->postJson('/api/central/v1/auth/login', [
        'email' => 'super@ibigan.com',
        'password' => 'senha123',
    ])
        ->assertOk()
        ->assertJsonPath('result.requires_2fa', true)
        ->assertJsonStructure(['result' => ['requires_2fa', 'two_factor_token']]);
});

it('two-factor-challenge central retorna token com código válido', function (): void {
    Sanctum::actingAs($this->tenantUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->tenantUser->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $loginResponse = $this->postJson('/api/central/v1/auth/login', [
        'email' => 'super@ibigan.com',
        'password' => 'senha123',
    ]);

    $twoFactorToken = $loginResponse->json('result.two_factor_token');
    $newOtp = (new Google2FA)->getCurrentOtp($secret);

    $this->postJson('/api/v1/auth/two-factor-challenge', [
        'two_factor_token' => $twoFactorToken,
        'code' => $newOtp,
    ])
        ->assertOk()
        ->assertJsonPath('result.scope', 'central')
        ->assertJsonStructure(['result' => ['token', 'user']]);
});

it('sincroniza 2FA do tenant para central ao confirmar', function (): void {
    Sanctum::actingAs($this->tenantUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->tenantUser->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $centralUser = CentralUser::query()->where('email', 'super@ibigan.com')->first();

    expect($centralUser?->two_factor_confirmed_at)->not->toBeNull();
    expect($centralUser?->two_factor_secret)->not->toBeNull();
});

it('sincroniza 2FA existente ao consultar recovery codes', function (): void {
    Sanctum::actingAs($this->tenantUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->tenantUser->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    CentralUser::query()
        ->where('email', 'super@ibigan.com')
        ->update([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ]);

    $this->getJson('/api/v1/two-factor/recovery-codes', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk();

    $centralUser = CentralUser::query()->where('email', 'super@ibigan.com')->first();

    expect($centralUser?->two_factor_confirmed_at)->not->toBeNull();
});

it('limpa 2FA central ao desabilitar no tenant', function (): void {
    Sanctum::actingAs($this->tenantUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->tenantUser->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $this->postJson('/api/v1/two-factor/disable', [
        'password' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])->assertOk();

    $centralUser = CentralUser::query()->where('email', 'super@ibigan.com')->first();

    expect($centralUser?->two_factor_confirmed_at)->toBeNull();
    expect($centralUser?->two_factor_secret)->toBeNull();
});

it('login central com 2FA por e-mail valida código no cache central', function (): void {
    Notification::fake();

    $this->tenant->run(function (): void {
        SystemMessageTemplates::seed();
    });

    Sanctum::actingAs($this->tenantUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', ['method' => 'email'], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->tenantUser->id));
    $setupCode = Cache::get('two_factor_setup_code:'.$user->id);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $setupCode], ['X-Tenant-ID' => $this->tenant->id]);

    Notification::fake();

    $loginResponse = $this->postJson('/api/central/v1/auth/login', [
        'email' => 'super@ibigan.com',
        'password' => 'senha123',
    ])
        ->assertOk()
        ->assertJsonPath('result.two_factor_method', 'email');

    $twoFactorToken = $loginResponse->json('result.two_factor_token');

    tenancy()->end();
    $loginCode = Cache::get('two_factor_login_code:'.$twoFactorToken);
    expect($loginCode)->not->toBeNull();

    $this->postJson('/api/v1/auth/two-factor-challenge', [
        'two_factor_token' => $twoFactorToken,
        'code' => $loginCode,
    ])
        ->assertOk()
        ->assertJsonPath('result.scope', 'central');
});
