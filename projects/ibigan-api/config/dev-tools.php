<?php

declare(strict_types=1);

$appUrl = rtrim((string) config('app.url'), '/');

$sentryUrl = env('DEV_TOOLS_SENTRY_URL');
if (! is_string($sentryUrl) || $sentryUrl === '') {
    $dsn = env('SENTRY_LARAVEL_DSN', env('SENTRY_DSN'));
    if (is_string($dsn) && $dsn !== '') {
        $path = parse_url($dsn, PHP_URL_PATH) ?? '';
        if (preg_match('#/(\d+)$#', (string) $path, $matches)) {
            $host = (string) parse_url($dsn, PHP_URL_HOST);
            $base = str_contains($host, '.us.sentry.io')
                ? 'https://us.sentry.io'
                : 'https://sentry.io';
            $sentryUrl = "{$base}/issues/?project={$matches[1]}";
        }
    }
}

return [
    'api_docs_url' => env('DEV_TOOLS_API_DOCS_URL', "{$appUrl}/docs/api"),
    'horizon_url' => env('DEV_TOOLS_HORIZON_URL', "{$appUrl}/horizon"),
    'telescope_url' => env('DEV_TOOLS_TELESCOPE_URL', "{$appUrl}/telescope"),
    'clockwork_url' => env('DEV_TOOLS_CLOCKWORK_URL', "{$appUrl}/clockwork"),
    'log_viewer_url' => env('DEV_TOOLS_LOG_VIEWER_URL', "{$appUrl}/log-viewer"),
    'phpmyadmin_url' => env('DEV_TOOLS_PHPMYADMIN_URL', 'http://localhost:8080'),
    'mailpit_url' => env('DEV_TOOLS_MAILPIT_URL', 'http://localhost:8025'),
    'grafana_url' => env('DEV_TOOLS_GRAFANA_URL', 'http://localhost:3001'),
    'prometheus_url' => env('DEV_TOOLS_PROMETHEUS_URL', 'http://localhost:9091'),
    'cadvisor_url' => env('DEV_TOOLS_CADVISOR_URL', 'http://localhost:8086'),
    'sentry_url' => is_string($sentryUrl) && $sentryUrl !== '' ? $sentryUrl : 'https://sentry.io',
];
