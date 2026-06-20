<?php

declare(strict_types=1);

return [
    'alerts' => [
        'loan_due_soon_days' => 3,
        'maintenance_overdue_days' => 15,
        'equipment_idle_days' => 30,
        'equipment_unused_since_registration_days' => 20,
        'equipment_minimum_stock' => 2,
        'maintenance_frequency_threshold' => 6,
        'maintenance_frequency_months' => 12,
        'maintenance_cost_threshold' => 3000,
        'site_idle_equipment_threshold' => 2,
        'site_overdue_equipment_threshold' => 3,
        'site_high_cost_threshold' => 30000,
        'employee_overload_multiplier' => 1.5,
        'employee_long_possession_days' => 90,
        'max_renovacoes_recomendadas' => 4,
    ],
];
