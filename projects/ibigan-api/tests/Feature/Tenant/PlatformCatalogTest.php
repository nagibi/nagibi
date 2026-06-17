<?php

declare(strict_types=1);

use App\Models\MessageTemplate;
use App\Models\ReportTemplate;
use App\Models\Tenant;
use App\Models\User;
use App\Support\MessageTemplateSlugs;
use App\Support\ReportPlatformKeys;
use App\Services\PlatformCatalogService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'catalog-'.uniqid();
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Catalog Corp',
    ]);

    $this->tenant->run(function (): void {
        (new RolePermissionSeeder)->run();
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

it('provisiona templates de sistema ao rodar RolePermissionSeeder', function (): void {
    $this->tenant->run(function (): void {
        expect(MessageTemplate::query()->where('is_system', true)->count())->toBeGreaterThan(0);
        expect(MessageTemplate::query()->where('slug', MessageTemplateSlugs::TWO_FACTOR_CODE)->exists())->toBeTrue();
    });
});

it('sincroniza relatórios de plataforma quando há usuário admin', function (): void {
    $this->tenant->run(function (): void {
        $counts = app(PlatformCatalogService::class)->sync($this->admin->id);

        expect($counts['report_templates'])->toBe(4);
        expect(ReportTemplate::query()->where('platform_key', ReportPlatformKeys::USERS_MONTHLY)->value('is_system'))->toBeTrue();
    });
});

it('impede remoção de template de plataforma', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $templateId = $this->tenant->run(function (): int {
        return (int) MessageTemplate::query()
            ->where('slug', MessageTemplateSlugs::PASSWORD_RESET)
            ->value('id');
    });

    $this->deleteJson("/api/v1/message-templates/{$templateId}", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'catalog');
});

it('impede remoção de relatório de plataforma', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->tenant->run(fn () => app(PlatformCatalogService::class)->sync($this->admin->id));

    $reportId = $this->tenant->run(function (): int {
        return (int) ReportTemplate::query()
            ->where('platform_key', ReportPlatformKeys::USERS_MONTHLY)
            ->value('id');
    });

    $this->deleteJson("/api/v1/reports/{$reportId}", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'catalog');
});

it('impede edição de template de plataforma no tenant', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $template = $this->tenant->run(function (): MessageTemplate {
        return MessageTemplate::query()
            ->where('slug', MessageTemplateSlugs::PASSWORD_RESET)
            ->firstOrFail();
    });

    $this->putJson("/api/v1/message-templates/{$template->id}", [
        'name' => 'Nome alterado',
        'slug' => $template->slug,
        'subject' => 'Assunto alterado',
        'body' => $template->body,
        'merge_tags' => $template->merge_tags,
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'catalog');
});

it('impede edição de relatório de plataforma no tenant', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->tenant->run(fn () => app(PlatformCatalogService::class)->sync($this->admin->id));

    $reportId = $this->tenant->run(function (): int {
        return (int) ReportTemplate::query()
            ->where('platform_key', ReportPlatformKeys::USERS_MONTHLY)
            ->value('id');
    });

    $this->putJson("/api/v1/reports/{$reportId}", [
        'name' => 'Relatório alterado',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'catalog');
});
