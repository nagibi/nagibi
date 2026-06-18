<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Mail\TemplateMailable;
use App\Notifications\Concerns\ResolvesMessageTemplate;
use App\Support\MessageTemplateSlugs;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

final class TwoFactorCodeNotification extends Notification
{
    use Queueable;
    use ResolvesMessageTemplate;

    public function __construct(
        private readonly string $code,
        private readonly int $expiresMinutes,
        private readonly string $context,
    ) {}

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

    protected function templateSlug(): string
    {
        return MessageTemplateSlugs::TWO_FACTOR_CODE;
    }

    /**
     * @return array<string, string>
     */
    protected function mergeData(object $notifiable): array
    {
        $name = (string) ($notifiable->name ?? 'Usuário');
        $email = (string) ($notifiable->email ?? '');

        return [
            'name' => $name,
            'email' => $email,
            'code' => $this->code,
            'expires_minutes' => (string) $this->expiresMinutes,
            'context_line' => $this->context === 'setup'
                ? 'Use o código abaixo para confirmar a autenticação em duas etapas por e-mail.'
                : 'Use o código abaixo para concluir seu login.',
        ];
    }
}
