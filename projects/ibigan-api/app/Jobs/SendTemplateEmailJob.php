<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Jobs\Concerns\TenantAwareJob;
use App\Mail\TemplateMailable;
use App\Models\User;
use App\Services\MessageTemplateResolver;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Mail;

final class SendTemplateEmailJob implements ShouldQueue
{
    use TenantAwareJob;

    /**
     * @param  array<string, string>  $data
     */
    public function __construct(
        private readonly string $templateSlug,
        private readonly string $to,
        private readonly array $data = [],
    ) {}

    public function handle(MessageTemplateResolver $templateResolver): void
    {
        $user = User::query()->where('email', $this->to)->first();

        if ($user !== null && ! $user->isActiveAccount()) {
            return;
        }

        $resolved = $templateResolver->resolve($this->templateSlug, $this->data);

        Mail::to($this->to)->send(new TemplateMailable(
            emailSubject: $resolved['subject'],
            emailBody: $resolved['body'],
        ));
    }
}
