<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Models\UserNotificationPreference;
use App\Support\NotificationEventDefaults;

final class NotificationPreferenceService
{
    /** @var array<string, array{email: bool, app: bool}> */
    public const EVENTS = NotificationEventDefaults::EVENTS;

    public function getForUser(User $user): array
    {
        $saved = UserNotificationPreference::where('user_id', $user->id)
            ->get();

        $result = [];
        foreach (self::EVENTS as $event => $defaults) {
            foreach (['email', 'app'] as $channel) {
                $pref = $saved->first(fn ($p) => $p->event === $event && $p->channel === $channel);
                $result[$event][$channel] = $pref
                    ? $pref->enabled
                    : $defaults[$channel];
            }
        }

        return $result;
    }

    public function update(User $user, string $event, string $channel, bool $enabled): void
    {
        UserNotificationPreference::updateOrCreate(
            ['user_id' => $user->id, 'event' => $event, 'channel' => $channel],
            ['enabled' => $enabled],
        );
    }

    public function isEnabled(User $user, string $event, string $channel): bool
    {
        $pref = UserNotificationPreference::where('user_id', $user->id)
            ->where('event', $event)
            ->where('channel', $channel)
            ->first();

        return $pref ? $pref->enabled : (self::EVENTS[$event][$channel] ?? false);
    }
}
