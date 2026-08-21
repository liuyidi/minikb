---
name: deploying-volcengine-minikb
description: >-
  Use when the user asks to 发布 minikb、kb.liuyidi.me、
  publish-volcengine-minikb, Volcengine minikb, or to ship minikb to
  火山引擎. Not for bot.liuyidi.me, mlf, auth, Aliyun compose up of
  minikb, or serverless-ship.
---

# minikb 发布（Volcengine）

应用已经拆开，**先选仓**。本 skill 覆盖 kb 应用与火山引擎本机 nginx/TLS 文档指针。阿里云不再反代 `kb.liuyidi.me`。

| 域名 | 仓 | 云 | Skill |
|------|----|----|-------|
| `liuyidi.me` / `bot.liuyidi.me` | minibot | 阿里云 ECS | minibot `aliyun-ecs-demo-deploy` |
| `kb.liuyidi.me` | minikb | 火山引擎 `/opt/minikb` | **本文件** |
| `mlf.liuyidi.me` | mini-langfuse | 腾讯云 | mini-langfuse `deploying-tencent-mlf` |
| `auth.liuyidi.me` | mini-auth | 腾讯云 CVM | mini-auth `deploying-tencent-mini-auth` |
| `serverless-ship.liuyidi.me` | serverless-ship | Vercel | serverless-ship `deploying-vercel-serverless-ship` |

## 硬性发布规则（必须遵守）

**所有部署必须：commit → `git push`（到 `main`）→ 由 GitHub Actions workflow 发布。**

- **允许**：commit / push；`gh run list` / `gh run watch`；验收公网 URL。
- **禁止**：本机 `ssh` / `rsync` / `scp` 同步代码或在机上跑 `remote-build.sh` 当发布路径；`docker compose pull` GHCR 应用镜像；绕过 workflow 的热修。
- **例外**：用户明确要求只读排障（日志 / nginx）且不是发版时，才可只读 SSH。代码上线仍走 push → workflow。

Workflow：`.github/workflows/publish-volcengine-minikb.yml`（`Publish Volcengine Minikb`）。

触发：

1. `git push origin main`（命中 `src/**`、`web/**`、`packages/ui/**`、`docker/**`、`deploy/remote-build.sh` 等）
2. 或：`gh workflow run "Publish Volcengine Minikb" --ref main`

生产 `.env` 在机上保留（workflow rsync 排除 `.env`）。不要设置 `MINIKB_AUTH_DISABLED`；不要设置 `MINIKB_IMAGE` / `MINIKB_WEB_IMAGE`。

## Agent 发布步骤

```bash
git status -sb
git push -u origin HEAD

gh workflow run "Publish Volcengine Minikb" --ref main   # 若 push 未自动触发
gh run list --workflow "Publish Volcengine Minikb" --limit 3
gh run watch
```

## 验收

```bash
curl -fsS https://kb.liuyidi.me/health
curl -fsS -o /dev/null -w "kb %{http_code}\n" https://kb.liuyidi.me/
```

细节见 `deploy/ops-checklist.md`。

## 约定

1. 不要：`./up.sh kb`、在阿里云 compose 起 minikb、把 minikb 塞回 minibot `deploy/`。
2. 不要把 pem / 生产 `.env` 写入 commit。
3. 只改主机 nginx/TLS、且用户明确要求排障时，才可改 `/etc/nginx/...`；应用代码仍走 workflow。
