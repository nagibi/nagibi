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

if [[ ! -f "$LARAVEL_ENV" ]]; then
  echo "ERRO: $LARAVEL_ENV não encontrado (não use symlink para a raiz)" >&2
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

# ... resto do script (nginx, SPA, composer, etc.) — SEM esta linha:
# cp "$ENV_FILE" "$ROOT_DIR/projects/ibigan-api/.env"