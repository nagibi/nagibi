<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Jobs\Concerns\TenantAwareJob;
use App\Models\User;
use App\Notifications\TemplateNotification;
use App\Services\MessageTemplateResolver;
use Illuminate\Contracts\Queue\ShouldQueue;

final class SendTemplateNotificationJob implements ShouldQueue
{
    use TenantAwareJob;

    /**
     * @param  array<string, string>  $data
     */
    public function __construct(
        private readonly string $templateSlug,
        private readonly string $toEmail,
        private readonly array $data = [],
    ) {}

    public function handle(MessageTemplateResolver $templateResolver): void
    {
        $resolved = $templateResolver->resolve($this->templateSlug, $this->data);

        $user = User::query()->where('email', $this->toEmail)->first();

        if ($user === null || ! $user->isActiveAccount()) {
            return;
        }

        $user->notify(new TemplateNotification(
            subject: $resolved['subject'],
            body: $resolved['body'],
            slug: $resolved['slug'],
        ));
    }
}
