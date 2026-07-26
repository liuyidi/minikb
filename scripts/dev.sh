#!/usr/bin/env bash
# 一键起 minikb 本地开发环境
#
# 用法:
#   scripts/dev.sh up        # 起依赖 + web
#   scripts/dev.sh down      # 停一切
#   scripts/dev.sh services  # 只起 postgres/redis/minio
#   scripts/dev.sh web       # 只起 web(前台)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker/docker-compose.yml"

cmd=${1:-up}

case "$cmd" in
  up)
    $COMPOSE up -d
    echo "waiting for services..."
    sleep 3
    uv run uvicorn minikb.main:app --reload --port 8080
    ;;
  services)
    $COMPOSE up -d
    ;;
  web)
    uv run uvicorn minikb.main:app --reload --port 8080
    ;;
  down)
    $COMPOSE down
    ;;
  logs)
    $COMPOSE logs -f "${2:-}"
    ;;
  *)
    echo "usage: $0 {up|down|services|web|logs [svc]}"
    exit 1
    ;;
esac
