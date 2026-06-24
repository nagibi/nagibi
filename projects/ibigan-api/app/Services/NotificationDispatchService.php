<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Notifications\CatalogEventNotification;
use App\Support\EmailLayout;
use App\Support\NotificationEventCatalog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final class NotificationDispatchService
{
    private bool $deferEmails = false;

    /** @var array<int, array<string, list<array{subject: string, body: string, body_text?: string, severity: string, summary?: string}>>> */
    private array $deferredEmails = [];

    public function __construct(
        private readonly NotificationPreferenceService $preferenceService,
    ) {}

    public function deferEmails(bool $defer = true): void
    {
        $this->deferEmails = $defer;

        if (! $defer) {
            $this->deferredEmails = [];
        }
    }

    public function flushDeferredEmails(): void
    {
        foreach ($this->deferredEmails as $userId => $byEvent) {
            $user = User::query()->find($userId);

            if ($user === null || $byEvent === [] || ! $user->isActiveAccount()) {
                continue;
            }

            $cacheKey = $this->scannerEmailCacheKey($user);

            if (! Cache::add($cacheKey, true, now()->endOfDay())) {
                continue;
            }

            $content = $this->mergeAllScannerEmailContent($byEvent);

            if ($content === null) {
                Cache::forget($cacheKey);

                continue;
            }

            try {
                $this->sendEmailToUser($user, 'scanner.batch', $content);
            } catch (\Throwable $e) {
                Cache::forget($cacheKey);

                Log::warning('Falha ao enviar e-mail consolidado de alertas.', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->deferredEmails = [];
    }

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
            ->active()
            ->get()
            ->filter(fn(User $user) => $user->can('notificacao-visualizar'));

        foreach ($users as $user) {
            if ($dedupeKey !== null && $this->alreadyNotifiedRecently($user, $eventSlug, $dedupeKey)) {
                continue;
            }

            $this->notifyUser($user, $eventSlug, $content, $context, $dedupeKey);
        }
    }

    /**
     * @param  array{subject: string, body: string, body_text?: string, severity: string, summary?: string}  $content
     * @param  array<string, mixed>  $context
     */
    private function notifyUser(
        User $user,
        string $eventSlug,
        array $content,
        array $context,
        ?string $dedupeKey,
    ): void {
        $delivered = false;

        if ($this->preferenceService->isEnabled($user, $eventSlug, 'app')) {
            try {
                $user->notify(new CatalogEventNotification($eventSlug, 'app', $content, $context));
                $delivered = true;
            } catch (\Throwable $e) {
                Log::warning('Falha ao enviar notificação in-app.', [
                    'event_slug' => $eventSlug,
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (
            $this->preferenceService->isEnabled($user, $eventSlug, 'email')
            && $user->isActiveAccount()
            && is_string($user->email)
            && trim($user->email) !== ''
        ) {
            if ($this->deferEmails) {
                $this->deferredEmails[$user->id][$eventSlug][] = $content;
                $delivered = true;
            } else {
                try {
                    $this->sendEmailToUser($user, $eventSlug, $content);
                    $delivered = true;
                } catch (\Throwable $e) {
                    Log::warning('Falha ao enviar e-mail de notificação.', [
                        'event_slug' => $eventSlug,
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        if ($delivered && $dedupeKey !== null) {
            $this->markDispatched($user, $eventSlug, $dedupeKey);
        }
    }

    /**
     * @param  array{subject: string, body: string, body_text?: string, severity: string, summary?: string}  $content
     */
    private function sendEmailToUser(User $user, string $eventSlug, array $content): void
    {
        if (! $user->isActiveAccount()) {
            return;
        }

        $user->notify(new CatalogEventNotification($eventSlug, 'email', $content, []));
    }

    /**
     * @param  array<string, list<array{subject: string, body: string, body_text?: string, severity: string, summary?: string}>>  $byEvent
     * @return array{subject: string, body: string, body_text?: string, severity: string, summary?: string}|null
     */
    private function mergeAllScannerEmailContent(array $byEvent): ?array
    {
        if ($byEvent === []) {
            return null;
        }

        $lines = [];
        $totalAlerts = 0;
        $highestSeverity = 'info';

        foreach ($byEvent as $eventSlug => $items) {
            $count = count($items);
            $totalAlerts += $count;
            $first = $items[0];
            $highestSeverity = $this->higherSeverity($highestSeverity, $first['severity']);

            if ($count === 1) {
                if (str_starts_with((string) $eventSlug, 'digest.')) {
                    $lines[] = '• <strong>' . $first['subject'] . '</strong>';
                    if (! empty($first['body_text'])) {
                        foreach (explode("\n", trim($first['body_text'])) as $detailLine) {
                            if ($detailLine === '') {
                                continue;
                            }

                            $lines[] = '&nbsp;&nbsp;' . $detailLine;
                        }
                    }

                    continue;
                }

                $lines[] = '• ' . $first['subject'] . ': ' . ($first['summary'] ?? $first['subject']);

                continue;
            }

            $lines[] = '• ' . $first['subject'] . ' (' . $count . ' alertas)';
            foreach (array_slice($items, 0, 3) as $item) {
                $lines[] = '&nbsp;&nbsp;– ' . ($item['summary'] ?? $item['subject']);
            }

            if ($count > 3) {
                $lines[] = '&nbsp;&nbsp;– ... e mais ' . ($count - 3) . ' nesta categoria';
            }
        }

        $subject = 'Alertas Equipamento (' . $totalAlerts . ')';
        $bodyText = implode("\n", array_map(
            static fn(string $line): string => html_entity_decode(strip_tags($line), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            $lines,
        ));

        return [
            'subject' => $subject,
            'body' => EmailLayout::render(
                title: $subject,
                contentHtml: EmailLayout::paragraph(implode('<br>', $lines)),
            ),
            'body_text' => $bodyText,
            'severity' => $highestSeverity,
            'summary' => $totalAlerts . ' alertas consolidados',
        ];
    }

    private function alreadyNotifiedRecently(User $user, string $eventSlug, string $dedupeKey): bool
    {
        if (Cache::has($this->dedupeCacheKey($user, $eventSlug, $dedupeKey))) {
            return true;
        }

        return $user->notifications()
            ->where('created_at', '>=', now()->subDay())
            ->where('data->event_slug', $eventSlug)
            ->where('data->dedupe_key', $dedupeKey)
            ->exists();
    }

    private function markDispatched(User $user, string $eventSlug, string $dedupeKey): void
    {
        Cache::put(
            $this->dedupeCacheKey($user, $eventSlug, $dedupeKey),
            true,
            now()->addDay(),
        );
    }

    private function dedupeCacheKey(User $user, string $eventSlug, string $dedupeKey): string
    {
        return sprintf('notification_dedupe:%s:%s:%s', $user->id, $eventSlug, $dedupeKey);
    }

    private function scannerEmailCacheKey(User $user): string
    {
        return sprintf('notification_scanner_email:%s:%s', $user->id, now()->toDateString());
    }

    private function higherSeverity(string $current, string $next): string
    {
        $rank = ['info' => 0, 'warning' => 1, 'critical' => 2];

        return ($rank[$next] ?? 0) > ($rank[$current] ?? 0) ? $next : $current;
    }
}
