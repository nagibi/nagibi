<?php

declare(strict_types=1);

namespace App\Support;

final class EmailLayout
{
    public static function render(
        string $title,
        string $contentHtml,
        ?string $buttonLabel = null,
        ?string $buttonUrl = null,
        ?string $afterButtonHtml = null,
    ): string {
        $brandName = (string) config('email-branding.brand_name', 'Nagibi');
        $accentColor = (string) config('email-branding.accent_color', '#F8285A');
        $logoUrl = (string) (config('email-branding.logo_url') ?: config('email-branding.logo_fallback_url'));
        $bgUrl = (string) config('email-branding.background_image_url');
        $contentWidth = (int) config('email-branding.content_width', 680);

        $buttonSection = self::buttonSection($buttonLabel, $buttonUrl, $accentColor);
        $outro = $afterButtonHtml ?? self::defaultOutro($brandName);

        return <<<HTML
<table cellpadding="0" cellspacing="0" width="100%">
<tbody>
<tr>
<td align="center" bgcolor="#EEEEEE" style="vertical-align:top;background-image:url('{$bgUrl}');background-repeat:repeat-x;background-position:left top;background-size:100% 175px;width:100%">
<table border="0" cellpadding="0" cellspacing="0" style="min-width:600px" width="620">
<tbody>
<tr>
<td>
<table align="center" border="0" cellpadding="0" cellspacing="0" width="620">
<tbody>
<tr><td height="5">&nbsp;</td></tr>
<tr>
<td>
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation">
<tbody>
<tr>
<td style="vertical-align:middle">
<img alt="Logo {$brandName}" border="0" src="{$logoUrl}" style="border-style:none;padding-top:15px;padding-bottom:10px;height:auto" title="Logo {$brandName}" width="136">
</td>
</tr>
</tbody>
</table>
</td>
</tr>
<tr><td height="5" width="100%">&nbsp;</td></tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:auto" width="{$contentWidth}">
<tbody>
<tr>
<td bgcolor="#ffffff" style="padding:30px 25px 0 25px;text-align:left">
<h1 style="margin:0;font-family:Verdana,sans-serif;font-size:22px;line-height:35px;color:#333;font-weight:700;letter-spacing:-1px">{$title}</h1>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="padding:30px 25px 0 25px;font-family:Verdana,sans-serif;font-size:15px;line-height:26px;color:#555;text-align:left">
{$contentHtml}
</td>
</tr>
{$buttonSection}
<tr>
<td bgcolor="#ffffff" style="padding:30px 25px 0 25px;font-family:Verdana,sans-serif;font-size:15px;line-height:26px;color:#555;text-align:left">
{$outro}
</td>
</tr>
<tr>
<td align="center" bgcolor="#ffffff" dir="ltr" style="padding:10px 25px 40px 25px" valign="top" width="100%">&nbsp;</td>
</tr>
<tr><td aria-hidden="true" height="30" style="font-size:0;line-height:0">&nbsp;</td></tr>
</tbody>
</table>
</td>
</tr>
<tr>
<td align="left" bgcolor="#eeeeee" style="vertical-align:top" width="100%">
<p style="font-family:Verdana,sans-serif;font-size:11px;line-height:1.454545;color:#888;margin:0!important;padding:0!important;text-align:center"><br>&copy; {$brandName}<br><br><br><br></p>
</td>
</tr>
</tbody>
</table>
HTML;
    }

    public static function paragraph(string $html): string
    {
        return '<p style="margin:0">'.$html.'</p>';
    }

    private static function buttonSection(?string $label, ?string $url, string $accentColor): string
    {
        if ($label === null || $url === null || $label === '' || $url === '') {
            return '';
        }

        return <<<HTML
<tr>
<td bgcolor="#ffffff" style="padding:30px 25px 0 25px">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:auto">
<tbody>
<tr>
<td style="border-radius:50px;background:{$accentColor};text-align:center">
<a href="{$url}" style="background:{$accentColor};border:15px solid {$accentColor};font-family:Verdana,sans-serif;font-size:13px;line-height:15px;text-align:center;text-decoration:none;display:block;border-radius:50px;font-weight:700" target="_blank">
<font color="#ffffff">{$label}</font>
</a>
</td>
</tr>
</tbody>
</table>
</td>
</tr>
HTML;
    }

    private static function defaultOutro(string $brandName): string
    {
        return self::paragraph(
            'Qualquer dúvida, fique à vontade para entrar em contato com a gente!<br><br>'
            .'<b>Um abraço,<br>Equipe '.$brandName.'</b>',
        );
    }
}
