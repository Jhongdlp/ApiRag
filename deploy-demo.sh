#!/usr/bin/env bash
# Deploy de demo: expone la app (Next.js :3002 -> FastAPI :8000) a internet por un tunel HTTPS gratis.
# Uso:  ./deploy-demo.sh
# Requisitos: el stack docker (fastapi/ollama/redis/celery) ya levantado.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT="$ROOT/frontend"
CF="$HOME/.local/bin/cloudflared"

echo "==> 1/4 Verificando backend (FastAPI :8000)..."
curl -sf -o /dev/null http://localhost:8000/api/v1/health \
  || { echo "FastAPI no responde. Levanta el stack:  sg docker -c 'docker compose up -d'"; exit 1; }

echo "==> 2/4 Build + arranque de Next.js (:3002)..."
cd "$FRONT"
if ! curl -sf -o /dev/null http://localhost:3002; then
  npm run build
  setsid nohup npm run start > /tmp/next-prod.log 2>&1 &
  for i in $(seq 1 20); do curl -sf -o /dev/null http://localhost:3002 && break; sleep 1; done
fi
echo "    Next.js OK"

echo "==> 3/4 Abriendo tunel cloudflared..."
setsid nohup "$CF" tunnel --url http://localhost:3002 > /tmp/cf-tunnel.log 2>&1 &
URL=""
for i in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1) || true
  [ -n "$URL" ] && break; sleep 1
done

echo "==> 4/4 Verificando URL publica..."
for i in $(seq 1 10); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/v1/health")" = "200" ] && break; sleep 3
done

echo
echo "============================================================"
echo "  APP EN INTERNET:  $URL"
echo "  Chat:   $URL/"
echo "  Admin:  $URL/login"
echo "============================================================"
echo "Logs:  tail -f /tmp/next-prod.log   |   tail -f /tmp/cf-tunnel.log"
echo "Parar: pkill -f 'next start'; pkill -f 'cloudflared tunnel'"
