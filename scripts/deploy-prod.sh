#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-/opt/nagibi/.env}"
DC=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

echo "==> Sincronizar .env do Laravel"
ln -sfn "$ENV_FILE" "$ROOT_DIR/projects/ibigan-api/.env"

echo "==> Permissões Laravel"
chown -R 1000:1000 "$ROOT_DIR/projects/ibigan-api"
chmod -R 775 "$ROOT_DIR/projects/ibigan-api/bootstrap/cache"
chmod -R 775 "$ROOT_DIR/projects/ibigan-api/storage"

echo "==> Composer (produção)"
"${DC[@]}" run --rm app composer install --no-dev --optimize-autoloader --no-interaction

echo "==> Remover containers legados (ibigan_*)"
for container in ibigan_app ibigan_nginx ibigan_mysql ibigan_redis ibigan_horizon ibigan_scheduler ibigan_reverb; do
  docker rm -f "$container" 2>/dev/null || true
done

echo "==> Containers"
"${DC[@]}" up -d --build --force-recreate

echo "==> Aguardando serviços..."
sleep 15

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
"${DC[@]}" exec -T app php artisan migrate --force
"${DC[@]}" exec -T app php artisan tenants:migrate --force
"${DC[@]}" exec -T app php artisan storage:link --force || true
"${DC[@]}" exec -T app php artisan optimize:clear
"${DC[@]}" exec -T app php artisan config:cache
"${DC[@]}" exec -T app php artisan route:cache
"${DC[@]}" exec -T app php artisan view:cache

echo "==> Horizon, Scheduler e Reverb"
"${DC[@]}" exec -T app php artisan horizon:terminate || true
"${DC[@]}" restart horizon scheduler reverb

echo "Deploy concluído com sucesso."
