<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\MessageTemplate;

final class TemplateMailService
{
    /**
     * @param  array<string, string>  $data
     */
    public function resolve(MessageTemplate $template, array $data): array
    {
        $subject = $this->replaceTags($template->subject, $data);
        $body = $this->refreshEmailBranding($this->replaceTags($template->body, $data));

        return compact('subject', 'body');
    }

    /**
     * @param  array<string, string>  $data
     */
    public function replace(string $content, array $data): string
    {
        return $this->replaceTags($content, $data);
    }

    /**
     * @param  array<string, string>  $data
     */
    private function replaceTags(string $content, array $data): string
    {
        foreach ($data as $tag => $value) {
            $content = str_replace('{{'.$tag.'}}', $value, $content);
            $content = preg_replace(
                '/\{\{\s*'.preg_quote((string) $tag, '/').'\s*\}\}/',
                $value,
                $content,
            ) ?? $content;
        }

        return $content;
    }

    /**
     * Templates gravados no banco podem ter logo SVG/antiga — reaplica branding atual no envio.
     */
    private function refreshEmailBranding(string $body): string
    {
        $logoUrl = (string) (config('email-branding.logo_url') ?: config('email-branding.logo_fallback_url'));
        $brandName = (string) config('email-branding.brand_name', 'Nagibi');

        if ($logoUrl === '') {
            return $body;
        }

        $logoUrl = htmlspecialchars($logoUrl, ENT_QUOTES);
        $brandName = htmlspecialchars($brandName, ENT_QUOTES);

        $refreshed = preg_replace(
            '/<img alt="Logo [^"]*" border="0" src="[^"]*" style="([^"]*)" title="Logo [^"]*" width="136">/',
            '<img alt="Logo '.$brandName.'" border="0" src="'.$logoUrl.'" style="$1" title="Logo '.$brandName.'" width="136">',
            $body,
        );

        return is_string($refreshed) ? $refreshed : $body;
    }
}
