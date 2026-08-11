# minikb deployment

This directory contains the production bootstrap and rollback runbooks for the GHCR + ECS flow.

## Entry points

- [Bootstrap Ubuntu 22.04](./bootstrap-ubuntu-22.04.md)
- [Rollback](./rollback.md)

## Production contract

- Compose file: [`docker/docker-compose.prod.yml`](../docker/docker-compose.prod.yml)
- Environment template: [`.env.example`](../.env.example)
- Release workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml)

## Runtime layout

- Deployment root: `/opt/minikb`
- Server-side env file: `/opt/minikb/.env`
- Compose file on the host: `/opt/minikb/docker-compose.prod.yml`
- Persistent volumes:
  - `minikb_pgdata`
  - `minikb_redisdata`
  - `minikb_miniodata`
  - `minikb_prometheus_data` when the optional monitoring profile is used
