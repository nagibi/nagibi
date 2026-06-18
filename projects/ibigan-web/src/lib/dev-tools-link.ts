import {
  DEV_TOOLS_URLS,
  EXTERNAL_DEV_TOOLS_URLS,
  isLaravelDevToolsPathname,
  resolveDevToolsUrl,
} from '@/lib/dev-tools-urls';

const DEV_TOOLS_PATHS = new Set<string>(Object.values(DEV_TOOLS_URLS));

function isDevToolsPath(path: string): boolean {
  if (DEV_TOOLS_PATHS.has(path)) {
    return true;
  }

  if (EXTERNAL_DEV_TOOLS_URLS.has(path)) {
    return true;
  }

  try {
    const normalized = new URL(path, 'http://localhost').pathname.replace(/\/$/, '');

    return isLaravelDevToolsPathname(normalized);
  } catch {
    return path.includes('/docs/api')
      || path.includes('/horizon')
      || path.includes('/telescope')
      || path.includes('/clockwork')
      || path.includes('/log-viewer');
  }
}

function requiresDevToolsAccessToken(path: string): boolean {
  if (!isDevToolsPath(path) || EXTERNAL_DEV_TOOLS_URLS.has(path)) {
    return false;
  }

  try {
    const normalized = new URL(path, 'http://localhost').pathname.replace(/\/$/, '');

    return isLaravelDevToolsPathname(normalized);
  } catch {
    return path.includes('/docs/api')
      || path.includes('/horizon')
      || path.includes('/telescope')
      || path.includes('/clockwork')
      || path.includes('/log-viewer');
  }
}

function resolveAccessToken(): string | null {
  return localStorage.getItem('ibigan_token')
    ?? localStorage.getItem('ibigan_central_token');
}

function resolveTenantId(token: string): string | null {
  const tenantToken = localStorage.getItem('ibigan_token');

  if (tenantToken && tenantToken === token) {
    return localStorage.getItem('ibigan_tenant_id');
  }

  return null;
}

export function buildDevToolsHref(path: string): string {
  const resolved = resolveDevToolsUrl(path);

  if (!requiresDevToolsAccessToken(path)) {
    return resolved;
  }

  const url = new URL(resolved);

  const token = resolveAccessToken();

  if (token) {
    url.searchParams.set('access_token', token);

    const tenantId = resolveTenantId(token);
    if (tenantId) {
      url.searchParams.set('tenant_id', tenantId);
    }
  }

  return url.toString();
}

export function isDevToolsMenuPath(path?: string): boolean {
  return Boolean(path && isDevToolsPath(path));
}
