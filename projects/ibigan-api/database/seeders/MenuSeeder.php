<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Menu;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class MenuSeeder extends Seeder
{
    public function run(): void
    {
        if (! tenancy()->initialized) {
            throw new RuntimeException(
                'MenuSeeder deve ser executado no contexto de um tenant. '
                    . 'Use: php artisan tenants:seed --class=MenuSeeder',
            );
        }

        Menu::query()->forceDelete();

        // ── Dashboard ─────────────────────────────────────────────
        Menu::create([
            'title' => 'Dashboard',
            'slug' => 'dashboard',
            'icon' => 'LayoutDashboard',
            'path' => '/dashboard',
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        $equipamento = Menu::create([
            'title' => 'Equipamentos',
            'slug' => 'equipamento',
            'icon' => 'HardHat',
            'path' => '/equipamentos',
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        $equipamentoOperacao = Menu::create([
            'title' => 'Operação',
            'slug' => 'equipamento-operacao',
            'icon' => null,
            'path' => null,
            'parent_id' => $equipamento->id,
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Dashboard',
            'slug' => 'equipamento-gestao',
            'icon' => 'LayoutDashboard',
            'path' => '/equipamentos/dashboard',
            'parent_id' => $equipamentoOperacao->id,
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Estoque',
            'slug' => 'equipamento-estoque',
            'icon' => 'Package',
            'path' => '/equipamentos/estoque',
            'parent_id' => $equipamentoOperacao->id,
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Movimentações',
            'slug' => 'equipamento-movimentacoes',
            'icon' => 'Repeat2',
            'path' => '/equipamentos/movimentacoes',
            'parent_id' => $equipamentoOperacao->id,
            'order' => 2,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Manutenções',
            'slug' => 'equipamento-manutencao',
            'icon' => 'Wrench',
            'path' => '/equipamentos/manutencao',
            'parent_id' => $equipamentoOperacao->id,
            'order' => 3,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Baixados',
            'slug' => 'equipamento-baixados',
            'icon' => 'Archive',
            'path' => '/equipamentos/baixados',
            'parent_id' => $equipamentoOperacao->id,
            'order' => 4,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        $equipamentoCadastros = Menu::create([
            'title' => 'Cadastros',
            'slug' => 'equipamento-cadastros',
            'icon' => null,
            'path' => null,
            'parent_id' => $equipamento->id,
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Grupos',
            'slug' => 'equipamento-grupos',
            'icon' => 'Layers',
            'path' => '/equipamentos/grupos',
            'parent_id' => $equipamentoCadastros->id,
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Tipos',
            'slug' => 'equipamento-tipos',
            'icon' => 'Shapes',
            'path' => '/equipamentos/tipos',
            'parent_id' => $equipamentoCadastros->id,
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Fornecedores',
            'slug' => 'equipamento-fornecedores',
            'icon' => 'Truck',
            'path' => '/equipamentos/fornecedores',
            'parent_id' => $equipamentoCadastros->id,
            'order' => 2,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Obras',
            'slug' => 'equipamento-obras',
            'icon' => 'Building2',
            'path' => '/equipamentos/obras',
            'parent_id' => $equipamentoCadastros->id,
            'order' => 3,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'super-admin'],
        ]);

        // ── Gestão ────────────────────────────────────────────────
        $gestao = Menu::create([
            'title' => 'Gestão',
            'slug' => 'gestao',
            'icon' => null,
            'path' => null,
            'order' => 2,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Usuários',
            'slug' => 'usuarios',
            'icon' => 'Users',
            'path' => '/users',
            'parent_id' => $gestao->id,
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Aprovações',
            'slug' => 'aprovacoes',
            'icon' => 'UserCheck',
            'path' => '/user-approvals',
            'parent_id' => $gestao->id,
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Convites',
            'slug' => 'convites',
            'icon' => 'Mail',
            'path' => '/invites',
            'parent_id' => $gestao->id,
            'order' => 2,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Campanhas',
            'slug' => 'campanhas',
            'icon' => 'Megaphone',
            'path' => '/campaigns',
            'parent_id' => $gestao->id,
            'order' => 3,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Templates de Mensagem',
            'slug' => 'templates-mensagem',
            'icon' => 'MessageSquare',
            'path' => '/message-templates',
            'parent_id' => $gestao->id,
            'order' => 4,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        // ── Relatórios ────────────────────────────────────────────
        $relatorios = Menu::create([
            'title' => 'Relatórios',
            'slug' => 'relatorios-grupo',
            'icon' => null,
            'path' => null,
            'order' => 3,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Modelos de Relatório',
            'slug' => 'templates-relatorio',
            'icon' => 'BarChart2',
            'path' => '/reports',
            'parent_id' => $relatorios->id,
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Minhas Execuções',
            'slug' => 'minhas-execucoes',
            'icon' => 'FileBarChart',
            'path' => '/reports/executions',
            'parent_id' => $relatorios->id,
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'manager', 'viewer', 'operator', 'super-admin'],
        ]);

        // ── Administração (tenant + SaaS) ─────────────────────────
        $administracao = Menu::create([
            'title' => 'Administração',
            'slug' => 'administracao',
            'icon' => null,
            'path' => null,
            'order' => 4,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Empresas',
            'slug' => 'empresas',
            'icon' => 'Building2',
            'path' => '/admin/tenants',
            'parent_id' => $administracao->id,
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['super-admin'],
        ]);

        Menu::create([
            'title' => 'Menus',
            'slug' => 'menus',
            'icon' => 'Menu',
            'path' => '/menus',
            'parent_id' => $administracao->id,
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Funções',
            'slug' => 'funcoes',
            'icon' => 'ShieldCheck',
            'path' => '/roles',
            'parent_id' => $administracao->id,
            'order' => 2,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Permissões',
            'slug' => 'permissoes',
            'icon' => 'Shield',
            'path' => '/permissions',
            'parent_id' => $administracao->id,
            'order' => 3,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Webhooks',
            'slug' => 'webhooks',
            'icon' => 'Webhook',
            'path' => '/webhooks',
            'parent_id' => $administracao->id,
            'order' => 4,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Activity Log',
            'slug' => 'activity-log',
            'icon' => 'Activity',
            'path' => '/activity-logs',
            'parent_id' => $administracao->id,
            'order' => 5,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        // ── Ferramentas (dev) ─────────────────────────────────────
        $ferramentas = Menu::create([
            'title' => 'Ferramentas',
            'slug' => 'ferramentas',
            'icon' => 'Wrench',
            'path' => null,
            'order' => 4,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Documentação API',
            'slug' => 'documentacao-api',
            'icon' => 'BookOpen',
            'path' => config('dev-tools.api_docs_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 0,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Horizon',
            'slug' => 'horizon',
            'icon' => 'Gauge',
            'path' => config('dev-tools.horizon_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 1,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Telescope',
            'slug' => 'telescope',
            'icon' => 'Telescope',
            'path' => config('dev-tools.telescope_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 2,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Clockwork',
            'slug' => 'clockwork',
            'icon' => 'Clock',
            'path' => config('dev-tools.clockwork_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 3,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Log Viewer',
            'slug' => 'log-viewer',
            'icon' => 'ScrollText',
            'path' => config('dev-tools.log_viewer_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 4,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'phpMyAdmin',
            'slug' => 'phpmyadmin',
            'icon' => 'Database',
            'path' => config('dev-tools.phpmyadmin_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 5,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Mailpit',
            'slug' => 'mailpit',
            'icon' => 'Mailbox',
            'path' => config('dev-tools.mailpit_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 6,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Grafana',
            'slug' => 'grafana',
            'icon' => 'LineChart',
            'path' => config('dev-tools.grafana_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 7,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Prometheus',
            'slug' => 'prometheus',
            'icon' => 'Flame',
            'path' => config('dev-tools.prometheus_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 8,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'cAdvisor',
            'slug' => 'cadvisor',
            'icon' => 'Container',
            'path' => config('dev-tools.cadvisor_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 9,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Sentry',
            'slug' => 'sentry',
            'icon' => 'Bug',
            'path' => config('dev-tools.sentry_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 10,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        Menu::create([
            'title' => 'Meilisearch',
            'slug' => 'meilisearch',
            'icon' => 'Search',
            'path' => config('dev-tools.meilisearch_url'),
            'target' => '_blank',
            'parent_id' => $ferramentas->id,
            'order' => 11,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        // ── Configurações ─────────────────────────────────────────
        $configuracoes = Menu::create([
            'title' => 'Configurações',
            'slug' => 'configuracoes',
            'icon' => 'Settings',
            'path' => null,
            'order' => 5,
            'is_active' => true,
            'requires_auth' => true,
            'roles' => ['admin', 'super-admin'],
        ]);

        $translationKeys = [
            'dashboard' => 'menu.dashboard',
            'equipamento' => 'menu.equipamento',
            'equipamento-operacao' => 'menu.equipamento.operation',
            'equipamento-gestao' => 'menu.equipamento.management',
            'equipamento-estoque' => 'menu.equipamento.stock',
            'equipamento-manutencao' => 'menu.equipamento.maintenance',
            'equipamento-movimentacoes' => 'menu.equipamento.movements',
            'equipamento-baixados' => 'menu.equipamento.decommissioned',
            'equipamento-cadastros' => 'menu.equipamento.catalogs',
            'equipamento-grupos' => 'menu.equipamento.groups',
            'equipamento-tipos' => 'menu.equipamento.types',
            'equipamento-fornecedores' => 'menu.equipamento.suppliers',
            'equipamento-obras' => 'menu.equipamento.projects',
            'gestao' => 'menu.management',
            'usuarios' => 'menu.users',
            'aprovacoes' => 'menu.user_approvals',
            'convites' => 'menu.invites',
            'campanhas' => 'menu.campaigns',
            'templates-mensagem' => 'menu.message_templates',
            'relatorios-grupo' => 'menu.reports',
            'templates-relatorio' => 'menu.report_templates',
            'minhas-execucoes' => 'menu.my_executions',
            'administracao' => 'menu.administration',
            'empresas' => 'menu.tenants',
            'menus' => 'menu.menus',
            'funcoes' => 'menu.roles',
            'permissoes' => 'menu.permissions',
            'webhooks' => 'menu.webhooks',
            'activity-log' => 'menu.activity_log',
            'ferramentas' => 'menu.tools',
            'documentacao-api' => 'menu.api_docs',
            'horizon' => 'menu.horizon',
            'telescope' => 'menu.telescope',
            'clockwork' => 'menu.clockwork',
            'log-viewer' => 'menu.log_viewer',
            'phpmyadmin' => 'menu.phpmyadmin',
            'mailpit' => 'menu.mailpit',
            'grafana' => 'menu.grafana',
            'prometheus' => 'menu.prometheus',
            'cadvisor' => 'menu.cadvisor',
            'sentry' => 'menu.sentry',
            'meilisearch' => 'menu.meilisearch',
            'configuracoes' => 'menu.settings',
        ];

        if (! Schema::hasColumn('menus', 'translation_key')) {
            $this->command?->warn(
                'Coluna menus.translation_key ausente. Rode: php artisan tenants:migrate',
            );

            return;
        }

        foreach ($translationKeys as $slug => $translationKey) {
            Menu::query()->where('slug', $slug)->update(['translation_key' => $translationKey]);
        }
    }
}
