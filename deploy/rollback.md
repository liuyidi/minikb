# Rollback

Rollback rebuilds a previous source tree on the host. It does not pull GHCR.

## 1. Put a known-good tree on the host

Keep `/opt/minikb/.env`. Replace the rest of `/opt/minikb` with the commit you want (rsync from a checkout, or restore files). Do not `docker compose pull` app images.

## 2. Rebuild and restart

```bash
ssh -i deploy/volcengine-minikb.pem root@101.96.224.232 \
  'bash /opt/minikb/deploy/remote-build.sh'
```

## 3. Verify service health

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

## Notes

- Project name is pinned to `minikb` so volumes (`minikb_minikb_pgdata`, …) stay attached.
- nginx config is independent of the app images.
