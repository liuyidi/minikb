# minikb GHCR + ECS Auto Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a GHCR-backed release flow where `push main` builds and deploys `minikb` to the Ubuntu 22.04 ECS, then sends a Feishu notification on completion.

**Architecture:** Keep CI and release concerns separate. The existing CI workflow continues to run checks; a new release workflow builds an `linux/amd64` image, pushes it to GHCR with both immutable and floating tags, then SSHes into the ECS and runs `docker compose pull && docker compose up -d`. The ECS keeps the full runtime stack local, and rollback is done by pointing the compose image tag at a prior commit.

**Tech Stack:** GitHub Actions, GHCR, Docker, Docker Compose, Ubuntu 22.04, SSH, Feishu incoming webhook, existing Python/FastAPI backend.

## Global Constraints

- Target host OS is Ubuntu 22.04 64-bit.
- Image registry is GHCR, not Volcengine TCR.
- Deployment target is a single ECS instance.
- Release trigger is `push main`.
- Runtime architecture is `linux/amd64`.
- The ECS continues to host `postgres`, `redis`, `minio`, `web`, and `worker` in one compose project.
- Rollback must work without rebuilding or republishing the image.
- The deployment must start from a fresh machine with no preinstalled Docker stack.
- Deployment completion must send a Feishu notification.

---

## Task 1: Convert the production compose file to a GHCR image contract

**Files:**
- Modify: `docker/docker-compose.prod.yml`
- Create: `.env.example`

**Interfaces:**
- Consumes: `MINIKB_IMAGE`, `MINIKB_POSTGRES_*`, `MINIKB_REDIS_*`, `MINIKB_S3_*`, `MINIKB_OPENAI_*`, `MINIKB_WEB_WORKERS`, `MINIKB_INGEST_CONCURRENCY`
- Produces: `migrate`, `web`, and `worker` all run from the same GHCR image tag instead of local `build:` context

- [ ] **Step 1: Replace the production `build:` sections with a shared image reference**

Use a single image variable for every app container:

```yaml
x-minikb-image: &minikb_image ${MINIKB_IMAGE:?set MINIKB_IMAGE}
```

Point these services at that image:

```yaml
migrate:
  image: *minikb_image
web:
  image: *minikb_image
worker:
  image: *minikb_image
```

- [ ] **Step 2: Keep infrastructure services unchanged**

Leave `postgres`, `redis`, and `minio` as the host-local stack inside the same compose project.

- [ ] **Step 3: Add a root `.env.example` that matches the compose contract**

Include a default image tag such as:

```bash
MINIKB_IMAGE=ghcr.io/<owner>/minikb:latest
```

Keep the rest of the existing runtime settings mirrored from `docker/docker-compose.prod.yml` so a fresh host can start from one obvious template.

- [ ] **Step 4: Validate the compose file renders cleanly**

Run:

```bash
docker compose -f docker/docker-compose.prod.yml config
```

Expected: the config renders without any `build:` entries for the application services and without unresolved variables.

---

## Task 2: Add the GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: GitHub `workflow_run` payload from `CI`, optional `workflow_dispatch` inputs, `GHCR_READ_TOKEN`, `GHCR_USERNAME`, `ECS_HOST`, `ECS_USER`, `ECS_SSH_KEY`, `FEISHU_WEBHOOK_URL`
- Produces: GHCR image tags `latest` and `sha-<shortsha>`, remote ECS deploy, Feishu success/failure notification

- [ ] **Step 1: Wire the workflow trigger and permissions**

Trigger on:

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    branches: [main]
    types: [completed]
  workflow_dispatch:
    inputs:
      image_tag:
        description: Deploy this existing image tag
        required: false
        default: latest
```

Set `packages: write` so the workflow can publish GHCR images.

- [ ] **Step 2: Build and push the release image**

Use the same commit SHA that passed CI, build for `linux/amd64`, and push both tags:

```text
ghcr.io/<owner>/minikb:latest
ghcr.io/<owner>/minikb:sha-<shortsha>
```

Prefer `docker/build-push-action` so the image build is reproducible and cacheable.

- [ ] **Step 3: SSH into the ECS and redeploy**

Have the workflow log in to GHCR on the server and then run:

```bash
docker compose pull
docker compose up -d
```

Then verify the app health endpoint from the host or through the SSH session.

- [ ] **Step 4: Send the Feishu notification**

Send a webhook message after the deploy step using `if: always()` so both success and failure can be reported.

Include these fields in the payload:

```text
repository
branch
commit SHA
image tag
target host
result status
```

- [ ] **Step 5: Add rollback-by-tag support**

Use `workflow_dispatch` to redeploy a previously published tag such as `sha-<shortsha>` without rebuilding the image.

- [ ] **Step 6: Validate the workflow syntax**

Run:

```bash
actionlint .github/workflows/release.yml
```

Expected: the workflow passes syntax validation before any live deploy is attempted.

---

## Task 3: Write the Ubuntu 22.04 bootstrap and rollback runbook

**Files:**
- Modify: `deploy/README.md`
- Create: `deploy/bootstrap-ubuntu-22.04.md`
- Create: `deploy/rollback.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the GHCR image contract from Task 1, the release workflow from Task 2, the ECS SSH deploy key, GHCR read credentials, Feishu webhook secret
- Produces: a one-time host bootstrap guide, a rollback runbook, and a root README that points to the production flow

- [ ] **Step 1: Document first-boot machine setup in `deploy/bootstrap-ubuntu-22.04.md`**

Cover these commands in order:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
```

Then document Docker Engine, Docker Compose plugin, SSH hardening, and a `/opt/minikb` deployment directory.

- [ ] **Step 2: Write the host-level runtime checklist**

The runbook must say where the server-side `.env` file lives, how GHCR pull auth is configured, and how the persistent Docker volumes are created for:

```text
postgres
redis
minio
```

- [ ] **Step 3: Add the 4c4g resource budget**

Document the recommended baseline split:

```text
Postgres: 1.0G
Redis: 128M-256M
MinIO: 256M-384M
Web/API: 512M-768M
Worker: 768M-1.0G
Host OS + Docker: reserve 512M
```

Explain that the first tuning knob is worker concurrency.

- [ ] **Step 4: Write a rollback runbook in `deploy/rollback.md`**

Spell out the exact rollback path:

```bash
export MINIKB_IMAGE=ghcr.io/<owner>/minikb:sha-<shortsha>
docker compose pull
docker compose up -d
```

Make it clear that rollback does not rebuild the image.

- [ ] **Step 5: Update the root README to point to the new release flow**

Replace the old local-first deployment assumptions with:

```text
push main -> GitHub Actions -> GHCR -> ECS docker compose pull/up -> Feishu notification
```

Also fix the existing `.env.example` reference so it matches the new file added in Task 1.

---

## Task 4: Rehearse the whole release path before calling it done

**Files:**
- Test: `.github/workflows/release.yml`
- Test: `docker/docker-compose.prod.yml`
- Test: `deploy/bootstrap-ubuntu-22.04.md`
- Test: `deploy/rollback.md`
- Test: `README.md`

**Interfaces:**
- Consumes: everything produced by Tasks 1-3
- Produces: a verified deploy path that can be used on the live ECS

- [ ] **Step 1: Validate the compose render again after all edits**

Run:

```bash
docker compose -f docker/docker-compose.prod.yml config
```

- [ ] **Step 2: Run the project test suite to ensure deploy docs did not break app code**

Run:

```bash
uv run pytest -q
```

- [ ] **Step 3: Review the release workflow against the deployment checklist**

Confirm the workflow has:

```text
CI trigger
build/push
SSH deploy
health check
Feishu notification
manual rollback path
```

- [ ] **Step 4: Perform a live first-deploy rehearsal on the fresh ECS**

Use the documented bootstrap steps, then do one initial `workflow_dispatch` deploy with `image_tag=latest`.

If that succeeds, immediately rehearse one rollback by dispatching a known-good `sha-<shortsha>` tag.

---

## Completion Criteria

- The repository has a GHCR-based release workflow.
- The production compose file no longer depends on local builds for the app services.
- The new Ubuntu 22.04 ECS can be bootstrapped from the docs alone.
- Rollback is a tag switch, not a rebuild.
- A successful deploy sends a Feishu notification with commit and host details.
