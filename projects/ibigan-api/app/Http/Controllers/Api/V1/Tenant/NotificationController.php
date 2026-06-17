<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Data\NotificationData;
use App\Events\NotificationsInvalidated;
use App\Events\NotificationStatusChanged;
use App\Http\Controllers\Controller;
use App\Support\Broadcaster;
use App\Support\GridFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class NotificationController extends Controller
{
    /**
     * Listar notificações do usuário autenticado.
     *
     * Requer permissão `notificacao-visualizar`.
     */
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('notificacao-visualizar'), Response::HTTP_FORBIDDEN);

        $notifications = $this->applySort(
            $this->applyFilters(
                $request->user()->notifications(),
                $request,
            ),
            $request,
        )
            ->paginate($request->integer('per_page', 15));

        return response()->json([
            'status' => 1,
            'message' => 'MSG000067',
            'result' => [
                'data' => NotificationData::collect($notifications->items()),
                'meta' => [
                    'current_page' => $notifications->currentPage(),
                    'last_page' => $notifications->lastPage(),
                    'per_page' => $notifications->perPage(),
                    'total' => $notifications->total(),
                    'unread' => $request->user()->unreadNotifications()->count(),
                ],
            ],
        ]);
    }

    /**
     * Marcar uma notificação como lida.
     */
    public function markAsRead(Request $request, string $notification): JsonResponse
    {
        abort_unless($request->user()->can('notificacao-visualizar'), Response::HTTP_FORBIDDEN);

        $databaseNotification = $request->user()
            ->notifications()
            ->where('id', $notification)
            ->firstOrFail();

        $databaseNotification->markAsRead();
        $result = NotificationData::fromModel($databaseNotification->fresh());

        Broadcaster::safe(new NotificationStatusChanged($request->user()->id, $result));

        return response()->json([
            'status' => 1,
            'message' => 'MSG000425',
            'result' => $result,
        ]);
    }

    /**
     * Marcar uma notificação como não lida.
     */
    public function markAsUnread(Request $request, string $notification): JsonResponse
    {
        abort_unless($request->user()->can('notificacao-visualizar'), Response::HTTP_FORBIDDEN);

        $databaseNotification = $request->user()
            ->notifications()
            ->where('id', $notification)
            ->firstOrFail();

        $databaseNotification->forceFill(['read_at' => null])->save();
        $result = NotificationData::fromModel($databaseNotification->fresh());

        Broadcaster::safe(new NotificationStatusChanged($request->user()->id, $result));

        return response()->json([
            'status' => 1,
            'message' => 'MSG000425',
            'result' => $result,
        ]);
    }

    /**
     * Marcar todas as notificações como lidas.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('notificacao-visualizar'), Response::HTTP_FORBIDDEN);

        $request->user()->unreadNotifications->markAsRead();

        Broadcaster::safe(new NotificationsInvalidated($request->user()->id));

        return response()->json([
            'status' => 1,
            'message' => 'MSG000425',
            'result' => null,
        ]);
    }

    /**
     * Remover uma notificação.
     */
    public function destroy(Request $request, string $notification): JsonResponse
    {
        abort_unless($request->user()->can('notificacao-visualizar'), Response::HTTP_FORBIDDEN);

        $request->user()
            ->notifications()
            ->where('id', $notification)
            ->delete();

        Broadcaster::safe(new NotificationsInvalidated($request->user()->id));

        return response()->json([
            'status' => 1,
            'message' => 'MSG000426',
            'result' => null,
        ]);
    }

    /**
     * @param  Relation<\Illuminate\Notifications\DatabaseNotification, \App\Models\User, \Illuminate\Database\Eloquent\Collection<int, \Illuminate\Notifications\DatabaseNotification>>  $query
     * @return Relation<\Illuminate\Notifications\DatabaseNotification, \App\Models\User, \Illuminate\Database\Eloquent\Collection<int, \Illuminate\Notifications\DatabaseNotification>>
     */
    private function applyFilters(Relation $query, Request $request): Relation
    {
        if ($request->filled('search')) {
            $term = $request->string('search')->toString();
            $query->where(function (Builder $q) use ($term): void {
                $q->where('type', 'like', "%{$term}%")
                    ->orWhere('data', 'like', "%{$term}%");
            });
        }

        if ($request->filled('filter_id')) {
            $ids = array_values(array_filter(array_map(
                'trim',
                explode(',', $request->string('filter_id')->toString()),
            )));

            if ($ids !== []) {
                $numericIds = array_values(array_filter(
                    $ids,
                    static fn (string $id): bool => ctype_digit($id),
                ));
                $uuidIds = array_values(array_filter(
                    $ids,
                    static fn (string $id): bool => ! ctype_digit($id),
                ));

                $query->where(function (Builder $q) use ($numericIds, $uuidIds): void {
                    if ($numericIds !== []) {
                        $q->orWhereIn('record_id', array_map(intval(...), $numericIds));
                    }

                    if ($uuidIds !== []) {
                        $q->orWhereIn('id', $uuidIds);
                    }
                });
            }
        }

        if ($request->filled('filter_title')) {
            $term = $request->string('filter_title')->toString();
            $like = "%{$term}%";
            $query->where(function (Builder $q) use ($like): void {
                $q->where('type', 'like', $like)
                    ->orWhere('data->subject', 'like', $like)
                    ->orWhere('data->user_name', 'like', $like)
                    ->orWhere('data->title', 'like', $like)
                    ->orWhere('data->message', 'like', $like)
                    ->orWhere('data->body', 'like', $like);
            });
        }

        if ($request->filled('filter_read_status')) {
            $statuses = GridFilter::csvValues($request->string('filter_read_status')->toString());

            if ($statuses !== []) {
                $query->where(function (Builder $q) use ($statuses): void {
                    foreach ($statuses as $status) {
                        if ($status === 'read') {
                            $q->orWhereNotNull('read_at');
                        } elseif ($status === 'unread') {
                            $q->orWhereNull('read_at');
                        }
                    }
                });
            }
        }

        if ($request->filled('filter_category')) {
            $categories = GridFilter::csvValues($request->string('filter_category')->toString());

            if ($categories !== []) {
                $query->where(function (Builder $q) use ($categories): void {
                    foreach ($categories as $category) {
                        if ($category === 'report') {
                            $q->orWhere(function (Builder $sub): void {
                                $this->applyReportCategoryFilter($sub);
                            });

                            continue;
                        }

                        if (str_starts_with($category, 'type:')) {
                            $type = substr($category, 5);
                            $q->orWhere('type', 'like', "%{$type}%");

                            continue;
                        }

                        $q->orWhere(function (Builder $sub) use ($category): void {
                            $sub->where('data->event_slug', $category)
                                ->orWhere('data->event', $category);
                        });
                    }
                });
            }
        }

        if ($request->filled('filter_type') && $request->string('filter_type')->toString() === 'report') {
            $query->where(function (Builder $q): void {
                $this->applyReportCategoryFilter($q);
            });
        }

        if ($request->filled('created_at_from')) {
            $query->whereDate('created_at', '>=', $request->string('created_at_from')->toString());
        }

        if ($request->filled('created_at_to')) {
            $query->whereDate('created_at', '<=', $request->string('created_at_to')->toString());
        }

        return $query;
    }

    /**
     * @param  Relation<\Illuminate\Notifications\DatabaseNotification, \App\Models\User, \Illuminate\Database\Eloquent\Collection<int, \Illuminate\Notifications\DatabaseNotification>>  $query
     * @return Relation<\Illuminate\Notifications\DatabaseNotification, \App\Models\User, \Illuminate\Database\Eloquent\Collection<int, \Illuminate\Notifications\DatabaseNotification>>
     */
    private function applySort(Relation $query, Request $request): Relation
    {
        if (! $request->filled('sort')) {
            return $query->reorder()->latest();
        }

        $sort = $request->string('sort')->toString();
        $direction = $request->string('direction')->toString() === 'asc' ? 'asc' : 'desc';

        return match ($sort) {
            'record_id' => $query->reorder()->orderBy('record_id', $direction),
            'read_at' => $query->reorder()->orderBy('read_at', $direction),
            'created_at' => $query->reorder()->orderBy('created_at', $direction),
            'category' => $query->reorder()->orderBy('type', $direction),
            'title' => $query->reorder()
                ->orderBy('data->subject', $direction)
                ->orderBy('data->title', $direction)
                ->orderBy('data->message', $direction)
                ->orderBy('type', $direction),
            default => $query->reorder()->latest(),
        };
    }

    /**
     * @param  Builder<\Illuminate\Notifications\DatabaseNotification>  $query
     * @return Builder<\Illuminate\Notifications\DatabaseNotification>
     */
    private function applyReportCategoryFilter(Builder $query): Builder
    {
        return $query->where(function (Builder $q): void {
            $q->where('type', 'like', '%ReportCompletedNotification%')
                ->orWhere('data', 'like', '%"template_id"%');
        });
    }
}
