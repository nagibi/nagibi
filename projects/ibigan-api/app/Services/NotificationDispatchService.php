<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Notifications\CatalogEventNotification;
use App\Support\NotificationEventCatalog;
use Illuminate\Support\Facades\Log;

final class NotificationDispatchService
{
    public function __construct(
        private readonly NotificationPreferenceService $preferenceService,
    ) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function dispatch(string $eventSlug, array $context): void
    {
        $content = NotificationEventCatalog::content($eventSlug, $context);

        if ($content === null) {
            Log::warning('Evento sem conteúdo de notificação configurado.', [
                'event_slug' => $eventSlug,
            ]);

            return;
        }

        $dedupeKey = isset($context['dedupe_key']) ? (string) $context['dedupe_key'] : null;

        $users = User::query()
            ->where('status', 'active')
            ->get()
            ->filter(fn (User $user) => $user->can('notificacao-visualizar'));

        foreach ($users as $user) {
            if ($dedupeKey !== null && $this->alreadyNotifiedRecently($user, $eventSlug, $dedupeKey)) {
                continue;
            }

            $this->notifyUser($user, $eventSlug, $content, $context);
        }
    }

    /**
     * @param  array{subject: string, body: string, severity: string, summary?: string}  $content
     * @param  array<string, mixed>  $context
     */
    private function notifyUser(User $user, string $eventSlug, array $content, array $context): void
    {
        if ($this->preferenceService->isEnabled($user, $eventSlug, 'app')) {
            try {
                $user->notify(new CatalogEventNotification($eventSlug, 'app', $content, $context));
            } catch (\Throwable $e) {
                Log::warning('Falha ao enviar notificação in-app.', [
                    'event_slug' => $eventSlug,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (! $this->preferenceService->isEnabled($user, $eventSlug, 'email')) {
            return;
        }

        if (! is_string($user->email) || trim($user->email) === '') {
            return;
        }

        try {
            $user->notify(new CatalogEventNotification($eventSlug, 'email', $content, $context));
        } catch (\Throwable $e) {
            Log::warning('Falha ao enviar e-mail de notificação.', [
                'event_slug' => $eventSlug,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function alreadyNotifiedRecently(User $user, string $eventSlug, string $dedupeKey): bool
    {
        return $user->notifications()
            ->where('created_at', '>=', now()->subDay())
            ->where('data->event_slug', $eventSlug)
            ->where('data->dedupe_key', $dedupeKey)
            ->exists();
    }
}
