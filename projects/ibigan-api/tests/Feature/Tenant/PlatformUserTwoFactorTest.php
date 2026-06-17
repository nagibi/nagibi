<?php

declare(strict_types=1);

use App\Models\Central\CentralUser;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use PragmaRX\Google2FA\Google2FA;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'platform-2fa-'.uniqid();
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Platform 2FA Corp',
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

    $this->platformUser = $this->tenant->run(function (): User {
        $user = User::create([
            'email' => 'super@ibigan.com',
            'name' => 'Super Admin',
            'password' => Hash::make('random-tenant-password'),
            'is_platform_user' => true,
            'status' => 'active',
            'is_active' => true,
        ]);
        $user->assignRole('super-admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

it('permite desabilitar 2FA de platform user com senha central', function (): void {
    Sanctum::actingAs($this->platformUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->platformUser->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $this->postJson('/api/v1/two-factor/disable', [
        'password' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk();

    $user = $this->tenant->run(fn () => User::find($this->platformUser->id));
    expect($user->two_factor_confirmed_at)->toBeNull();
});

it('nega desabilitar 2FA de platform user com senha do tenant aleatória', function (): void {
    Sanctum::actingAs($this->platformUser, ['*'], 'sanctum');
    $this->postJson('/api/v1/two-factor/enable', [], ['X-Tenant-ID' => $this->tenant->id]);

    $user = $this->tenant->run(fn () => User::find($this->platformUser->id));
    $secret = Crypt::decryptString($user->two_factor_secret);
    $otp = (new Google2FA)->getCurrentOtp($secret);
    $this->postJson('/api/v1/two-factor/confirm', ['code' => $otp], ['X-Tenant-ID' => $this->tenant->id]);

    $this->postJson('/api/v1/two-factor/disable', [
        'password' => 'random-tenant-password',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable();
});
