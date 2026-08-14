# minikb deployment

Production bootstrap and rollback for the **Volcengine** GHCR + compose flow.
Public URL `https://kb.liuyidi.me` terminates TLS on **Aliyun** nginx and proxies
to this host (`:8080`), same idea as `auth.liuyidi.me` → Tencent.

## Entry points

- [Bootstrap Ubuntu 22.04](./bootstrap-ubuntu-22.04.md)
- [Rollback](./rollback.md)
- [Ops checklist](./ops-checklist.md)
- [Aliyun nginx → Volcengine](./nginx.kb.liuyidi.me.conf.example)

## Production contract

- Compose file: [`docker/docker-compose.prod.yml`](../docker/docker-compose.prod.yml)
- Environment template: [`.env.example`](../.env.example)
- Publish workflow: [`.github/workflows/publish-volcengine-minikb.yml`](../.github/workflows/publish-volcengine-minikb.yml)
- Manual redeploy / rollback tag: [`.github/workflows/release.yml`](../.github/workflows/release.yml) (`workflow_dispatch` only)

## Runtime layout (Volcengine)

- Deployment root: `/opt/minikb`
- Server-side env file: `/opt/minikb/.env`
- Compose file on the host: `/opt/minikb/docker-compose.prod.yml`
- Persistent volumes: `minikb_pgdata`, `minikb_redisdata`, `minikb_miniodata`, …

## Do not

- Do not run minikb inside `mini-langfuse/deploy/demo` on Aliyun anymore.
- Do not use `./up.sh kb` on the demo ECS; that path was removed.
