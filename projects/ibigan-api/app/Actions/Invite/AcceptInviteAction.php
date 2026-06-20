<?php

declare(strict_types=1);

namespace App\Actions\Invite;

use App\Enums\InviteStatus;
use App\Http\Requests\Invite\AcceptInviteRequest;
use App\Models\Central\TenantUser;
use App\Models\Invite;
use App\Models\User;
use App\Models\UserApproval;
use App\Notifications\UserPendingApprovalNotification;
use App\Repositories\Contracts\InviteRepositoryInterface;
use App\Services\PlatformNotificationService;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class AcceptInviteAction
{
    public function __construct(
        private readonly InviteRepositoryInterface $inviteRepository,
        private readonly PlatformNotificationService $platformNotificationService,
    ) {}

    /**
     * @return array{token: string, tenant_id: string, user: array{id: int, name: string, email: string, roles: mixed, permissions: mixed}}
     */
    public function execute(AcceptInviteRequest $request, string $tenantId): array
    {
        $invite = Invite::query()
            ->where('token', $request->validated('token'))
            ->first();

        if (! $invite) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Convite não encontrado.');
        }

        if (! $invite->isPending()) {
            throw new HttpException(Response::HTTP_UNPROCESSABLE_ENTITY, 'Convite já utilizado ou cancelado.');
        }

        if ($invite->isExpired()) {
            $this->inviteRepository->update($invite, ['status' => InviteStatus::Expired]);

            throw new HttpException(Response::HTTP_UNPROCESSABLE_ENTITY, 'Convite expirado.');
        }

        if (User::query()->where('email', $invite->email)->exists()) {
            throw new HttpException(Response::HTTP_UNPROCESSABLE_ENTITY, 'E-mail já cadastrado.');
        }

        $user = User::create([
            'name' => $request->validated('name'),
            'email' => $invite->email,
            'password' => $request->validated('password'),
        ]);

        $user->assignRole($invite->role);

        if (tenant()->require_admin_approval) {
            $user->update(['is_active' => false]);

            UserApproval::create([
                'user_id' => $user->id,
                'status' => 'pending',
            ]);

            User::role('admin')->each(
                fn (User $admin) => $admin->notify(new UserPendingApprovalNotification($user))
            );
        }

        $this->inviteRepository->update($invite, [
            'status' => InviteStatus::Accepted,
            'accepted_at' => now(),
        ]);

        $this->platformNotificationService->inviteAccepted($invite, $user);

        $token = $user->createToken('api-token')->plainTextToken;

        $result = [
            'token' => $token,
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ];

        TenantUser::create([
            'tenant_id' => $tenantId,
            'user_id' => $result['user_id'],
            'role' => $invite->role,
            'is_default' => false,
            'joined_at' => now(),
        ]);

        unset($result['user_id']);

        return $result;
    }
}
