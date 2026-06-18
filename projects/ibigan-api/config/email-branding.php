<?php

declare(strict_types=1);

$appUrl = rtrim((string) env('APP_URL', 'http://localhost'), '/');
$frontendUrl = rtrim((string) env('FRONTEND_URL', $appUrl), '/');

return [
    'brand_name' => env('EMAIL_BRAND_NAME', env('APP_NAME', 'Nagibi')),
    'accent_color' => env('EMAIL_ACCENT_COLOR', '#F8285A'),
    // PNG — SVG quebra em Gmail/Outlook e no proxy de imagens do Brevo
    'logo_url' => env('EMAIL_LOGO_URL', "{$appUrl}/images/email/nagibi-logo.png"),
    'logo_fallback_url' => env('EMAIL_LOGO_FALLBACK_URL', "{$appUrl}/images/email/nagibi-logo.png"),
    'background_image_url' => env('EMAIL_BG_URL', "{$appUrl}/images/email/bg-email.png"),
    'content_width' => 680,
];
