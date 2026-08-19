---
name: deploying-volcengine-minikb
description: >-
  Use when the user asks to 发布 minikb、kb.liuyidi.me、
  publish-volcengine-minikb, Volcengine minikb, or to ship minikb to
  火山引擎. Not for bot.liuyidi.me, mlf, auth, Aliyun compose up of
  minikb, or serverless-ship.
---

# minikb 发布（Volcengine）

应用已经拆开，**先选仓**。本 skill 覆盖 kb 应用 **和** 火山引擎本机 nginx/TLS。阿里云不再反代 `kb.liuyidi.me`。

| 域名 | 仓 | 云 | Skill |
|------|----|----|-------|
| `liuyidi.me` / `bot.liuyidi.me` | minibot | 阿里云 ECS | minibot `aliyun-ecs-demo-deploy` |
| `kb.liuyidi.me` | minikb | 火山引擎 `/opt/minikb`（`101.96.224.232`） | **本文件** |
| `mlf.liuyidi.me` | mini-langfuse | 腾讯云 | mini-langfuse `deploying-tencent-mlf` |
| `auth.liuyidi.me` | mini-auth | 腾讯云 CVM | mini-auth `deploying-tencent-mini-auth` |
| `serverless-ship.liuyidi.me` | serverless-ship | Vercel | serverless-ship `deploying-vercel-serverless-ship` |

minikb **不在**阿里云 compose。DNS `kb.liuyidi.me` → `101.96.224.232`；TLS 在火山 nginx（模板 `deploy/nginx.kb.liuyidi.me.conf.example`）：`/v1` + `/health` → `127.0.0.1:8080`（FastAPI `web`），`/` → `127.0.0.1:3000`（Next `frontend`）。改应用走本仓 workflow；不要再改 minibot 仓里的阿里云 kb server。

生产 `.env` 必须有 `MINIKB_JWT_SECRET`（与 mini-auth `JWT_SECRET` 相同）和 `MINIKB_SESSION_SECRET`（≥32 字符）。不要设置 `MINIKB_AUTH_DISABLED`。

## 发布（优先）

GitHub Actions → `Publish Volcengine Minikb`（`publish-volcengine-minikb.yml`）。

- push `main`（`src/` / `web/` / Docker / compose 等路径）或 `workflow_dispatch`
- 镜像 `ghcr.io/liuyidi/minikb`（API/worker）和 `ghcr.io/liuyidi/minikb-web`（Next），主机 `/opt/minikb`
- 回滚：dispatch 填已有 `image_tag`，或机上手动同时改 `MINIKB_IMAGE` 与 `MINIKB_WEB_IMAGE` 为 `sha-<shortsha>` 后 `docker compose ... pull && up -d`

不要：`./up.sh kb`、在阿里云 compose 起 `demo-minikb`、把 minikb 塞回 minibot `deploy/`。

## 机上核对（少用）

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml ps
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
curl --fail --silent --show-error https://kb.liuyidi.me/health
docker compose --env-file .env -f docker-compose.prod.yml logs -f frontend
```

`MINIKB_PORT=8080`（loopback）。不要把 web 绑回宿主机 `:80`（nginx 占用 80/443）。

细节见 `deploy/ops-checklist.md`。

## 验收

```bash
curl -fsS https://kb.liuyidi.me/health
```
