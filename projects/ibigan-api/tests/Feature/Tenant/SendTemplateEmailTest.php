<?php

declare(strict_types=1);

use App\Jobs\SendTemplateEmailJob;
use App\Jobs\SendTemplateNotificationJob;
use App\Mail\TemplateMailable;
use App\Models\MessageTemplate;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\TemplateNotification;
use App\Services\MessageTemplateResolver;
use App\Services\TemplateMailService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-'.uniqid();
    /** @var TestCase&object{tenant: Tenant, admin: User, viewer: User, template: MessageTemplate} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

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

    $this->template = $this->tenant->run(fn () => MessageTemplate::factory()->create([
        'slug' => 'teste-envio-'.uniqid(),
        'subject' => 'Bem-vindo, {{nome}}!',
        'body' => 'Olá {{nome}}, bem-vindo à {{empresa}}!',
        'is_active' => true,
        'merge_tags' => ['{{nome}}', '{{empresa}}'],
    ]));
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function sendPayload(array $overrides = []): array
{
    return array_merge([
        'channels' => ['email'],
        'merge_data' => ['nome' => 'João', 'empresa' => 'Acme'],
    ], $overrides);
}

function testSendUrl(MessageTemplate $template): string
{
    return "/api/v1/message-templates/{$template->id}/test-send";
}

// --- Endpoint test-send ---

it('enfileira job ao enviar template por email', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson(testSendUrl($this->template), sendPayload(), ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.queued', 1)
        ->assertJsonPath('result.recipient', $this->admin->email);

    Queue::assertPushed(SendTemplateEmailJob::class);
});

it('enfileira job ao enviar template por notificação', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson(testSendUrl($this->template), sendPayload([
        'channels' => ['notification'],
    ]), ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.queued', 1)
        ->assertJsonPath('result.recipient', $this->admin->email);

    Queue::assertPushed(SendTemplateNotificationJob::class);
});

it('enfileira jobs para múltiplos canais', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson(testSendUrl($this->template), sendPayload([
        'channels' => ['email', 'notification'],
    ]), ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.queued', 2)
        ->assertJsonPath('result.recipient', $this->admin->email);

    Queue::assertPushed(SendTemplateEmailJob::class, 1);
    Queue::assertPushed(SendTemplateNotificationJob::class, 1);
});

it('nega envio para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson(testSendUrl($this->template), sendPayload(), ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

it('nega envio com canal inválido', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson(testSendUrl($this->template), sendPayload([
        'channels' => ['fax'],
    ]), ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'channels.0');
});

it('nega envio de template inativo', function (): void {
    $this->tenant->run(fn () => $this->template->update(['is_active' => false]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson(testSendUrl($this->template), sendPayload(), ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable();
});

// --- TemplateMailService ---

it('resolve merge tags corretamente', function (): void {
    $service = new TemplateMailService;

    $resolved = $service->resolve($this->template, [
        'nome' => 'João',
        'empresa' => 'Acme Corp',
    ]);

    expect($resolved['subject'])->toBe('Bem-vindo, João!')
        ->and($resolved['body'])->toBe('Olá João, bem-vindo à Acme Corp!');
});

it('mantém tags não substituídas intactas', function (): void {
    $service = new TemplateMailService;

    $resolved = $service->resolve($this->template, [
        'nome' => 'João',
    ]);

    expect($resolved['body'])->toContain('{{empresa}}');
});

// --- TemplateMailable ---

it('envia email com subject e body corretos', function (): void {
    Mail::fake();

    $this->tenant->run(function (): void {
        Mail::to('destino@test.com')->send(
            new TemplateMailable('Bem-vindo, João!', 'Olá João, bem-vindo à Acme!')
        );
    });

    Mail::assertSent(TemplateMailable::class, function (TemplateMailable $mail): bool {
        return $mail->hasTo('destino@test.com');
    });
});

// --- Job handle ---

it('job envia email ao ser processado', function (): void {
    Mail::fake();

    $this->tenant->run(function (): void {
        $job = new SendTemplateEmailJob(
            $this->template->slug,
            'destino@test.com',
            ['nome' => 'João', 'empresa' => 'Acme'],
        );

        $job->handle(app(MessageTemplateResolver::class));
    });

    Mail::assertSent(TemplateMailable::class);
});

it('job de notificação envia para usuário existente', function (): void {
    Notification::fake();

    $this->tenant->run(function (): void {
        $job = new SendTemplateNotificationJob(
            $this->template->slug,
            $this->admin->email,
            ['nome' => 'João', 'empresa' => 'Acme'],
        );

        $job->handle(app(MessageTemplateResolver::class));
    });

    Notification::assertSentTo($this->admin, TemplateNotification::class);
});

it('job de notificação ignora destinatário sem usuário cadastrado', function (): void {
    Notification::fake();

    $this->tenant->run(function (): void {
        $job = new SendTemplateNotificationJob(
            $this->template->slug,
            'inexistente@test.com',
            ['nome' => 'João'],
        );

        $job->handle(app(MessageTemplateResolver::class));
    });

    Notification::assertNothingSent();
});
