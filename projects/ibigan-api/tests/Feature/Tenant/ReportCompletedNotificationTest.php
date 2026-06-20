<?php

declare(strict_types=1);

use App\Mail\TemplateMailable;
use App\Models\MessageTemplate;
use App\Models\ReportExecution;
use App\Models\ReportTemplate;
use App\Models\User;
use App\Notifications\ReportCompletedNotification;
use App\Support\MessageTemplateSlugs;
use App\Support\SystemMessageTemplates;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-'.uniqid();
    $this->tenant = \App\Models\Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
        SystemMessageTemplates::seed();
    });

    $this->user = $this->tenant->run(fn () => User::factory()->create([
        'email' => 'admin@test.com',
        'status' => 'active',
    ]));

    $this->tenant->run(fn () => $this->user->assignRole('admin'));
});

it('usa template de mensagem na notificacao de relatorio concluido', function (): void {
    tenancy()->initialize($this->tenant);

    $template = ReportTemplate::query()->create([
        'name' => 'Usuários ativos',
        'slug' => 'usuarios-ativos',
        'query' => 'SELECT 1',
        'parameters' => [],
        'is_active' => true,
        'created_by' => $this->user->id,
    ]);

    $execution = ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->user->id,
        'parameters' => [],
        'status' => 'completed',
        'result_rows_count' => 42,
        'duration_ms' => 1500,
        'result_expires_at' => now()->addDays(7),
        'executed_at' => now(),
    ]);

    $execution->setRelation('template', $template);

    URL::defaults(['tenant' => $this->tenant->id]);

    $notification = new ReportCompletedNotification($execution, 'app');
    $payload = $notification->toArray($this->user);

    expect($payload['subject'])->toBe('Relatório pronto: Usuários ativos');
    expect($payload['body'])->toContain('Relatório Executado!');
    expect($payload['body'])->toContain('Usuários ativos');
    expect($payload['body'])->toContain('42 registros encontrados em 1500ms');
    expect($payload['body'])->toContain('O resultado estará disponível por 7 dias.');
    expect($payload['slug'])->toBe(MessageTemplateSlugs::REPORT_COMPLETED);

    $storedTemplate = MessageTemplate::query()
        ->where('slug', MessageTemplateSlugs::REPORT_COMPLETED)
        ->first();

    expect($storedTemplate)->not->toBeNull();
    expect($storedTemplate->name)->toBe('Relatório pronto');
});

it('envia notificacao de relatorio concluido com assunto do template', function (): void {
    tenancy()->initialize($this->tenant);

    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $template = ReportTemplate::query()->create([
        'name' => 'Vendas mensais',
        'slug' => 'vendas-mensais',
        'query' => 'SELECT 1',
        'parameters' => [],
        'is_active' => true,
        'created_by' => $this->user->id,
    ]);

    $execution = ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->user->id,
        'parameters' => [],
        'status' => 'completed',
        'result_rows_count' => 10,
        'duration_ms' => 900,
        'result_expires_at' => now()->addDays(7),
        'executed_at' => now(),
    ]);

    $execution->load('template');
    URL::defaults(['tenant' => $this->tenant->id]);

    $this->user->notify(new ReportCompletedNotification($execution, 'app'));

    $databaseNotification = $this->user->notifications()->first();

    expect($databaseNotification)->not->toBeNull();
    expect($databaseNotification->data['subject'])->toBe('Relatório pronto: Vendas mensais');
    expect($databaseNotification->data['slug'])->toBe(MessageTemplateSlugs::REPORT_COMPLETED);
});

it('monta email html com botao download', function (): void {
    tenancy()->initialize($this->tenant);

    $template = ReportTemplate::query()->create([
        'name' => 'Campanhas por tenant',
        'slug' => 'campanhas-por-tenant',
        'query' => 'SELECT 1',
        'parameters' => [],
        'is_active' => true,
        'created_by' => $this->user->id,
    ]);

    $execution = ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->user->id,
        'parameters' => [],
        'status' => 'completed',
        'result_rows_count' => 3,
        'duration_ms' => 2,
        'result_expires_at' => now()->addDays(7),
        'executed_at' => now(),
    ]);

    $execution->setRelation('template', $template);
    URL::defaults(['tenant' => $this->tenant->id]);

    $notification = new ReportCompletedNotification($execution, 'email');
    $mail = $notification->toMail($this->user);

    expect($mail)->toBeInstanceOf(TemplateMailable::class);

    $rendered = $mail->render();

    expect($rendered)->toContain('Relatório Executado!');
    expect($rendered)->toContain('Campanhas por tenant');
    expect($rendered)->toContain('DOWNLOAD');
    expect($rendered)->toContain('3 registros encontrados em 2ms');
    expect($rendered)->toContain('Equipe '.config('email-branding.brand_name'));
});

it('define destinatario no email de relatorio concluido', function (): void {
    tenancy()->initialize($this->tenant);

    $template = ReportTemplate::query()->create([
        'name' => 'Vendas mensais',
        'slug' => 'vendas-mensais',
        'query' => 'SELECT 1',
        'parameters' => [],
        'is_active' => true,
        'created_by' => $this->user->id,
    ]);

    $execution = ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->user->id,
        'parameters' => [],
        'status' => 'completed',
        'result_rows_count' => 10,
        'duration_ms' => 900,
        'result_expires_at' => now()->addDays(7),
        'executed_at' => now(),
    ]);

    $execution->load('template');
    URL::defaults(['tenant' => $this->tenant->id]);

    $mail = (new ReportCompletedNotification($execution, 'email'))->toMail($this->user);

    expect($mail)->toBeInstanceOf(TemplateMailable::class);
    expect($mail->hasTo($this->user->email))->toBeTrue();
});

it('usa corpo do template cadastrado no banco', function (): void {
    tenancy()->initialize($this->tenant);

    MessageTemplate::query()
        ->where('slug', MessageTemplateSlugs::REPORT_COMPLETED)
        ->update([
            'body' => 'Relatório {{report_name}} concluído com {{rows_summary}}.',
        ]);

    $template = ReportTemplate::query()->create([
        'name' => 'Relatório mensal',
        'slug' => 'relatorio-mensal',
        'query' => 'SELECT 1',
        'parameters' => [],
        'is_active' => true,
        'created_by' => $this->user->id,
    ]);

    $execution = ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->user->id,
        'parameters' => [],
        'status' => 'completed',
        'result_rows_count' => 5,
        'duration_ms' => 120,
        'result_expires_at' => now()->addDays(7),
        'executed_at' => now(),
    ]);

    $execution->setRelation('template', $template);
    URL::defaults(['tenant' => $this->tenant->id]);

    $notification = new ReportCompletedNotification($execution, 'app');
    $payload = $notification->toArray($this->user);

    expect($payload['body'])->toBe('Relatório Relatório mensal concluído com 5 registros encontrados em 120ms.');
});

it('substitui merge tags mesmo quando template no banco esta em uma linha', function (): void {
    tenancy()->initialize($this->tenant);

    MessageTemplate::query()
        ->where('slug', MessageTemplateSlugs::REPORT_COMPLETED)
        ->update([
            'body' => 'Hello! Seu relatório {{report_name}} foi processado com sucesso. {{rows_summary}}. O resultado estará disponível por 7 dias.',
        ]);

    $template = ReportTemplate::query()->create([
        'name' => 'Campanhas por tenant',
        'slug' => 'campanhas-por-tenant',
        'query' => 'SELECT 1',
        'parameters' => [],
        'is_active' => true,
        'created_by' => $this->user->id,
    ]);

    $execution = ReportExecution::query()->create([
        'report_template_id' => $template->id,
        'executed_by' => $this->user->id,
        'parameters' => [],
        'status' => 'completed',
        'result_rows_count' => 3,
        'duration_ms' => 2,
        'result_expires_at' => now()->addDays(7),
        'executed_at' => now(),
    ]);

    $execution->setRelation('template', $template);
    URL::defaults(['tenant' => $this->tenant->id]);

    $notification = new ReportCompletedNotification($execution, 'app');
    $payload = $notification->toArray($this->user);

    expect($payload['body'])->toContain('Campanhas por tenant');
    expect($payload['body'])->toContain('3 registros encontrados em 2ms');
    expect($payload['body'])->not->toContain('{{report_name}}');
    expect($payload['body'])->not->toContain('{{rows_summary}}');
});
