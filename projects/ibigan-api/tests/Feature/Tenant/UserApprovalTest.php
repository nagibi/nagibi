<?php

declare(strict_types=1);

use App\Enums\InviteStatus;
use App\Models\Invite;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserApproval;
use App\Notifications\UserApprovedNotification;
use App\Notifications\UserPendingApprovalNotification;
use App\Notifications\UserRejectedNotification;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-' . uniqid();
    /** @var TestCase&object{tenant: Tenant, admin: User, viewer: User} $this */
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
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function createPendingApproval(Tenant $tenant): array
{
    return $tenant->run(function (): array {
        $user = User::factory()->create(['is_active' => false]);
        $user->assignRole('viewer');

        $approval = UserApproval::create([
            'user_id' => $user->id,
            'status' => 'pending',
        ]);

        return ['user' => $user, 'approval' => $approval];
    });
}

// --- Index ---

it('lista aprovações pendentes para admin', function (): void {
    $data = createPendingApproval($this->tenant);

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/user-approvals', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.meta.total', 1)
        ->assertJsonPath('result.data.0.id', $data['approval']->id)
        ->assertJsonPath('result.data.0.user_email', $data['user']->email)
        ->assertJsonPath('result.data.0.status', 'pending');
});

it('filtra aprovações por status', function (): void {
    $this->tenant->run(function (): void {
        $approvedUser = User::factory()->create(['is_active' => true]);
        UserApproval::create(['user_id' => $approvedUser->id, 'status' => 'approved']);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/user-approvals?status=approved', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1)
        ->assertJsonPath('result.data.0.status', 'approved');
});

it('nega listagem de aprovações para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/user-approvals', ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

// --- Approve ---

it('aprova usuário pendente e ativa conta', function (): void {
    Notification::fake();

    $data = createPendingApproval($this->tenant);

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson(
        "/api/v1/user-approvals/{$data['approval']->id}/approve",
        [],
        ['X-Tenant-ID' => $this->tenant->id]
    )
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('message', 'MSG000425');

    $this->tenant->run(function () use ($data): void {
        $approval = UserApproval::find($data['approval']->id);
        expect($approval->status)->toBe('approved');
        expect($approval->reviewed_by)->toBe($this->admin->id);
        expect($approval->reviewed_at)->not->toBeNull();

        $user = User::find($data['user']->id);
        expect($user->is_active)->toBeTrue();
    });

    Notification::assertSentTo($data['user'], UserApprovedNotification::class);
});

it('nega aprovação para viewer', function (): void {
    $data = createPendingApproval($this->tenant);

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson(
        "/api/v1/user-approvals/{$data['approval']->id}/approve",
        [],
        ['X-Tenant-ID' => $this->tenant->id]
    )->assertForbidden();
});

it('nega aprovação de solicitação já aprovada', function (): void {
    $approval = $this->tenant->run(function (): UserApproval {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('viewer');

        return UserApproval::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'reviewed_by' => $this->admin->id,
            'reviewed_at' => now(),
        ]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson(
        "/api/v1/user-approvals/{$approval->id}/approve",
        [],
        ['X-Tenant-ID' => $this->tenant->id]
    )->assertUnprocessable();
});

// --- Reject ---

it('rejeita usuário pendente com motivo', function (): void {
    Notification::fake();

    $data = createPendingApproval($this->tenant);

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson(
        "/api/v1/user-approvals/{$data['approval']->id}/reject",
        ['reason' => 'Documentação incompleta'],
        ['X-Tenant-ID' => $this->tenant->id]
    )
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function () use ($data): void {
        $approval = UserApproval::find($data['approval']->id);
        expect($approval->status)->toBe('rejected');
        expect($approval->rejection_reason)->toBe('Documentação incompleta');
        expect($approval->reviewed_by)->toBe($this->admin->id);

        $user = User::find($data['user']->id);
        expect($user->is_active)->toBeFalse();
    });

    Notification::assertSentTo($data['user'], UserRejectedNotification::class);
});

it('nega rejeição para viewer', function (): void {
    $data = createPendingApproval($this->tenant);

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson(
        "/api/v1/user-approvals/{$data['approval']->id}/reject",
        [],
        ['X-Tenant-ID' => $this->tenant->id]
    )->assertForbidden();
});

it('nega rejeição de solicitação já rejeitada', function (): void {
    $approval = $this->tenant->run(function (): UserApproval {
        $user = User::factory()->create(['is_active' => false]);
        $user->assignRole('viewer');

        return UserApproval::create([
            'user_id' => $user->id,
            'status' => 'rejected',
            'reviewed_by' => $this->admin->id,
            'reviewed_at' => now(),
            'rejection_reason' => 'Já rejeitado',
        ]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson(
        "/api/v1/user-approvals/{$approval->id}/reject",
        [],
        ['X-Tenant-ID' => $this->tenant->id]
    )->assertUnprocessable();
});

// --- Accept invite with approval ---

it('aceita convite com aprovação admin pendente e notifica admins', function (): void {
    Notification::fake();

    $this->tenant->update(['require_admin_approval' => true]);

    $invite = $this->tenant->run(
        fn() => Invite::factory()->create([
            'invited_by' => $this->admin->id,
            'email' => 'pendente@test.com',
            'role' => 'viewer',
        ])
    );

    $this->postJson('/api/v1/invites/accept', [
        'token' => $invite->token,
        'name' => 'Usuário Pendente',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function () use ($invite): void {
        $user = User::where('email', 'pendente@test.com')->first();
        expect($user)->not->toBeNull();
        expect($user->is_active)->toBeFalse();

        $approval = UserApproval::where('user_id', $user->id)->first();
        expect($approval)->not->toBeNull();
        expect($approval->status)->toBe('pending');

        $fresh = Invite::find($invite->id);
        expect($fresh->status)->toBe(InviteStatus::Accepted);
    });

    Notification::assertSentTo($this->admin, UserPendingApprovalNotification::class);
});
