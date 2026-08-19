# ECS Ops Checklist

Use this when the server is already bootstrapped and you want the fastest path to confirm the stack is healthy.

## Where things live

- Deployment root: `/opt/minikb` (app source + compose)
- Server env file: `/opt/minikb/.env` (not overwritten by rsync)
- Compose file: `/opt/minikb/docker/docker-compose.prod.yml`
- Build/restart: `/opt/minikb/deploy/remote-build.sh`
- API (compose `web`): `http://127.0.0.1:8080/health/live`
- Next (compose `frontend`): `http://127.0.0.1:3000/api/health`
- Public TLS: host nginx `kb.liuyidi.me` → `/v1` and `/health` to `:8080`, `/` to `:3000`

## Quick status checks

```bash
cd /opt/minikb
docker compose --project-name minikb --env-file .env -f docker/docker-compose.prod.yml ps
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
curl --fail --silent --show-error https://kb.liuyidi.me/health
systemctl is-active nginx
```

## Logs

```bash
cd /opt/minikb
docker compose --project-name minikb --env-file .env -f docker/docker-compose.prod.yml logs -f web
docker compose --project-name minikb --env-file .env -f docker/docker-compose.prod.yml logs -f frontend
docker compose --project-name minikb --env-file .env -f docker/docker-compose.prod.yml logs -f worker
```

## Restart without rebuild

```bash
cd /opt/minikb
docker compose --project-name minikb --env-file .env -f docker/docker-compose.prod.yml up -d --pull never --no-build
```

## Refresh (on-host build)

Do **not** `docker compose pull` for `web` / `frontend` / `worker`. Build locally:

```bash
bash /opt/minikb/deploy/remote-build.sh
```

## Roll back

Rsync or check out a known-good tree into `/opt/minikb` (keep `.env`), then `remote-build.sh`.

## If the host is out of memory

The host is ~4G. `remote-build.sh` stops `worker`/`frontend` during image build. If a build still OOMs:

- lower `MINIKB_INGEST_CONCURRENCY`
- lower `MINIKB_WEB_WORKERS`
- do not add extra compose services while building

## Current deployment mode

- API/worker image: `minikb:local` (built from `docker/Dockerfile.ecs`)
- Frontend image: `minikb-web:local` (built from `docker/Dockerfile.web`)
