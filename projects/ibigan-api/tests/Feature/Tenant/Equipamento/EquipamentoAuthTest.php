<?php

declare(strict_types=1);

use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('nega acesso aos endpoints de equipamento sem autenticacao', function (): void {
    $tenantId = 'tenant-' . uniqid();
    $tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Equipamento Auth Test',
        'is_active' => true,
    ]);

    $this->getJson('/api/v1/equipamentos', ['X-Tenant-ID' => $tenantId])
        ->assertUnauthorized();

    cleanupTenantDatabaseFiles($tenantId);
});
