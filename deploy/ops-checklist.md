# ECS Ops Checklist

Use this when the server is already bootstrapped and you want the fastest path to confirm the stack is healthy.

## Where things live

- Deployment root: `/opt/minikb`
- Server env file: `/opt/minikb/.env`
- Compose file: `/opt/minikb/docker-compose.prod.yml`
- API (compose `web`): `http://127.0.0.1:8080/health/live`
- Next (compose `frontend`): `http://127.0.0.1:3000/api/health`
- Public TLS: host nginx `kb.liuyidi.me` → `/v1` and `/health` to `:8080`, `/` to `:3000`

Until frontend is healthy, nginx may still point `/` at `:8080/ui` (dual-run).

## Quick status checks

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml ps
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
curl --fail --silent --show-error https://kb.liuyidi.me/health
systemctl is-active nginx
```

## Logs

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml logs -f web
docker compose --env-file .env -f docker-compose.prod.yml logs -f frontend
docker compose --env-file .env -f docker-compose.prod.yml logs -f worker
docker compose --env-file .env -f docker-compose.prod.yml logs -f postgres
```

## Restart the app layer

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml up -d --pull never web frontend worker
```

## Refresh from GHCR

When a new image has been published by the release workflow:

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## Roll back

Set **both** image tags to a known-good `sha-<shortsha>`:

```bash
export MINIKB_IMAGE=ghcr.io/liuyidi/minikb:sha-<shortsha>
export MINIKB_WEB_IMAGE=ghcr.io/liuyidi/minikb-web:sha-<shortsha>
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## If the host is out of memory

First reduce worker pressure before touching the database or MinIO:

- lower `MINIKB_INGEST_CONCURRENCY`
- lower `MINIKB_WEB_WORKERS`
- keep Postgres and MinIO unchanged unless there is a proven leak

## Current deployment mode

- API image: `ghcr.io/liuyidi/minikb:latest` (`MINIKB_IMAGE`)
- Frontend image: `ghcr.io/liuyidi/minikb-web:latest` (`MINIKB_WEB_IMAGE`)
