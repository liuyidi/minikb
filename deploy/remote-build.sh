#!/usr/bin/env bash
# Build and restart minikb on the Volcengine host (no GHCR pull).
set -euo pipefail

ROOT="${MINIKB_ROOT:-/opt/minikb}"
cd "$ROOT"

COMPOSE=(
  docker compose
  --project-name minikb
  --env-file "$ROOT/.env"
  -f "$ROOT/docker/docker-compose.prod.yml"
)

# Free RAM for Next/Python image builds on the 4G host.
"${COMPOSE[@]}" stop worker frontend || true

"${COMPOSE[@]}" build web frontend
"${COMPOSE[@]}" up -d --pull never --remove-orphans
"${COMPOSE[@]}" ps

ok=0
for i in $(seq 1 40); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${MINIKB_PORT:-8080}/health/live" >/tmp/minikb-health.json; then
    echo "api health ok after ${i} attempt(s): $(cat /tmp/minikb-health.json)"
    ok=1
    break
  fi
  echo "waiting for minikb api health (${i}/40)..."
  sleep 3
done
if [[ "$ok" -ne 1 ]]; then
  echo "minikb api health check failed; recent logs:"
  docker logs minikb-web --tail 120 || true
  exit 1
fi

web_ok=0
for i in $(seq 1 40); do
  if curl -fsS --max-time 3 "http://127.0.0.1:3000/api/health" >/tmp/minikb-web-health.json; then
    echo "frontend health ok after ${i} attempt(s): $(cat /tmp/minikb-web-health.json)"
    web_ok=1
    break
  fi
  echo "waiting for minikb frontend health (${i}/40)..."
  sleep 3
done
if [[ "$web_ok" -ne 1 ]]; then
  echo "minikb frontend health check failed; recent logs:"
  docker logs minikb-frontend --tail 120 || true
  exit 1
fi
