---
name: deploying-volcengine-minikb
description: >-
  Use when the user asks to 发布 minikb、kb.liuyidi.me、
  publish-volcengine-minikb, Volcengine minikb, or to ship minikb to
  火山引擎. Not for bot.liuyidi.me, mlf, auth, Aliyun compose up of
  minikb, or serverless-ship.
---

# minikb 发布（Volcengine）

应用已经拆开，**先选仓**。本 skill 只覆盖 kb **应用**；阿里云 nginx 反代属于 minibot 仓。

| 域名 | 仓 | 云 | Skill |
|------|----|----|-------|
| `liuyidi.me` / `bot.liuyidi.me` | minibot | 阿里云 ECS | minibot `aliyun-ecs-demo-deploy` |
| `kb.liuyidi.me` | minikb | 火山引擎 `/opt/minikb`（`101.96.224.232`） | **本文件** |
| `mlf.liuyidi.me` | mini-langfuse | 腾讯云 | mini-langfuse `deploying-tencent-mlf` |
| `auth.liuyidi.me` | mini-auth | 腾讯云 CVM | mini-auth `deploying-tencent-mini-auth` |
| `serverless-ship.liuyidi.me` | serverless-ship | Vercel | serverless-ship `deploying-vercel-serverless-ship` |

minikb **不在**阿里云 compose。公网 TLS 在阿里云 nginx：`upstream demo_kb { server 101.96.224.232:80; }`，模板 `deploy/nginx.kb.liuyidi.me.conf.example`。改反代去 minibot 仓；改应用走本仓 workflow。

## 发布（优先）

GitHub Actions → `Publish Volcengine Minikb`（`publish-volcengine-minikb.yml`）。

- push `main`（`src/` / Docker / compose 等路径）或 `workflow_dispatch`
- 镜像 `ghcr.io/liuyidi/minikb`，主机 `/opt/minikb`（compose `docker-compose.prod.yml`，env `/opt/minikb/.env`）
- 回滚：dispatch 填已有 `image_tag`，或机上手动 `MINIKB_IMAGE=ghcr.io/liuyidi/minikb:sha-<shortsha>` 后 `docker compose ... pull && up -d`

不要：`./up.sh kb`、在阿里云 compose 起 `demo-minikb`、把 minikb 塞回 minibot `deploy/`。

## 机上核对（少用）

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml ps
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
```

细节见 `deploy/ops-checklist.md`。

## 验收

```bash
curl -fsS https://kb.liuyidi.me/health
```
