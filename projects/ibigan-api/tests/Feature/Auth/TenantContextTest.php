<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stancl\Tenancy\Database\Models\Domain;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-ctx-'.uniqid();

    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => 'techctx',
        'name' => 'Tech Context',
        'is_active' => true,
    ]);

    $this->host = 'techctx.localhost';

    Domain::create([
        'domain' => $this->host,
        'tenant_id' => $this->tenant->id,
    ]);
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function tenantContextRequest(string $host, ?string $query = null): \Illuminate\Testing\TestResponse
{
    $url = "http://{$host}/api/v1/auth/tenant-context".($query ? '?'.$query : '');

    return test()->getJson($url);
}

it('resolve tenant pelo dominio cadastrado', function (): void {
    tenantContextRequest($this->host)
        ->assertOk()
        ->assertJsonPath('result.resolved', true)
        ->assertJsonPath('result.source', 'domain')
        ->assertJsonPath('result.tenant.id', $this->tenant->id);
});

it('resolve tenant por subdominio de desenvolvimento sem registro de dominio', function (): void {
    Domain::query()->where('domain', $this->host)->delete();

    tenantContextRequest($this->host)
        ->assertOk()
        ->assertJsonPath('result.resolved', true)
        ->assertJsonPath('result.source', 'subdomain')
        ->assertJsonPath('result.tenant.slug', 'techctx');
});

it('resolve tenant por query no host central', function (): void {
    tenantContextRequest('localhost', 'tenant=techctx')
        ->assertOk()
        ->assertJsonPath('result.resolved', true)
        ->assertJsonPath('result.source', 'query')
        ->assertJsonPath('result.is_central_host', true);
});

it('resolve tenant por query no host central de producao', function (): void {
    config(['tenant-context.central_hosts' => ['nagibi.com.br']]);

    tenantContextRequest('nagibi.com.br', 'tenant=techctx')
        ->assertOk()
        ->assertJsonPath('result.resolved', true)
        ->assertJsonPath('result.source', 'query')
        ->assertJsonPath('result.is_central_host', true)
        ->assertJsonPath('result.tenant.slug', 'techctx');
});

it('trata www como host central quando apex esta configurado', function (): void {
    config(['tenant-context.central_hosts' => ['nagibi.com.br']]);

    tenantContextRequest('www.nagibi.com.br', 'tenant=techctx')
        ->assertOk()
        ->assertJsonPath('result.is_central_host', true)
        ->assertJsonPath('result.resolved', true);
});

it('nao resolve tenant no host central sem query', function (): void {
    tenantContextRequest('localhost')
        ->assertOk()
        ->assertJsonPath('result.resolved', false)
        ->assertJsonPath('result.is_central_host', true);
});

it('nao resolve tenant por query fora do host central', function (): void {
    tenantContextRequest('unknown.example', 'tenant=techctx')
        ->assertOk()
        ->assertJsonPath('result.resolved', false)
        ->assertJsonPath('result.is_central_host', false);
});

it('resolve tenant por subdominio de producao', function (): void {
    config([
        'tenant-context.central_hosts' => ['nagibi.com.br'],
        'tenant-context.dev_subdomain_suffixes' => ['nagibi.com.br'],
    ]);

    Domain::query()->where('domain', $this->host)->delete();

    tenantContextRequest('techctx.nagibi.com.br')
        ->assertOk()
        ->assertJsonPath('result.resolved', true)
        ->assertJsonPath('result.source', 'subdomain')
        ->assertJsonPath('result.tenant.slug', 'techctx');
});

it('resolve tenant pelo host informado via X-Forwarded-Host', function (): void {
    Domain::query()->where('domain', $this->host)->delete();

    $url = '/api/v1/auth/tenant-context';

    test()->getJson($url, [
        'X-Forwarded-Host' => $this->host,
    ])
        ->assertOk()
        ->assertJsonPath('result.resolved', true)
        ->assertJsonPath('result.source', 'subdomain')
        ->assertJsonPath('result.tenant.slug', 'techctx');
});

it('faz login sem tenant_id quando host identifica empresa', function (): void {
    $this->tenant->run(function (): void {
        User::factory()->create([
            'email' => 'login-context@ibigan.com',
            'password' => bcrypt('password123'),
        ]);
    });

    test()->postJson("http://{$this->host}/api/v1/auth/login", [
        'email' => 'login-context@ibigan.com',
        'password' => 'password123',
    ])
        ->assertOk()
        ->assertJsonPath('result.tenant_id', $this->tenant->id);
});
