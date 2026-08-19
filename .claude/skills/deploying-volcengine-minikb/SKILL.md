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

minikb **不在**阿里云 compose。DNS `kb.liuyidi.me` → `101.96.224.232`；TLS 在火山 nginx（模板 `deploy/nginx.kb.liuyidi.me.conf.example`）：`/v1` + `/health` → `127.0.0.1:8080`（FastAPI `web`），`/` → `127.0.0.1:3000`（Next `frontend`）。不要再改 minibot 仓里的阿里云 kb server。

生产 `.env` 必须有 `MINIKB_JWT_SECRET`（与 mini-auth `JWT_SECRET` 相同）和 `MINIKB_SESSION_SECRET`（≥32 字符）。不要设置 `MINIKB_AUTH_DISABLED`。不要设置 `MINIKB_IMAGE` / `MINIKB_WEB_IMAGE`（机上 build 出 `minikb:local` / `minikb-web:local`）。

密钥：`minikb/deploy/volcengine-minikb.pem`。远程操作默认 `required_permissions: ["all"]`。

## 何时用哪条路径

1. **改了 API / worker / Next / `@minikb/ui`** → 同步代码到 `/opt/minikb` + `deploy/remote-build.sh`（机上 `docker compose build`，**不要** `compose pull` GHCR）。
2. **只改 nginx/TLS** → 改主机 `/etc/nginx/sites-enabled/kb.liuyidi.me`，`nginx -t && reload`。
3. **日常 CI** → push `main` 触发 `Publish Volcengine Minikb`（rsync + 机上 build）。不要走 GHCR。

不要：`./up.sh kb`、在阿里云 compose 起 `demo-minikb`、把 minikb 塞回 minibot `deploy/`、在火山机 `docker compose pull` 应用镜像。

## SSH 更新（优先，同阿里云 ECS）

GitHub/GHCR 从火山访问很慢。代码用 rsync（或本机已有树），镜像在机上 build。

```bash
PEM=/Users/liuyidi/github/minikb/deploy/volcengine-minikb.pem
HOST=root@101.96.224.232
SRC=/Users/liuyidi/github/minikb

chmod 600 "$PEM"
rsync -az --delete \
  -e "ssh -i $PEM -o StrictHostKeyChecking=accept-new" \
  --exclude '.env' \
  --exclude '.git/' \
  --exclude '.git' \
  --exclude '.venv/' \
  --exclude '**/node_modules/' \
  --exclude '**/.next/' \
  --exclude '*.pem' \
  "$SRC/" "$HOST:/opt/minikb/"

ssh -i "$PEM" -o StrictHostKeyChecking=accept-new "$HOST" \
  'bash /opt/minikb/deploy/remote-build.sh'

ssh -i "$PEM" -o StrictHostKeyChecking=accept-new "$HOST" \
  'curl -fsS http://127.0.0.1:8080/health/live; echo; curl -fsS http://127.0.0.1:3000/api/health; echo'
```

## GitHub Actions

`Publish Volcengine Minikb`：checkout → rsync `/opt/minikb`（保留 `.env`）→ `remote-build.sh`。

不要再等 GHCR `docker compose pull`。

## 机上核对

```bash
cd /opt/minikb
docker compose --project-name minikb --env-file .env -f docker/docker-compose.prod.yml ps
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
curl --fail --silent --show-error https://kb.liuyidi.me/health
```

`MINIKB_PORT=8080`（loopback）。不要把 web 绑回宿主机 `:80`（nginx 占用 80/443）。

细节见 `deploy/ops-checklist.md`。

## 验收

```bash
curl -fsS https://kb.liuyidi.me/health
curl -fsS -o /dev/null -w "kb %{http_code}\n" https://kb.liuyidi.me/
```
