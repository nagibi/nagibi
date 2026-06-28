<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant\Equipamento;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class EquipamentoUserController extends Controller
{
    public function lookup(Request $request): JsonResponse
    {
        $users = User::query()
            ->active()
            ->eligibleForEquipamentoPicker()
            ->with('roles:id,name')
            ->when($request->filled('search'), function (Builder $query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(function (Builder $inner) use ($search): void {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('cpf', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'cpf', 'status', 'is_active', 'is_super_admin'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'cpf' => $user->cpf,
                'status' => $user->status,
                'is_active' => (bool) $user->is_active,
                'is_super_admin' => (bool) $user->is_super_admin,
                'roles' => $user->getRoleNames()->values()->all(),
            ])
            ->values();

        return ApiResponse::success($users);
    }
}
