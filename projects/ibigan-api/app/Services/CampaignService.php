<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\CampaignRecipientType;
use App\Enums\CampaignStatus;
use App\Enums\DeliveryChannel;
use App\Enums\DeliveryStatus;
use App\Jobs\ProcessCampaignJob;
use App\Jobs\SendCampaignDeliveryJob;
use App\Mail\TemplateMailable;
use App\Models\Campaign;
use App\Models\CampaignDelivery;
use App\Models\User;
use App\Notifications\TemplateNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Throwable;

final class CampaignService
{
    public function __construct(
        private readonly TemplateMailService $templateMailService,
        private readonly PlatformNotificationService $platformNotificationService,
    ) {}

    public function dispatch(Campaign $campaign): void
    {
        ProcessCampaignJob::dispatch($campaign->id);
    }

    public function dispatchDueScheduledCampaigns(): int
    {
        $dispatched = 0;

        $campaigns = Campaign::query()
            ->where('status', CampaignStatus::Scheduled)
            ->where('scheduled_at', '<=', now())
            ->where(fn ($query) => $query->where('is_active', true)->orWhereNull('is_active'))
            ->get();

        foreach ($campaigns as $campaign) {
            if ($this->dispatchDueScheduled($campaign)) {
                $dispatched++;
            }
        }

        return $dispatched;
    }

    public function dispatchDueScheduled(Campaign $campaign): bool
    {
        $claimed = Campaign::query()
            ->whereKey($campaign->id)
            ->where('status', CampaignStatus::Scheduled)
            ->where('scheduled_at', '<=', now())
            ->where(fn ($query) => $query->where('is_active', true)->orWhereNull('is_active'))
            ->update(['status' => CampaignStatus::Sending]);

        if ($claimed === 0) {
            return false;
        }

        ProcessCampaignJob::dispatch($campaign->id);

        return true;
    }

    public function process(Campaign $campaign): void
    {
        $campaign->update([
            'status' => CampaignStatus::Sending,
            'started_at' => now(),
        ]);

        $users = $this->resolveRecipients($campaign);
        $channels = $campaign->channels ?? ['email'];
        $queued = 0;

        foreach ($users as $user) {
            foreach ($channels as $channel) {
                $delivery = CampaignDelivery::query()->create([
                    'campaign_id' => $campaign->id,
                    'user_id' => $user->id,
                    'channel' => $channel,
                    'status' => DeliveryStatus::Queued,
                    'recipient_email' => $user->email,
                    'queued_at' => now(),
                ]);

                SendCampaignDeliveryJob::dispatch($delivery->id);
                $queued++;
            }
        }

        $campaign->update([
            'stats' => array_merge($campaign->stats ?? [], [
                'total_recipients' => $users->count(),
                'total_queued' => $queued,
            ]),
        ]);

        if ($queued === 0) {
            $this->finalizeCampaign($campaign);
        }
    }

    public function sendDelivery(CampaignDelivery $delivery): void
    {
        $delivery->loadMissing(['campaign.template', 'user']);
        $campaign = $delivery->campaign;
        $user = $delivery->user;

        if (! $user || ! $campaign) {
            $delivery->update([
                'status' => DeliveryStatus::Failed,
                'error_message' => 'Destinatário ou campanha não encontrados.',
            ]);

            $this->updateCampaignProgress($campaign);

            return;
        }

        if ($delivery->channel === DeliveryChannel::Email && ! $user->isActiveAccount()) {
            $delivery->update([
                'status' => DeliveryStatus::Failed,
                'error_message' => 'Usuário inativo.',
            ]);

            $this->updateCampaignProgress($campaign);

            return;
        }

        try {
            $content = $this->resolveContent($campaign, $user);

            match ($delivery->channel) {
                DeliveryChannel::Email => Mail::to($delivery->recipient_email)->send(
                    new TemplateMailable($content['subject'], $content['body']),
                ),
                DeliveryChannel::Notification => $user->notify(new TemplateNotification(
                    subject: $content['subject'],
                    body: $content['body'],
                    slug: $campaign->template?->slug ?? 'campaign-'.$campaign->id,
                )),
                DeliveryChannel::Sms, DeliveryChannel::Whatsapp => throw new \RuntimeException('Canal ainda não implementado.'),
            };

            $delivery->update([
                'status' => DeliveryStatus::Sent,
                'sent_at' => now(),
                'error_message' => null,
            ]);
        } catch (Throwable $exception) {
            $delivery->update([
                'status' => DeliveryStatus::Failed,
                'error_message' => $exception->getMessage(),
            ]);
        }

        $this->updateCampaignProgress($campaign);
    }

    /**
     * @return Collection<int, User>
     */
    public function resolveRecipients(Campaign $campaign): Collection
    {
        $campaign->loadMissing('recipients');

        if ($campaign->recipients->isEmpty()) {
            return User::query()->get();
        }

        $users = collect();

        foreach ($campaign->recipients as $recipient) {
            $users = $users->merge(match ($recipient->type) {
                CampaignRecipientType::All => User::query()->where('is_active', true)->get(),
                CampaignRecipientType::Role => User::role($recipient->value)->where('is_active', true)->get(),
                CampaignRecipientType::Permission => User::permission($recipient->value)->where('is_active', true)->get(),
                CampaignRecipientType::User => User::query()
                    ->whereKey($recipient->value)
                    ->where('is_active', true)
                    ->get(),
                CampaignRecipientType::Users => User::query()
                    ->whereIn('id', $this->parseUserIds($recipient->value))
                    ->where('is_active', true)
                    ->get(),
            });
        }

        return $users->unique('id')->values();
    }

    /**
     * @return list<int>
     */
    private function parseUserIds(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return collect(explode(',', $value))
            ->map(static fn (string $id): int => (int) trim($id))
            ->filter(static fn (int $id): bool => $id > 0)
            ->values()
            ->all();
    }

    /**
     * @return array{subject: string, body: string}
     */
    public function resolveContent(Campaign $campaign, User $user): array
    {
        $template = $campaign->template;

        if ($template === null) {
            throw new \RuntimeException('Campanha sem template de mensagem cadastrado.');
        }

        $mergeData = array_merge(
            $campaign->merge_data ?? [],
            [
                'nome' => $user->name,
                'name' => $user->name,
                'email' => $user->email,
                'campaign' => $campaign->name,
                'campanha' => $campaign->name,
            ],
        );

        return $this->templateMailService->resolve($template, $mergeData);
    }

    private function updateCampaignProgress(?Campaign $campaign): void
    {
        if (! $campaign) {
            return;
        }

        $updated = Campaign::query()
            ->whereKey($campaign->id)
            ->where('status', CampaignStatus::Sending)
            ->whereDoesntHave('deliveries', function ($query): void {
                $query->where('status', DeliveryStatus::Queued);
            })
            ->update([
                'status' => CampaignStatus::Sent,
                'finished_at' => now(),
            ]);

        if ($updated === 0) {
            return;
        }

        $campaign->refresh();
        $this->platformNotificationService->campaignSent($campaign);

        $campaign->update([
            'stats' => $campaign->deliveryStats(),
        ]);
    }

    private function finalizeCampaign(Campaign $campaign): void
    {
        $campaign->update([
            'status' => CampaignStatus::Sent,
            'finished_at' => now(),
            'stats' => $campaign->deliveryStats(),
        ]);

        $this->platformNotificationService->campaignSent($campaign->fresh());
    }
}
