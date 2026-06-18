<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Mail\TemplateMailable;
use App\Notifications\Concerns\ResolvesMessageTemplate;
use App\Support\MessageTemplateSlugs;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

final class UserApprovedNotification extends Notification
{
    use Queueable;
    use ResolvesMessageTemplate;

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
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
     * @return array<string, string>
     */
    public function toArray(object $notifiable): array
    {
        $content = $this->resolveTemplate($notifiable);

        return [
            'type' => 'user_approved',
            'subject' => $content['subject'],
            'body' => $content['body'],
            'slug' => $content['slug'],
        ];
    }

    protected function templateSlug(): string
    {
        return MessageTemplateSlugs::USER_APPROVED;
    }

    /**
     * @return array<string, string>
     */
    protected function mergeData(object $notifiable): array
    {
        return [
            'name' => (string) ($notifiable->name ?? 'Usuário'),
            'app_url' => (string) config('app.frontend_url', url('/')),
        ];
    }
}
