<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Defaults de canais (app/e-mail) por evento.
 *
 * Mantém paridade com o catálogo do frontend em
 * ibigan-web/src/lib/notification-events/.
 */
final class NotificationEventDefaults
{
    /** @var array<string, array{email: bool, app: bool}> */
    public const EVENTS = [
        'report.completed' => ['email' => true, 'app' => true],
        'campaign.sent' => ['email' => false, 'app' => true],
        'invite.accepted' => ['email' => true, 'app' => true],
        'user.created' => ['email' => false, 'app' => true],

        'loan.due_soon' => ['email' => false, 'app' => true],
        'loan.overdue' => ['email' => true, 'app' => true],
        'loan.renewed' => ['email' => false, 'app' => true],
        'loan.renewal_limit_exceeded' => ['email' => true, 'app' => true],
        'loan.created' => ['email' => false, 'app' => true],
        'loan.returned' => ['email' => false, 'app' => true],

        'equipment.idle' => ['email' => true, 'app' => true],
        'equipment.unused_since_registration' => ['email' => false, 'app' => true],
        'equipment.below_minimum_stock' => ['email' => true, 'app' => true],

        'maintenance.sent' => ['email' => false, 'app' => true],
        'maintenance.completed' => ['email' => false, 'app' => true],
        'maintenance.overdue' => ['email' => true, 'app' => true],
        'maintenance.frequency_high' => ['email' => true, 'app' => true],
        'maintenance.cost_high' => ['email' => true, 'app' => true],

        'critical.idle' => ['email' => true, 'app' => true],
        'critical.overdue' => ['email' => true, 'app' => true],
        'critical.in_maintenance' => ['email' => true, 'app' => true],

        'site.idle_equipment' => ['email' => true, 'app' => true],
        'site.overdue_equipment' => ['email' => true, 'app' => true],
        'site.high_cost' => ['email' => true, 'app' => true],

        'employee.equipment_overload' => ['email' => false, 'app' => true],
        'employee.long_possession' => ['email' => false, 'app' => true],

        'insight.return' => ['email' => true, 'app' => true],
        'insight.reallocation' => ['email' => true, 'app' => true],
        'insight.replacement' => ['email' => true, 'app' => true],
        'insight.cost_reduction' => ['email' => true, 'app' => true],
        'insight.anomaly' => ['email' => false, 'app' => true],

        'digest.daily' => ['email' => true, 'app' => false],
        'digest.weekly' => ['email' => true, 'app' => false],
    ];
}
