# Rollback

Rollback re-points the ECS to an already published GHCR image. It does not rebuild anything.

## 1. Pick a known-good image tag

Prefer an immutable tag:

```bash
sha-<shortsha>
```

## 2. Update the host env

Edit `/opt/minikb/.env` and set:

```bash
MINIKB_IMAGE=ghcr.io/<owner>/minikb:sha-<shortsha>
```

## 3. Pull and restart

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## 4. Verify service health

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
```

## Notes

- The rollback path reuses the same compose project.
- No image build or republish is needed.
- The `latest` tag can be used for forward redeploys, but rollback should prefer `sha-<shortsha>`.
