<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class TemplateMailable extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly string $emailSubject,
        private readonly string $emailBody,
    ) {}

    public static function forNotifiable(object $notifiable, string $emailSubject, string $emailBody): self
    {
        return (new self($emailSubject, $emailBody))
            ->to($notifiable->routeNotificationFor('mail'));
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->emailSubject);
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->emailBody,
        );
    }
}
