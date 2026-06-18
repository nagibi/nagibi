<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Central\CentralUser;
use Illuminate\Console\Command;

final class DevToolsLinks extends Command
{
    protected $signature = 'devtools:links
                            {--email= : Email do CentralUser}
                            {--tenant= : Tenant ID opcional (query tenant_id na API Docs)}';

    protected $description = 'Gera links de acesso para Horizon, Telescope, Clockwork, Log Viewer e API Docs';

    public function handle(): int
    {
        $user = $this->resolveUser();

        if ($user === null) {
            $this->error('Nenhum CentralUser encontrado.');

            return self::FAILURE;
        }

        if (! $user->is_super_admin) {
            $this->warn('Este usuário não é super-admin; o acesso pode ser negado fora do ambiente local.');
        }

        $token = $user->createToken('devtools-links')->plainTextToken;
        $tenantId = $this->option('tenant');

        $horizonUrl = $this->urlWithToken(
            (string) config('dev-tools.horizon_url'),
            $token,
        );

        $telescopeUrl = $this->urlWithToken(
            (string) config('dev-tools.telescope_url'),
            $token,
        );

        $clockworkUrl = $this->urlWithToken(
            (string) config('dev-tools.clockwork_url'),
            $token,
        );

        $logViewerUrl = $this->urlWithToken(
            (string) config('dev-tools.log_viewer_url'),
            $token,
        );

        $apiDocsUrl = $this->urlWithToken(
            (string) config('dev-tools.api_docs_url'),
            $token,
            is_string($tenantId) && $tenantId !== '' ? $tenantId : null,
        );

        $this->newLine();
        $this->info("Token gerado para: {$user->name} ({$user->email})");
        $this->newLine();
        $this->line("  <fg=blue>Horizon</>     {$horizonUrl}");
        $this->line("  <fg=blue>Telescope</>   {$telescopeUrl}");
        $this->line("  <fg=blue>Clockwork</>   {$clockworkUrl}");
        $this->line("  <fg=blue>Log Viewer</>  {$logViewerUrl}");
        $this->line("  <fg=blue>API Docs</>    {$apiDocsUrl}");
        $this->line("  <fg=blue>Grafana</>     ".(string) config('dev-tools.grafana_url'));
        $this->line("  <fg=blue>Prometheus</>  ".(string) config('dev-tools.prometheus_url'));
        $this->line("  <fg=blue>cAdvisor</>    ".(string) config('dev-tools.cadvisor_url'));
        $this->line("  <fg=blue>Sentry</>      ".(string) config('dev-tools.sentry_url'));
        $this->newLine();
        $this->comment('Os links redirecionam e gravam cookie de acesso (válido pelo tempo da sessão).');

        return self::SUCCESS;
    }

    private function resolveUser(): ?CentralUser
    {
        $email = $this->option('email');

        if (is_string($email) && $email !== '') {
            return CentralUser::query()->where('email', $email)->first();
        }

        return CentralUser::query()
            ->where('is_super_admin', true)
            ->where('is_active', true)
            ->orderBy('id')
            ->first()
            ?? CentralUser::query()->orderBy('id')->first();
    }

    private function urlWithToken(string $base, string $token, ?string $tenantId = null): string
    {
        $params = ['access_token' => $token];

        if ($tenantId !== null) {
            $params['tenant_id'] = $tenantId;
        }

        $separator = str_contains($base, '?') ? '&' : '?';

        return $base.$separator.http_build_query($params);
    }
}
