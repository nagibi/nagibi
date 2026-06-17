#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-/opt/nagibi/.env}"
DC=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

require_env() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
  if [ -z "$value" ]; then
    echo "::error::Defina ${key} em ${ENV_FILE}"
    exit 1
  fi
}

echo "==> Validar variáveis obrigatórias"
for key in MYSQL_ROOT_PASSWORD MYSQL_PASSWORD MYSQL_USER MYSQL_DATABASE DB_PASSWORD DB_USERNAME; do
  require_env "$key"
done

db_password="$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r')"
mysql_password="$(grep -E '^MYSQL_PASSWORD=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r')"
if [ "$db_password" != "$mysql_password" ]; then
  echo "::error::DB_PASSWORD e MYSQL_PASSWORD devem ser iguais em ${ENV_FILE}"
  exit 1
fi

echo "==> Sincronizar .env do Laravel"
cp "$ENV_FILE" "$ROOT_DIR/projects/ibigan-api/.env"
chmod 640 "$ROOT_DIR/projects/ibigan-api/.env"

echo "==> Permissões Laravel"
chown -R 1000:1000 "$ROOT_DIR/projects/ibigan-api"
chmod -R 775 "$ROOT_DIR/projects/ibigan-api/bootstrap/cache"
chmod -R 775 "$ROOT_DIR/projects/ibigan-api/storage"

echo "==> Composer (produção)"
"${DC[@]}" run --rm app composer install --no-dev --optimize-autoloader --no-interaction

echo "==> Containers"
if ! "${DC[@]}" up -d --build --force-recreate; then
  echo "==> Logs MySQL (últimas 80 linhas)"
  docker logs --tail 80 nagibi_mysql 2>&1 || true
  exit 1
fi

echo "==> Aguardando serviços..."
for _ in $(seq 1 30); do
  if "${DC[@]}" ps mysql | grep -q '(healthy)'; then
    break
  fi
  sleep 2
done

if ! "${DC[@]}" ps mysql | grep -q '(healthy)'; then
  echo "::error::nagibi_mysql não ficou healthy. Se o volume foi criado com senha/init inválidos, recrie apenas o volume do nagibi:"
  echo "docker rm -f nagibi_mysql && docker volume rm nagibi_mysql_data"
  docker logs --tail 80 nagibi_mysql 2>&1 || true
  exit 1
fi

echo "==> Garantir usuário MySQL"
"${DC[@]}" exec -T mysql sh -ec "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -e \"
CREATE USER IF NOT EXISTS '\$MYSQL_USER'@'%' IDENTIFIED BY '\$MYSQL_PASSWORD';
ALTER USER '\$MYSQL_USER'@'%' IDENTIFIED BY '\$MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON \\\`\$MYSQL_DATABASE\\\`.* TO '\$MYSQL_USER'@'%';
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES ON *.* TO '\$MYSQL_USER'@'%';
FLUSH PRIVILEGES;
\""

echo "==> Nginx (validar e recarregar config)"
"${DC[@]}" exec -T nginx nginx -t
"${DC[@]}" exec -T nginx nginx -s reload

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
