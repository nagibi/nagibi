<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | API rate limit (requests per minute)
    |--------------------------------------------------------------------------
    |
    | Limite por usuário autenticado (ou tenant/IP para rotas anônimas).
    | Definido em config para funcionar com `php artisan config:cache`.
    |
    */
    'api_per_minute' => (int) env('API_RATE_LIMIT_PER_MINUTE', 600),
];
