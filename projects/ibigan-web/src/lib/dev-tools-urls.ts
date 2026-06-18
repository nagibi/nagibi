function apiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost/api';

  if (/^https?:\/\//i.test(apiUrl)) {
    return apiUrl.replace(/\/api\/?$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}`;
  }

  return 'http://localhost';
}

/** Host usado no navegador (LAN, localhost, etc.). */
function browserHost(): string {
  if (typeof window === 'undefined') {
    return 'localhost';
  }

  return window.location.hostname;
}

/**
 * URLs de serviços locais (Mailpit, phpMyAdmin, …).
 * Se o .env usa localhost mas o app abre por IP/LAN, reescreve para o host atual.
 */
export function resolveLocalServiceUrl(
  envUrl: string | undefined,
  defaultPort: number,
): string {
  const fallback = () => {
    const host = browserHost();
    const protocol =
      typeof window !== 'undefined' ? window.location.protocol : 'http:';

    return `${protocol}//${host}:${defaultPort}`;
  };

  const raw = envUrl?.trim();
  if (!raw) {
    return fallback();
  }

  try {
    const parsed = new URL(raw);
    const pageHost = browserHost();
    const pointsToLoopback =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const browsingViaLan =
      pageHost !== 'localhost' && pageHost !== '127.0.0.1';

    if (pointsToLoopback && browsingViaLan) {
      parsed.hostname = pageHost;
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

export function isLocalDevEnvironment(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  const host = browserHost();

  return (
    host === 'localhost'
    || host === '127.0.0.1'
    || host.endsWith('.localhost')
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

export { apiBaseUrl };

const LARAVEL_DEV_TOOLS_PATHS = [
  '/docs/api',
  '/horizon',
  '/telescope',
  '/clockwork',
  '/log-viewer',
] as const;

export function isLaravelDevToolsPathname(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';

  return LARAVEL_DEV_TOOLS_PATHS.some(
    (path) => normalized === path || normalized.endsWith(path),
  );
}

export const DEV_TOOLS_URLS = {
  apiDocs:
    import.meta.env.VITE_DEV_API_DOCS_URL || `${apiBaseUrl()}/docs/api`,
  horizon:
    import.meta.env.VITE_DEV_HORIZON_URL || `${apiBaseUrl()}/horizon`,
  telescope:
    import.meta.env.VITE_DEV_TELESCOPE_URL || `${apiBaseUrl()}/telescope`,
  clockwork:
    import.meta.env.VITE_DEV_CLOCKWORK_URL || `${apiBaseUrl()}/clockwork`,
  logViewer:
    import.meta.env.VITE_DEV_LOG_VIEWER_URL || `${apiBaseUrl()}/log-viewer`,
  phpMyAdmin: resolveLocalServiceUrl(
    import.meta.env.VITE_DEV_PHPMYADMIN_URL,
    8080,
  ),
  mailpit: resolveLocalServiceUrl(
    import.meta.env.VITE_DEV_MAILPIT_URL,
    8025,
  ),
  grafana: resolveLocalServiceUrl(
    import.meta.env.VITE_DEV_GRAFANA_URL,
    3001,
  ),
  prometheus: resolveLocalServiceUrl(
    import.meta.env.VITE_DEV_PROMETHEUS_URL,
    9091,
  ),
  cAdvisor: resolveLocalServiceUrl(
    import.meta.env.VITE_DEV_CADVISOR_URL,
    8086,
  ),
  sentry:
    import.meta.env.VITE_DEV_SENTRY_URL?.trim() || 'https://sentry.io',
} as const;

export const EXTERNAL_DEV_TOOLS_URLS = new Set<string>([
  DEV_TOOLS_URLS.phpMyAdmin,
  DEV_TOOLS_URLS.mailpit,
  DEV_TOOLS_URLS.grafana,
  DEV_TOOLS_URLS.prometheus,
  DEV_TOOLS_URLS.cAdvisor,
  DEV_TOOLS_URLS.sentry,
]);

export function resolveDevToolsUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);

      if (!isLaravelDevToolsPathname(parsed.pathname)) {
        return resolveLocalServiceUrl(
          path,
          parsed.port ? Number(parsed.port) : 80,
        );
      }

      const base = apiBaseUrl().replace(/\/$/, '');

      return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return path;
    }
  }

  const pathname = path.startsWith('/') ? path : `/${path}`;
  const base = apiBaseUrl().replace(/\/$/, '');

  return `${base}${pathname}`;
}
