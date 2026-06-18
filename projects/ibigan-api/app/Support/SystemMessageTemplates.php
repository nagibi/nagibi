<?php

declare(strict_types=1);

namespace App\Support;

use App\Services\PlatformCatalogService;

final class SystemMessageTemplates
{
    public const REPORT_COMPLETED_ACTION_LABEL = 'DOWNLOAD';

    public const USER_APPROVED_ACTION_LABEL = 'ACESSAR O SISTEMA';

    public const PASSWORD_RESET_ACTION_LABEL = 'REDEFINIR SENHA';

    /**
     * @return list<array<string, mixed>>
     */
    public static function definitions(): array
    {
        return PlatformCatalogDefinitions::messageTemplates();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function defaultDefinitions(): array
    {
        $brand = (string) config('email-branding.brand_name', 'Nagibi');

        return [
            [
                'name'       => 'Relatório pronto',
                'slug'       => MessageTemplateSlugs::REPORT_COMPLETED,
                'subject'    => 'Relatório pronto: {{report_name}}',
                'body'       => EmailLayout::render(
                    title: 'Relatório Executado!',
                    contentHtml: EmailLayout::paragraph(
                        'Seu relatório <strong>{{report_name}}</strong> foi processado com sucesso.<br><br>'
                        .'{{rows_summary}}.<br><br>'
                        .'O resultado estará disponível por 7 dias.',
                    ),
                    buttonLabel: self::REPORT_COMPLETED_ACTION_LABEL,
                    buttonUrl: '{{download_url}}',
                    afterButtonHtml: EmailLayout::paragraph(
                        'Ou copie e cole o link:<br>'
                        .'<a href="{{download_url}}" target="_blank">{{download_url}}</a>.<br><br>'
                        .'Se você não solicitou a execução desse relatório, ignore este e-mail.<br><br>'
                        .'Qualquer dúvida, fique à vontade para entrar em contato com a gente!<br><br>'
                        .'<b>Um abraço,<br>Equipe '.$brand.'</b>',
                    ),
                ),
                'merge_tags' => [
                    '{{report_name}}',
                    '{{rows_summary}}',
                    '{{download_url}}',
                    '{{rows_count}}',
                    '{{duration_ms}}',
                    '{{expires_at}}',
                    '{{name}}',
                ],
                'is_active'  => true,
            ],
            [
                'name'       => 'Convite de usuário',
                'slug'       => MessageTemplateSlugs::USER_INVITE,
                'subject'    => 'Convite para participar',
                'body'       => EmailLayout::render(
                    title: 'Convite para participar',
                    contentHtml: EmailLayout::paragraph(
                        'Olá,<br><br>'
                        .'Você foi convidado por <strong>{{invited_by}}</strong> para participar com o perfil '
                        .'<strong>{{role}}</strong>.<br><br>'
                        .'Expira em: {{expires_at}}',
                    ),
                    buttonLabel: 'ACEITAR CONVITE',
                    buttonUrl: '{{link}}',
                    afterButtonHtml: EmailLayout::paragraph(
                        'Ou copie e cole o link:<br>'
                        .'<a href="{{link}}" target="_blank">{{link}}</a>.<br><br>'
                        .'Token: <strong>{{token}}</strong><br><br>'
                        .'Qualquer dúvida, fique à vontade para entrar em contato com a gente!<br><br>'
                        .'<b>Um abraço,<br>Equipe '.$brand.'</b>',
                    ),
                ),
                'merge_tags' => [
                    '{{invited_by}}',
                    '{{role}}',
                    '{{token}}',
                    '{{expires_at}}',
                    '{{link}}',
                    '{{email}}',
                ],
                'is_active'  => true,
            ],
            [
                'name'       => 'Usuário criado',
                'slug'       => MessageTemplateSlugs::USER_CREATED,
                'subject'    => 'Novo usuário cadastrado',
                'body'       => EmailLayout::render(
                    title: 'Novo usuário cadastrado',
                    contentHtml: EmailLayout::paragraph(
                        '<strong>{{user_name}}</strong> ({{user_email}}) foi adicionado ao sistema.',
                    ),
                ),
                'merge_tags' => [
                    '{{user_name}}',
                    '{{user_email}}',
                ],
                'is_active'  => true,
            ],
            [
                'name'       => 'Cadastro aguardando aprovação',
                'slug'       => MessageTemplateSlugs::USER_PENDING_APPROVAL,
                'subject'    => 'Cadastro aguardando aprovação',
                'body'       => EmailLayout::render(
                    title: 'Cadastro aguardando aprovação',
                    contentHtml: EmailLayout::paragraph(
                        '<strong>{{user_name}}</strong> ({{user_email}}) aguarda aprovação de cadastro.',
                    ),
                ),
                'merge_tags' => [
                    '{{user_name}}',
                    '{{user_email}}',
                ],
                'is_active'  => true,
            ],
            [
                'name'       => 'Usuário aprovado',
                'slug'       => MessageTemplateSlugs::USER_APPROVED,
                'subject'    => 'Seu cadastro foi aprovado!',
                'body'       => EmailLayout::render(
                    title: 'Cadastro aprovado!',
                    contentHtml: EmailLayout::paragraph(
                        'Olá, <strong>{{name}}</strong>!<br><br>'
                        .'Seu cadastro foi aprovado e você já pode acessar o sistema.',
                    ),
                    buttonLabel: self::USER_APPROVED_ACTION_LABEL,
                    buttonUrl: '{{app_url}}',
                    afterButtonHtml: EmailLayout::paragraph(
                        'Ou copie e cole o link:<br>'
                        .'<a href="{{app_url}}" target="_blank">{{app_url}}</a>.<br><br>'
                        .'Qualquer dúvida, fique à vontade para entrar em contato com a gente!<br><br>'
                        .'<b>Um abraço,<br>Equipe '.$brand.'</b>',
                    ),
                ),
                'merge_tags' => [
                    '{{name}}',
                    '{{app_url}}',
                ],
                'is_active'  => true,
            ],
            [
                'name'       => 'Usuário rejeitado',
                'slug'       => MessageTemplateSlugs::USER_REJECTED,
                'subject'    => 'Cadastro não aprovado',
                'body'       => EmailLayout::render(
                    title: 'Cadastro não aprovado',
                    contentHtml: EmailLayout::paragraph(
                        'Olá, <strong>{{name}}</strong>!<br><br>'
                        .'Infelizmente seu cadastro não foi aprovado.<br><br>'
                        .'{{reason_line}}<br><br>'
                        .'Entre em contato com o administrador para mais informações.',
                    ),
                ),
                'merge_tags' => [
                    '{{name}}',
                    '{{reason_line}}',
                ],
                'is_active'  => true,
            ],
            [
                'name'       => 'Redefinição de senha',
                'slug'       => MessageTemplateSlugs::PASSWORD_RESET,
                'subject'    => 'Redefinição de senha solicitada',
                'body'       => EmailLayout::render(
                    title: 'Redefinição de senha',
                    contentHtml: EmailLayout::paragraph(
                        'Olá, <strong>{{name}}</strong>!<br><br>'
                        .'Recebemos sua solicitação de redefinição de senha.<br><br>'
                        .'Clique no botão abaixo para criar uma nova senha.<br><br>'
                        .'Este link expira em breve.',
                    ),
                    buttonLabel: self::PASSWORD_RESET_ACTION_LABEL,
                    buttonUrl: '{{link}}',
                    afterButtonHtml: EmailLayout::paragraph(
                        'Ou copie e cole o link:<br>'
                        .'<a href="{{link}}" target="_blank">{{link}}</a>.<br><br>'
                        .'Se você não solicitou a redefinição de senha, ignore este e-mail.<br><br>'
                        .'Qualquer dúvida, fique à vontade para entrar em contato com a gente!<br><br>'
                        .'<b>Um abraço,<br>Equipe '.$brand.'</b>',
                    ),
                ),
                'merge_tags' => [
                    '{{name}}',
                    '{{email}}',
                    '{{link}}',
                ],
                'is_active'  => true,
            ],
            [
                'name'       => 'Código de verificação 2FA',
                'slug'       => MessageTemplateSlugs::TWO_FACTOR_CODE,
                'subject'    => 'Seu código de verificação',
                'body'       => EmailLayout::render(
                    title: 'Código de verificação',
                    contentHtml: EmailLayout::paragraph(
                        'Olá, <strong>{{name}}</strong>!<br><br>'
                        .'{{context_line}}<br><br>'
                        .'Seu código é: <strong style="font-size:24px;letter-spacing:4px">{{code}}</strong><br><br>'
                        .'Este código expira em {{expires_minutes}} minutos.',
                    ),
                    afterButtonHtml: EmailLayout::paragraph(
                        'Se você não solicitou este código, ignore este e-mail.<br><br>'
                        .'Qualquer dúvida, fique à vontade para entrar em contato com a gente!<br><br>'
                        .'<b>Um abraço,<br>Equipe '.$brand.'</b>',
                    ),
                ),
                'merge_tags' => [
                    '{{name}}',
                    '{{email}}',
                    '{{code}}',
                    '{{expires_minutes}}',
                    '{{context_line}}',
                ],
                'is_active'  => true,
            ],
        ];
    }

    public static function seed(): void
    {
        app(PlatformCatalogService::class)->syncMessageTemplates();
    }
}
