<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\ReportExecution;
use App\Mail\TemplateMailable;
use App\Notifications\Concerns\ResolvesMessageTemplate;
use App\Support\MessageTemplateSlugs;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

final class ReportCompletedNotification extends Notification implements ShouldBroadcast
{
    use Queueable;
    use ResolvesMessageTemplate;

    public function __construct(
        private readonly ReportExecution $execution,
        private readonly string $channel = 'app',
    ) {}

    public function via(object $notifiable): array
    {
        return match ($this->channel) {
            'email' => ['mail'],
            'app' => ['database', 'broadcast'],
            default => ['database'],
        };
    }

    public function toMail(object $notifiable): TemplateMailable
    {
        $content = $this->resolveTemplate($notifiable);

        return TemplateMailable::forNotifiable(
            $notifiable,
            emailSubject: $content['subject'],
            emailBody: $content['body'],
        );
    }

    public function toArray(object $notifiable): array
    {
        $content = $this->resolveTemplate($notifiable);

        return [
            'execution_id' => $this->execution->id,
            'template_id' => $this->execution->report_template_id,
            'template_name' => $this->execution->template->name,
            'rows_count' => $this->execution->result_rows_count,
            'duration_ms' => $this->execution->duration_ms,
            'subject' => $content['subject'],
            'body' => $content['body'],
            'slug' => $content['slug'],
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    protected function templateSlug(): string
    {
        return MessageTemplateSlugs::REPORT_COMPLETED;
    }

    /**
     * @return array<string, string>
     */
    protected function mergeData(object $notifiable): array
    {
        $expiresAt = $this->execution->result_expires_at ?? now()->addDays(7);
        $rowsCount = (int) ($this->execution->result_rows_count ?? 0);
        $durationMs = (int) ($this->execution->duration_ms ?? 0);

        $downloadUrl = URL::temporarySignedRoute(
            'reports.executions.download',
            $expiresAt,
            [
                'tenant' => tenant()->id,
                'report' => $this->execution->report_template_id,
                'execution' => $this->execution->id,
            ],
        );

        $rowsSummary = $rowsCount === 1
            ? "1 registro encontrado em {$durationMs}ms"
            : "{$rowsCount} registros encontrados em {$durationMs}ms";

        return [
            'name' => (string) ($notifiable->name ?? 'Usuário'),
            'report_name' => (string) $this->execution->template->name,
            'rows_summary' => $rowsSummary,
            'rows_count' => (string) $rowsCount,
            'duration_ms' => (string) $durationMs,
            'download_url' => $downloadUrl,
            'expires_at' => $expiresAt->timezone(config('app.timezone'))->format('d/m/Y H:i'),
        ];
    }
}
