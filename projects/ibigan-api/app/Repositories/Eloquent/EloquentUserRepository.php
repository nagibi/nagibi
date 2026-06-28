<?php

declare(strict_types=1);

namespace App\Repositories\Eloquent;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Support\GridFilter;
use Illuminate\Database\Eloquent\Builder;

final class EloquentUserRepository extends BaseRepository implements UserRepositoryInterface
{
    private const SORTABLE_COLUMNS = [
        'id',
        'name',
        'email',
        'cpf',
        'phone',
        'birth_date',
        'gender',
        'status',
        'last_login_at',
        'created_at',
        'updated_at',
    ];

    public function __construct()
    {
        parent::__construct(new User);
    }

    public function paginate(int $perPage = 15, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = $this->applyFilters(
            $this->model->newQuery()->where('is_platform_user', false),
            $filters,
        );

        $sort = $filters['sort'] ?? null;
        $direction = ($filters['direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        if (is_string($sort) && in_array($sort, self::SORTABLE_COLUMNS, true)) {
            $query->orderBy($sort, $direction);
        } else {
            $query->latest();
        }

        return $query->paginate($perPage);
    }

    public function findByEmail(string $email): ?User
    {
        return $this->model->newQuery()
            ->where('email', $email)
            ->first();
    }

    protected function applyFilters(Builder $query, array $filters): Builder
    {
        $query = parent::applyFilters($query, $filters);

        return $query
            ->with(['roles', 'creator', 'updater'])
            ->when(
                filled($filters['search'] ?? null),
                fn (Builder $q) => $q->where(function (Builder $q) use ($filters): void {
                    $search = (string) $filters['search'];
                    $cpfDigits = preg_replace('/\D+/', '', $search);

                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");

                    if ($cpfDigits !== '') {
                        $q->orWhere('cpf', 'like', "%{$cpfDigits}%");
                    }
                })
            )
            ->when(
                filled($filters['status'] ?? null),
                fn (Builder $q) => $q->where('status', $filters['status'])
            )
            ->when(
                filled($filters['filter_user'] ?? null),
                function (Builder $q) use ($filters): void {
                    $terms = array_values(array_filter(array_map(
                        'trim',
                        explode(',', (string) $filters['filter_user'])
                    )));

                    if ($terms === []) {
                        return;
                    }

                    $q->where(function (Builder $q) use ($terms): void {
                        foreach ($terms as $term) {
                            $q->orWhere(function (Builder $q) use ($term): void {
                                $q->where('name', 'like', "%{$term}%")
                                    ->orWhere('email', 'like', "%{$term}%");
                            });
                        }
                    });
                }
            )
            ->when(
                filled($filters['filter_role'] ?? null),
                fn (Builder $q) => $q->whereHas(
                    'roles',
                    fn (Builder $roleQuery) => $roleQuery->where('name', 'like', "%{$filters['filter_role']}%")
                )
            )
            ->when(
                filled($filters['filter_status'] ?? null),
                fn (Builder $q) => GridFilter::applyWhereInFromCsv($q, 'status', (string) $filters['filter_status']),
            )
            ->when(
                filled($filters['filter_created_at_from'] ?? null) || filled($filters['filter_created_at_to'] ?? null),
                function (Builder $q) use ($filters): void {
                    if (filled($filters['filter_created_at_from'] ?? null)) {
                        $q->whereDate('created_at', '>=', $filters['filter_created_at_from']);
                    }
                    if (filled($filters['filter_created_at_to'] ?? null)) {
                        $q->whereDate('created_at', '<=', $filters['filter_created_at_to']);
                    }
                }
            )
            ->when(
                filled($filters['filter_updated_at_from'] ?? null) || filled($filters['filter_updated_at_to'] ?? null),
                function (Builder $q) use ($filters): void {
                    if (filled($filters['filter_updated_at_from'] ?? null)) {
                        $q->whereDate('updated_at', '>=', $filters['filter_updated_at_from']);
                    }
                    if (filled($filters['filter_updated_at_to'] ?? null)) {
                        $q->whereDate('updated_at', '<=', $filters['filter_updated_at_to']);
                    }
                }
            )
            ->when(
                filled($filters['filter_created_by'] ?? null),
                fn (Builder $q) => $q->whereHas(
                    'creator',
                    fn (Builder $creatorQuery) => $creatorQuery->where('name', 'like', "%{$filters['filter_created_by']}%")
                )
            )
            ->when(
                filled($filters['filter_updated_by'] ?? null),
                fn (Builder $q) => $q->whereHas(
                    'updater',
                    fn (Builder $updaterQuery) => $updaterQuery->where('name', 'like', "%{$filters['filter_updated_by']}%")
                )
            )
            ->when(
                filled($filters['filter_cpf'] ?? null),
                fn (Builder $q) => $q->where('cpf', 'like', '%'.preg_replace('/\D+/', '', (string) $filters['filter_cpf']).'%')
            )
            ->when(
                filled($filters['filter_phone'] ?? null),
                fn (Builder $q) => $q->where('phone', 'like', '%'.preg_replace('/\D+/', '', (string) $filters['filter_phone']).'%')
            )
            ->when(
                filled($filters['filter_gender'] ?? null),
                fn (Builder $q) => GridFilter::applyWhereInFromCsv($q, 'gender', (string) $filters['filter_gender']),
            )
            ->when(
                filled($filters['filter_bio'] ?? null),
                fn (Builder $q) => $q->where('bio', 'like', "%{$filters['filter_bio']}%")
            )
            ->when(
                filled($filters['filter_birth_date_from'] ?? null) || filled($filters['filter_birth_date_to'] ?? null),
                function (Builder $q) use ($filters): void {
                    if (filled($filters['filter_birth_date_from'] ?? null)) {
                        $q->whereDate('birth_date', '>=', $filters['filter_birth_date_from']);
                    }
                    if (filled($filters['filter_birth_date_to'] ?? null)) {
                        $q->whereDate('birth_date', '<=', $filters['filter_birth_date_to']);
                    }
                }
            )
            ->when(
                filled($filters['filter_last_login_at_from'] ?? null) || filled($filters['filter_last_login_at_to'] ?? null),
                function (Builder $q) use ($filters): void {
                    if (filled($filters['filter_last_login_at_from'] ?? null)) {
                        $q->whereDate('last_login_at', '>=', $filters['filter_last_login_at_from']);
                    }
                    if (filled($filters['filter_last_login_at_to'] ?? null)) {
                        $q->whereDate('last_login_at', '<=', $filters['filter_last_login_at_to']);
                    }
                }
            )
            ->when(
                filled($filters['filter_last_login_ip'] ?? null),
                fn (Builder $q) => $q->where('last_login_ip', 'like', "%{$filters['filter_last_login_ip']}%")
            )
            ->when(
                filled($filters['filter_last_login_device'] ?? null),
                fn (Builder $q) => $q->where('last_login_device', 'like', "%{$filters['filter_last_login_device']}%")
            );
    }
}
