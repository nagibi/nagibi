import * as Icons from 'lucide-react';
import { LayoutGrid, type LucideIcon } from 'lucide-react';
import { MENU_SIDEBAR } from '@/config/menu.config';
import type { MenuConfig } from '@/config/types';

type IconLookup = {
  byPath: Map<string, LucideIcon>;
  byTitle: Map<string, LucideIcon>;
  bySlug: Map<string, LucideIcon>;
};

function toPascalCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function buildLookup(items: MenuConfig, lookup: IconLookup) {
  for (const item of items) {
    if (item.heading || !item.icon) continue;

    if (item.path) {
      lookup.byPath.set(item.path, item.icon);
      const slug = item.path.replace(/^\//, '').split('/')[0];
      if (slug && !lookup.bySlug.has(slug)) {
        lookup.bySlug.set(slug, item.icon);
      }
    }

    if (item.title) {
      lookup.byTitle.set(item.title, item.icon);
    }

    if (item.children) {
      buildLookup(item.children, lookup);
    }
  }
}

const lookup: IconLookup = {
  byPath: new Map(),
  byTitle: new Map(),
  bySlug: new Map(),
};

buildLookup(MENU_SIDEBAR, lookup);

// Grupos vindos da API (sem heading, como accordion pai)
lookup.byTitle.set('Gestão', Icons.Users);
lookup.byTitle.set('Relatórios', Icons.BarChart2);
lookup.byTitle.set('Administração', Icons.Settings);
lookup.byTitle.set('Conta', Icons.User);
lookup.byTitle.set('Ferramentas', Icons.Wrench);
lookup.byTitle.set('Documentação API', Icons.BookOpen);
lookup.byTitle.set('Horizon', Icons.Gauge);
lookup.byTitle.set('Telescope', Icons.Telescope);
lookup.byTitle.set('Clockwork', Icons.Clock);
lookup.byTitle.set('Log Viewer', Icons.ScrollText);
lookup.byTitle.set('phpMyAdmin', Icons.Database);
lookup.byTitle.set('Mailpit', Icons.Mailbox);
lookup.byTitle.set('Grafana', Icons.LineChart);
lookup.byTitle.set('Prometheus', Icons.Flame);
lookup.byTitle.set('cAdvisor', Icons.Container);
lookup.byTitle.set('Sentry', Icons.Bug);
lookup.byTitle.set('Configurações', Icons.Settings);
lookup.byTitle.set('Empresas', Icons.Building2);
lookup.byTitle.set('Notificações', Icons.Bell);
lookup.byTitle.set('Lista', Icons.Inbox);
lookup.byTitle.set('Preferências', Icons.Settings2);
lookup.byTitle.set('Funções', Icons.ShieldCheck);
lookup.byTitle.set('Permissões', Icons.Shield);
lookup.byTitle.set('Meu perfil', Icons.User);
lookup.bySlug.set('gestao', Icons.Users);
lookup.bySlug.set('relatorios-grupo', Icons.BarChart2);
lookup.bySlug.set('administracao', Icons.Settings);
lookup.bySlug.set('conta', Icons.User);
lookup.bySlug.set('ferramentas', Icons.Wrench);
lookup.bySlug.set('documentacao-api', Icons.BookOpen);
lookup.bySlug.set('horizon', Icons.Gauge);
lookup.bySlug.set('telescope', Icons.Telescope);
lookup.bySlug.set('clockwork', Icons.Clock);
lookup.bySlug.set('log-viewer', Icons.ScrollText);
lookup.bySlug.set('phpmyadmin', Icons.Database);
lookup.bySlug.set('mailpit', Icons.Mailbox);
lookup.bySlug.set('grafana', Icons.LineChart);
lookup.bySlug.set('prometheus', Icons.Flame);
lookup.bySlug.set('cadvisor', Icons.Container);
lookup.bySlug.set('sentry', Icons.Bug);
lookup.bySlug.set('meilisearch', Icons.Search);
lookup.bySlug.set('empresas', Icons.Building2);
lookup.byPath.set('/admin/tenants', Icons.Building2);
lookup.byPath.set('/roles', Icons.ShieldCheck);
lookup.byPath.set('/permissions', Icons.Shield);
lookup.byPath.set('/notification-preferences', Icons.Settings2);
lookup.byPath.set('/notifications', Icons.Inbox);
lookup.bySlug.set('notificacoes', Icons.Bell);
lookup.bySlug.set('funcoes', Icons.ShieldCheck);
lookup.bySlug.set('permissoes', Icons.Shield);
lookup.byPath.set('/profile', Icons.User);
lookup.byPath.set('/security', Icons.Shield);
lookup.bySlug.set('seguranca', Icons.Shield);
lookup.byPath.set('/user-approvals', Icons.UserCheck);
lookup.byPath.set('/message-templates', Icons.MessageSquare);
lookup.byPath.set('/admin/message-templates', Icons.MessageSquare);
lookup.byTitle.set('Templates de Mensagem', Icons.MessageSquare);
lookup.bySlug.set('templates-mensagem', Icons.MessageSquare);
lookup.byPath.set('/reports', Icons.BarChart2);
lookup.byPath.set('/admin/reports', Icons.BarChart2);
lookup.byTitle.set('Modelos de Relatório', Icons.BarChart2);
lookup.bySlug.set('templates-relatorio', Icons.BarChart2);
lookup.byPath.set('/reports/executions', Icons.FileBarChart);
lookup.byPath.set('/equipamentos', Icons.HardHat);
lookup.byTitle.set('Equipamentos', Icons.HardHat);
lookup.byTitle.set('EquipControl', Icons.HardHat);
lookup.bySlug.set('equipcontrol', Icons.HardHat);
lookup.byPath.set('/equipamentos/estoque', Icons.Package);
lookup.byPath.set('/equipamentos/movimentacoes', Icons.Repeat2);
lookup.byPath.set('/equipamentos/manutencao', Icons.Wrench);
lookup.byPath.set('/equipamentos/baixados', Icons.Archive);
lookup.bySlug.set('equipcontrol-estoque', Icons.Package);
lookup.bySlug.set('equipcontrol-movimentacoes', Icons.Repeat2);
lookup.bySlug.set('equipcontrol-manutencao', Icons.Wrench);
lookup.bySlug.set('equipcontrol-baixados', Icons.Archive);
lookup.byTitle.set('Estoque', Icons.Package);
lookup.byTitle.set('Movimentações', Icons.Repeat2);
lookup.byTitle.set('Manutenções', Icons.Wrench);
lookup.byTitle.set('Manutenção', Icons.Wrench);
lookup.byTitle.set('Baixados', Icons.Archive);

function resolveFromLucideName(name: string): LucideIcon | null {
  const candidates = [
    name,
    name.charAt(0).toUpperCase() + name.slice(1),
    toPascalCase(name),
  ];

  for (const candidate of [...new Set(candidates)]) {
    const icon = (Icons as Record<string, unknown>)[candidate];
    if (typeof icon === 'function') {
      return icon as LucideIcon;
    }
  }

  return null;
}

export function resolveMenuIcon(options: {
  icon?: string | null;
  path?: string | null;
  slug?: string | null;
  title?: string | null;
}): LucideIcon {
  const { icon, path, slug, title } = options;

  if (icon?.trim()) {
    const resolved = resolveFromLucideName(icon.trim());
    if (resolved) return resolved;
  }

  if (path) {
    const exact = lookup.byPath.get(path);
    if (exact) return exact;
  }

  if (slug) {
    const bySlug = lookup.bySlug.get(slug.toLowerCase());
    if (bySlug) return bySlug;

    const fromName = resolveFromLucideName(slug);
    if (fromName) return fromName;
  }

  if (title) {
    const byTitle = lookup.byTitle.get(title);
    if (byTitle) return byTitle;
  }

  if (path) {
    const segment = path.replace(/^\//, '').split('/')[0];
    const bySegment = lookup.bySlug.get(segment);
    if (bySegment) return bySegment;
  }

  return LayoutGrid;
}
