<?php

declare(strict_types=1);

use App\Jobs\ProcessReportJob;
use App\Models\ReportTemplate;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-'.uniqid();
    $this->tenant = Tenant::create(['id' => $tenantId, 'slug' => $tenantId, 'name' => 'Test']);
    $this->tenant->run(fn () => $this->seed(RolePermissionSeeder::class));

    $this->admin = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    });

    $this->viewer = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('viewer');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function reportHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

it('lista relatórios para usuário com permissão', function (): void {
    $this->tenant->run(fn () => ReportTemplate::factory()->count(3)->create(['created_by' => $this->admin->id]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/reports', reportHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure(['result' => ['data', 'meta']]);
});

it('admin cria template de relatório', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/reports', [
        'name' => 'Usuários',
        'query' => 'SELECT id, name FROM users',
        'parameters' => [],
        'columns' => [['key' => 'id', 'label' => 'ID', 'format' => 'number']],
        'is_active' => true,
    ], reportHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.name', 'Usuários');
});

it('nega criação para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson('/api/v1/reports', [
        'name' => 'Teste',
        'query' => 'SELECT 1',
    ], reportHeaders($this->tenant->id))
        ->assertForbidden();
});

it('executa relatório com parâmetros', function (): void {
    Queue::fake();

    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'query' => 'SELECT id, name FROM users LIMIT 5',
        'parameters' => [],
        'is_active' => true,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson("/api/v1/reports/{$template->id}/execute", [
        'parameters' => [],
    ], reportHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.status', 'queued')
        ->assertJsonStructure(['result' => ['execution_id', 'status', 'progress_message']]);

    Queue::assertPushed(ProcessReportJob::class);
});

it('rejeita query com INSERT', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'query' => 'INSERT INTO users (name) VALUES ("hack")',
        'is_active' => true,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson("/api/v1/reports/{$template->id}/execute", [
        'parameters' => [],
    ], reportHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'query');
});

it('rejeita query que não começa com SELECT', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'query' => 'DROP TABLE users',
        'is_active' => true,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson("/api/v1/reports/{$template->id}/execute", [
        'parameters' => [],
    ], reportHeaders($this->tenant->id))
        ->assertUnprocessable();
});

it('registra execução no histórico', function (): void {
    Queue::fake();

    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'query' => 'SELECT id FROM users LIMIT 1',
        'is_active' => true,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson("/api/v1/reports/{$template->id}/execute", [
        'parameters' => [],
    ], reportHeaders($this->tenant->id))->assertOk();

    $this->getJson("/api/v1/reports/{$template->id}/executions", reportHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1)
        ->assertJsonPath('result.data.0.status', 'queued');
});

it('admin atualiza template', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create(['created_by' => $this->admin->id]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/reports/{$template->id}", [
        'name' => 'Nome Atualizado',
    ], reportHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.name', 'Nome Atualizado');
});

it('admin remove template', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create(['created_by' => $this->admin->id]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/reports/{$template->id}", [], reportHeaders($this->tenant->id))
        ->assertOk();
});

it('ativa registro', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'is_active' => false,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/reports/{$template->id}/toggle-active", [
        'is_active' => true,
    ], reportHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', true);
});

it('inativa registro', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'is_active' => true,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/reports/{$template->id}/toggle-active", [
        'is_active' => false,
    ], reportHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', false);
});

it('nega toggle para viewer', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create(['created_by' => $this->admin->id]));

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson("/api/v1/reports/{$template->id}/toggle-active", [
        'is_active' => false,
    ], reportHeaders($this->tenant->id))
        ->assertForbidden();
});

it('processa job e permite baixar resultado', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'query' => 'SELECT id, name FROM users LIMIT 2',
        'parameters' => [],
        'is_active' => true,
    ]));

    $executionId = null;

    $this->tenant->run(function () use ($template, &$executionId): void {
        tenancy()->initialize($this->tenant);

        $execution = app(\App\Services\ReportService::class)->execute(
            $template,
            [],
            $this->admin,
        );

        $executionId = $execution->id;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson(
        "/api/v1/reports/{$template->id}/executions/{$executionId}/result?page=1&per_page=10000",
        reportHeaders($this->tenant->id),
    )
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure(['result' => ['data', 'meta']]);
})->group('integration');

it('localiza resultado salvo em caminho legado do tenant', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'is_active' => true,
    ]));

    $execution = $this->tenant->run(function () use ($template) {
        $path = 'reports/legacy-result.json';
        $absolutePath = storage_path('tenant'.$this->tenant->id.'/app/'.$path);
        if (! is_dir(dirname($absolutePath))) {
            mkdir(dirname($absolutePath), 0775, true);
        }
        file_put_contents($absolutePath, json_encode([['id' => 1, 'name' => 'Legacy']], JSON_THROW_ON_ERROR));

        return \App\Models\ReportExecution::query()->create([
            'report_template_id' => $template->id,
            'executed_by' => $this->admin->id,
            'parameters' => [],
            'status' => 'completed',
            'result_path' => $path,
            'result_rows_count' => 1,
            'result_expires_at' => now()->addDays(7),
            'executed_at' => now(),
        ]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson(
        "/api/v1/reports/{$template->id}/executions/{$execution->id}/result?page=1&per_page=10000",
        reportHeaders($this->tenant->id),
    )
        ->assertOk()
        ->assertJsonPath('result.data.0.name', 'Legacy');
});

it('permite baixar resultado salvo mesmo com status failed', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'is_active' => true,
    ]));

    $execution = $this->tenant->run(function () use ($template) {
        $path = 'reports/failed-with-result.json';
        \Illuminate\Support\Facades\Storage::disk('local')->put(
            $path,
            json_encode([['mes' => '2026-01', 'total' => 1]], JSON_THROW_ON_ERROR),
        );

        return \App\Models\ReportExecution::query()->create([
            'report_template_id' => $template->id,
            'executed_by' => $this->admin->id,
            'parameters' => [],
            'status' => 'failed',
            'error_message' => 'Falha ao enviar e-mail.',
            'result_path' => $path,
            'result_rows_count' => 1,
            'result_expires_at' => now()->addDays(7),
            'executed_at' => now(),
        ]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson(
        "/api/v1/reports/{$template->id}/executions/{$execution->id}/result?page=1&per_page=10000",
        reportHeaders($this->tenant->id),
    )
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.data.0.total', 1);
});

it('permite download csv via url assinada sem autenticação', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'name' => 'Campanhas por status',
        'columns' => [
            ['key' => 'status', 'label' => 'Status'],
            ['key' => 'total', 'label' => 'Total'],
        ],
        'is_active' => true,
    ]));

    $execution = $this->tenant->run(function () use ($template) {
        $path = 'reports/email-download.json';
        \Illuminate\Support\Facades\Storage::disk('local')->put(
            $path,
            json_encode([
                ['status' => 'active', 'total' => 2],
                ['status' => 'paused', 'total' => 1],
            ], JSON_THROW_ON_ERROR),
        );

        return \App\Models\ReportExecution::query()->create([
            'report_template_id' => $template->id,
            'executed_by' => $this->admin->id,
            'parameters' => [],
            'status' => 'completed',
            'result_path' => $path,
            'result_rows_count' => 2,
            'result_expires_at' => now()->addDays(7),
            'duration_ms' => 4,
            'executed_at' => now(),
        ]);
    });

    $url = \Illuminate\Support\Facades\URL::temporarySignedRoute(
        'reports.executions.download',
        now()->addDays(7),
        [
            'tenant' => $this->tenant->id,
            'report' => $template->id,
            'execution' => $execution->id,
        ],
    );

    $this->get($url)
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=UTF-8')
        ->assertHeader('content-disposition', 'attachment; filename="Campanhas-por-status.csv"');

    expect($this->get($url)->getContent())->toContain('Status')
        ->and($this->get($url)->getContent())->toContain('active');
});

it('rejeita download csv com url não assinada', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'is_active' => true,
    ]));

    $execution = $this->tenant->run(fn () => \App\Models\ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->admin->id,
        'parameters' => [],
        'status' => 'completed',
        'result_path' => null,
        'result_rows_count' => 0,
        'result_expires_at' => now()->addDays(7),
        'executed_at' => now(),
    ]));

    $this->get("/api/v1/tenants/{$this->tenant->id}/reports/{$template->id}/executions/{$execution->id}/download")
        ->assertForbidden();
});

it('marca execuções antigas em running como failed ao listar histórico', function (): void {
    $template = $this->tenant->run(fn () => ReportTemplate::factory()->create([
        'created_by' => $this->admin->id,
        'query' => 'SELECT id FROM users LIMIT 1',
        'is_active' => true,
    ]));

    $this->tenant->run(fn () => \App\Models\ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->admin->id,
        'parameters' => [],
        'status' => 'running',
        'progress_message' => 'Processando registros...',
        'executed_at' => now()->subHours(2),
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/reports/{$template->id}/executions", reportHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.data.0.status', 'failed')
        ->assertJsonPath('result.data.0.error_message', 'Execução expirada ou interrompida.');
});
