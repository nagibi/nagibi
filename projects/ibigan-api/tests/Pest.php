<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

function tenantDatabaseName(string $tenantId): string
{
    return config('tenancy.database.prefix').$tenantId.config('tenancy.database.suffix');
}

function tenantDatabasePath(string $tenantId): string
{
    return database_path(tenantDatabaseName($tenantId));
}

/**
 * Encerra tenancy, purga conexões e remove arquivos SQLite do tenant.
 *
 * @param  string  ...$tenantIds
 */
function cleanupTenantDatabaseFiles(string ...$tenantIds): void
{
    if (tenancy()->initialized) {
        tenancy()->end();
    }

    DB::purge('tenant');

    foreach ($tenantIds as $tenantId) {
        $basePath = tenantDatabasePath($tenantId);

        foreach ([$basePath, "{$basePath}-wal", "{$basePath}-shm"] as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }
}

pest()->extend(TestCase::class)
    ->in('Feature', 'Unit');

/**
 * @param  \Illuminate\Testing\TestResponse  $response
 * @param  string  ...$fields
 */
function expectApiValidationErrors($response, string ...$fields): void
{
    $response->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed');

    $errorFields = collect($response->json('errors'))->pluck('field')->all();

    expect($errorFields)->toContain(...$fields);
}

uses()
    ->afterEach(function (): void {
        if (tenancy()->initialized) {
            tenancy()->end();
        }

        DB::purge('tenant');
    })
    ->in('Feature');
