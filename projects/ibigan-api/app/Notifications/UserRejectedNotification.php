<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Mail\TemplateMailable;
use App\Notifications\Concerns\ResolvesMessageTemplate;
use App\Support\MessageTemplateSlugs;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

final class UserRejectedNotification extends Notification
{
    use Queueable;
    use ResolvesMessageTemplate;

    public function __construct(private readonly ?string $reason = null) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
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

    /**
     * @return array<string, string|null>
     */
    public function toArray(object $notifiable): array
    {
        $content = $this->resolveTemplate($notifiable);

        return [
            'type' => 'user_rejected',
            'reason' => $this->reason,
            'subject' => $content['subject'],
            'body' => $content['body'],
            'slug' => $content['slug'],
        ];
    }

    protected function templateSlug(): string
    {
        return MessageTemplateSlugs::USER_REJECTED;
    }

    /**
     * @return array<string, string>
     */
    protected function mergeData(object $notifiable): array
    {
        return [
            'name' => (string) ($notifiable->name ?? 'Usuário'),
            'reason_line' => $this->reason !== null && $this->reason !== ''
                ? "Motivo: {$this->reason}"
                : '',
        ];
    }
}
