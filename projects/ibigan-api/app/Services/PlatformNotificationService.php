<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Campaign;
use App\Models\Invite;
use App\Models\User;

final class PlatformNotificationService
{
    public function __construct(
        private readonly NotificationDispatchService $dispatchService,
    ) {}

    public function inviteAccepted(Invite $invite, User $acceptedUser): void
    {
        $this->dispatchService->dispatch('invite.accepted', [
            'dedupe_key' => "invite.accepted:{$invite->id}",
            'invite_id' => $invite->id,
            'user_id' => $acceptedUser->id,
            'user_name' => $acceptedUser->name,
            'user_email' => $acceptedUser->email,
            'role' => $invite->role,
        ]);
    }

    public function campaignSent(Campaign $campaign): void
    {
        $campaign->loadMissing('deliveries');

        $this->dispatchService->dispatch('campaign.sent', [
            'dedupe_key' => "campaign.sent:{$campaign->id}",
            'campaign_id' => $campaign->id,
            'campaign_name' => $campaign->name,
            'recipients_count' => (string) $campaign->deliveries->unique('user_id')->count(),
        ]);
    }
}
