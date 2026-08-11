# ECS Ops Checklist

Use this when the server is already bootstrapped and you want the fastest path to confirm the stack is healthy.

## Where things live

- Deployment root: `/opt/minikb`
- Server env file: `/opt/minikb/.env`
- Compose file: `/opt/minikb/docker-compose.prod.yml`
- App health endpoint: `http://127.0.0.1:8080/health/live`

## Quick status checks

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml ps
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
```

## Logs

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml logs -f web
docker compose --env-file .env -f docker-compose.prod.yml logs -f worker
docker compose --env-file .env -f docker-compose.prod.yml logs -f postgres
```

## Restart the app layer

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml up -d --pull never web worker
```

## Refresh from GHCR

When a new image has been published by the release workflow:

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## Roll back

```bash
export MINIKB_IMAGE=ghcr.io/liuyidi/minikb:sha-<shortsha>
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

- Image source: GHCR-compatible tag `ghcr.io/liuyidi/minikb:latest`
- Fallback image on the host: the locally built image with the same tag until the first GHCR publish lands
