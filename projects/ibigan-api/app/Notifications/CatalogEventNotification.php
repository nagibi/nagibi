<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Mail\TemplateMailable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

final class CatalogEventNotification extends Notification implements ShouldBroadcast
{
    use Queueable;

    /**
     * @param  array{subject: string, body: string, body_text?: string, severity: string, summary?: string}  $content
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        private readonly string $eventSlug,
        private readonly string $channel,
        private readonly array $content,
        private readonly array $context,
    ) {}

    /**
     * @return array<int, string>
     */
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
        return TemplateMailable::forNotifiable(
            $notifiable,
            emailSubject: $this->content['subject'],
            emailBody: $this->content['body'],
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event_slug' => $this->eventSlug,
            'severity' => $this->content['severity'],
            'subject' => $this->content['subject'],
            'body' => $this->content['body_text'] ?? $this->content['summary'] ?? $this->content['subject'],
            'body_text' => $this->content['body_text'] ?? null,
            'message' => $this->content['summary'] ?? $this->content['subject'],
            ...$this->context,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
