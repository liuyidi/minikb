# minikb deployment

Production bootstrap and rollback for the **Volcengine** GHCR + compose flow.
Public URL `https://kb.liuyidi.me` terminates TLS on **this host** (nginx :443 →
`127.0.0.1:8080`). DNS A record points at `101.96.224.232`; Aliyun is not in the path.

## Entry points

- [Bootstrap Ubuntu 22.04](./bootstrap-ubuntu-22.04.md)
- [Rollback](./rollback.md)
- [Ops checklist](./ops-checklist.md)
- [Host nginx TLS (`kb.liuyidi.me`)](./nginx.kb.liuyidi.me.conf.example)

## Production contract

- Compose file: [`docker/docker-compose.prod.yml`](../docker/docker-compose.prod.yml)
- Environment template: [`.env.example`](../.env.example)
- Publish workflow: [`.github/workflows/publish-volcengine-minikb.yml`](../.github/workflows/publish-volcengine-minikb.yml)
- Manual redeploy / rollback tag: [`.github/workflows/release.yml`](../.github/workflows/release.yml) (`workflow_dispatch` only)

## Runtime layout (Volcengine)

- Deployment root: `/opt/minikb`
- Server-side env file: `/opt/minikb/.env`
- Compose file on the host: `/opt/minikb/docker-compose.prod.yml`
- Host nginx: `/etc/nginx/sites-enabled/kb.liuyidi.me` (TLS; app on `127.0.0.1:8080`)
- Persistent volumes: `minikb_pgdata`, `minikb_redisdata`, `minikb_miniodata`, …

## Do not

- Do not run minikb inside `mini-langfuse/deploy/demo` on Aliyun anymore.
- Do not use `./up.sh kb` on the demo ECS; that path was removed.
