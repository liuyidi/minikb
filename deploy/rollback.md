# Rollback

Rollback re-points the ECS to already published GHCR images. It does not rebuild anything.

## 1. Pick known-good image tags

Prefer immutable tags for **both** images:

```bash
sha-<shortsha>
```

API and frontend tags can differ if only one side needs rollback.

## 2. Update the host env

Edit `/opt/minikb/.env` and set:

```bash
MINIKB_IMAGE=ghcr.io/liuyidi/minikb:sha-<shortsha>
MINIKB_WEB_IMAGE=ghcr.io/liuyidi/minikb-web:sha-<shortsha>
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
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

## Notes

- The rollback path reuses the same compose project.
- No image build or republish is needed.
- The `latest` tag can be used for forward redeploys, but rollback should prefer `sha-<shortsha>`.
- nginx config is independent: you can keep `/` on Next while rolling back only the API image (or vice versa).
