#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-/opt/nagibi/.env}"
LARAVEL_ENV="$ROOT_DIR/projects/ibigan-api/.env"
DC=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")
STACK_NAME="${STACK_NAME:-nagibi}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

require_env() {
  local file="$1"
  local key="$2"
  local value
  value="$(grep -E "^${key}=" "$file" | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "$value" ]]; then
    echo "ERRO: defina ${key} em ${file}" >&2
    exit 1
  fi
}

echo "==> Validar .env raiz (Docker)"
for key in MYSQL_ROOT_PASSWORD MYSQL_PASSWORD MYSQL_USER MYSQL_DATABASE CENTRAL_DOMAIN; do
  require_env "$ENV_FILE" "$key"
done

echo "==> Copiar .env raiz para Laravel (volume Docker não inclui symlink fora de /var/www)"
cp "$ENV_FILE" "$LARAVEL_ENV"

echo "==> Validar .env Laravel"
for key in APP_KEY DB_PASSWORD DB_USERNAME DB_DATABASE; do
  require_env "$LARAVEL_ENV" "$key"
done

db_password="$(grep -E '^DB_PASSWORD=' "$LARAVEL_ENV" | tail -n1 | cut -d= -f2- | tr -d '\r')"
mysql_password="$(grep -E '^MYSQL_PASSWORD=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r')"
if [[ "$db_password" != "$mysql_password" ]]; then
  echo "ERRO: DB_PASSWORD ($LARAVEL_ENV) deve ser igual a MYSQL_PASSWORD ($ENV_FILE)" >&2
  exit 1
fi

db_username="$(grep -E '^DB_USERNAME=' "$LARAVEL_ENV" | tail -n1 | cut -d= -f2- | tr -d '\r')"
mysql_user="$(grep -E '^MYSQL_USER=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r')"
if [[ "$db_username" != "$mysql_user" ]]; then
  echo "ERRO: DB_USERNAME ($LARAVEL_ENV) deve ser igual a MYSQL_USER ($ENV_FILE)" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

CENTRAL_DOMAIN="${CENTRAL_DOMAIN#https://}"
CENTRAL_DOMAIN="${CENTRAL_DOMAIN#http://}"
CENTRAL_DOMAIN="${CENTRAL_DOMAIN%%/*}"

if [[ -z "$CENTRAL_DOMAIN" ]]; then
  echo "ERRO: defina CENTRAL_DOMAIN em $ENV_FILE" >&2
  exit 1
fi

if ! command -v envsubst >/dev/null 2>&1; then
  echo "Instale gettext-base no servidor (provê envsubst): apt install -y gettext-base" >&2
  exit 1
fi

USE_BEHIND_PROXY=false
if [[ "${NGINX_BEHIND_PROXY:-false}" == "true" || "${NGINX_BEHIND_PROXY:-}" == "1" ]]; then
  USE_BEHIND_PROXY=true
elif [[ "${NGINX_HTTP_BIND:-127.0.0.1}" == "127.0.0.1" ]]; then
  echo "==> NGINX_HTTP_BIND=127.0.0.1 — assumindo Caddy no host (HTTP interno)"
  USE_BEHIND_PROXY=true
fi

if [[ "$USE_BEHIND_PROXY" == "true" ]]; then
  echo "==> Nginx production.conf (behind Caddy, HTTP only)"
  cp "$ROOT_DIR/docker/nginx/conf.d/production.behind-proxy.conf.template" \
    "$ROOT_DIR/docker/nginx/conf.d/production.conf"
else
  echo "==> Nginx production.conf (${CENTRAL_DOMAIN}, TLS no nginx)"
  export CENTRAL_DOMAIN
  envsubst '${CENTRAL_DOMAIN}' \
    < "$ROOT_DIR/docker/nginx/conf.d/production.conf.template" \
    > "$ROOT_DIR/docker/nginx/conf.d/production.conf"
fi

echo "==> Frontend (SPA)"
SPA_DIST="$ROOT_DIR/projects/ibigan-web/dist"
SPA_INDEX="$SPA_DIST/index.html"
if [[ ! -f "$SPA_INDEX" ]]; then
  echo "ERRO: $SPA_INDEX não existe. Rode o build do frontend antes do deploy:" >&2
  echo "  cd projects/ibigan-web && npm ci --force && npm run build" >&2
  exit 1
fi
chmod -R a+rX "$SPA_DIST"

if ! grep -q 'ibigan-web/dist:/var/www/spa' "$ROOT_DIR/docker-compose.prod.yml"; then
  echo "ERRO: docker-compose.prod.yml sem volume ./projects/ibigan-web/dist:/var/www/spa" >&2
  exit 1
fi

echo "==> Permissões Laravel"
chown -R 1000:1000 "$ROOT_DIR/projects/ibigan-api"
chmod -R 775 "$ROOT_DIR/projects/ibigan-api/bootstrap/cache"
chmod -R 775 "$ROOT_DIR/projects/ibigan-api/storage"

echo "==> Composer (produção)"
"${DC[@]}" run --rm app composer install --no-dev --optimize-autoloader --no-interaction

echo "==> Containers"
"${DC[@]}" up -d --build --remove-orphans

echo "==> Nginx (recriar — monta SPA + production.conf)"
"${DC[@]}" up -d --force-recreate nginx

echo "==> Aguardando MySQL..."
for _ in $(seq 1 30); do
  if "${DC[@]}" exec -T mysql mysqladmin ping -h localhost -u root -p"${MYSQL_ROOT_PASSWORD}" --silent 2>/dev/null; then
    break
  fi
  sleep 2
done

NGINX_TEST_BIND="${NGINX_HTTP_BIND:-127.0.0.1}"
NGINX_TEST_PORT="${NGINX_HTTP_PORT:-28080}"

echo "==> Nginx (validar config)"
"${DC[@]}" exec -T nginx nginx -t

echo "==> Smoke test nginx (http://${NGINX_TEST_BIND}:${NGINX_TEST_PORT})"
if ! "${DC[@]}" exec -T nginx test -f /var/www/spa/index.html; then
  echo "ERRO: /var/www/spa/index.html não existe no container nginx." >&2
  docker inspect "$("${DC[@]}" ps -q nginx)" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' >&2 || true
  exit 1
fi
if ! curl -sf -o /dev/null -H "Host: ${CENTRAL_DOMAIN}" "http://${NGINX_TEST_BIND}:${NGINX_TEST_PORT}/"; then
  echo "ERRO: nginx não responde em http://${NGINX_TEST_BIND}:${NGINX_TEST_PORT}/" >&2
  "${DC[@]}" logs --tail 30 nginx || true
  exit 1
fi

if [[ "$USE_BEHIND_PROXY" == "true" ]]; then
  echo "==> Lembrete Caddy (/etc/caddy/Caddyfile):"
  echo "    ${CENTRAL_DOMAIN} { reverse_proxy http://127.0.0.1:${NGINX_TEST_PORT} { header_up Host {host}; header_up X-Forwarded-Proto https } }"
  echo "    Depois: systemctl reload caddy"
fi

echo "==> Migrations e caches Laravel"
"${DC[@]}" exec -T app php artisan optimize:clear
"${DC[@]}" exec -T app php artisan migrate --force
"${DC[@]}" exec -T app php artisan tenants:migrate --force
"${DC[@]}" exec -T app php artisan storage:link --force || true
"${DC[@]}" exec -T app php artisan config:cache
"${DC[@]}" exec -T app php artisan route:cache
"${DC[@]}" exec -T app php artisan view:cache

echo "==> Horizon, Scheduler e Reverb"
"${DC[@]}" exec -T app php artisan horizon:terminate || true
"${DC[@]}" restart horizon scheduler reverb

echo "Deploy concluído com sucesso."
