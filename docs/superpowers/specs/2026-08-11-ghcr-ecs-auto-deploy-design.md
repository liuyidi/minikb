# minikb GHCR + ECS Auto Deploy Design

> Spec for automated build-and-deploy of `minikb` from GitHub to a new Ubuntu 22.04 ECS using GHCR and `docker compose`.

**Goal:** `push main` should build, test, publish, and deploy `minikb` automatically to the Ubuntu 22.04 ECS with a simple rollback path.

**Architecture:** GitHub Actions is the release orchestrator. It runs repo checks, builds an `linux/amd64` image, pushes it to GHCR with immutable and floating tags, then SSHes into the ECS and runs `docker compose pull && docker compose up -d`. The ECS runs the full stack in one compose project: Postgres, Redis, MinIO, API web, and worker.

**Tech Stack:** GitHub Actions, GHCR, Docker, Docker Compose, Ubuntu 22.04, SSH, `minikb` existing Python/FastAPI services.

## Global Constraints

- Target host OS is Ubuntu 22.04 64-bit.
- Image registry is GHCR, not Volcengine TCR.
- Deployment target is a single ECS instance, not a multi-node cluster.
- Release trigger is `push main`.
- Runtime is `linux/amd64`.
- The ECS continues to host `postgres`, `redis`, `minio`, `web`, and `worker` in one compose project.
- Rollback must be possible without rebuilding the image.
- The initial setup must be operable on a brand-new machine.

---

## Current State

- The repository already contains:
  - `docker/docker-compose.prod.yml`
  - `docker/Dockerfile`
  - `.github/workflows/ci.yml`
  - deployment notes in `deploy/README.md`
- The production compose file already splits the runtime into:
  - `postgres`
  - `redis`
  - `minio`
  - `web`
  - `worker`
- The current CI workflow only validates code quality and tests. It does not publish images or deploy to a server.

## Goals

1. Build and publish container images on every successful `push main`.
2. Use GHCR as the image source of truth for ECS deployment.
3. Keep the ECS deployment flow simple enough to operate manually if needed.
4. Make rollback a tag change, not a rebuild.
5. Keep the first production setup feasible on a single 4c4g Ubuntu 22.04 machine.

## Non-Goals

- No staging environment in this phase.
- No Kubernetes, systemd unit orchestration, or image replication across multiple hosts.
- No switching to TCR.
- No redesign of the frontend UI in this phase.
- No split of the backend services into separate machines yet.

## Proposed Release Flow

### 1. GitHub Actions builds and validates

- On `push main`, CI runs:
  - lint / formatting checks
  - type checking
  - tests
- If checks pass, Actions builds the runtime Docker image for `linux/amd64`.

### 2. GitHub Actions publishes to GHCR

- The image is pushed to GHCR under the repository namespace.
- Each release gets two tags:
  - `sha-<shortsha>` for immutable version pinning and rollback
  - `latest` for the current mainline release

### 3. GitHub Actions deploys over SSH

- The workflow connects to the ECS over SSH using a dedicated deploy key.
- The remote command sequence is intentionally short:
  - `docker login` to GHCR if needed
  - `docker compose pull`
  - `docker compose up -d`
  - optional health checks after the restart

### 4. GitHub Actions sends Feishu notification

- After the deploy step finishes, the workflow sends a Feishu message.
- The default notification is a success message after the health check passes.
- The message should include:
  - repository name
  - branch
  - commit SHA
  - deployed image tag
  - target host
  - result status
- If the deploy or health check fails, the workflow should still be able to send a failure notification when possible.

### 5. ECS keeps the entire runtime stack local

- The ECS runs the application stack in one compose project.
- The database, cache, object storage, and app containers all live on the same host.
- Persistent data uses Docker volumes or bind mounts on the ECS disk.

## Server Bootstrap

The ECS is a fresh Ubuntu 22.04 instance, so the first-time setup must be explicit and repeatable.

### One-time manual bootstrap

- Install Docker Engine.
- Install Docker Compose plugin.
- Create a deployment directory, for example `/opt/minikb`.
- Copy the production compose file and the runtime `.env` file into that directory.
- Configure SSH access for the GitHub Actions deploy key.
- Authenticate the host to GHCR so it can pull private images.
- Create persistent volumes for Postgres, Redis, and MinIO data.
- Prepare a Feishu incoming webhook or bot token for deployment notifications.

### Ongoing release behavior

- Subsequent releases should not require manual server login.
- The CI workflow should own the image update and restart step.
- The server should remain recoverable by re-running the same compose commands manually if automation fails.

## Deployment Contract

The deployment contract is the minimum set of files and expectations the workflow depends on.

- A production compose file exists on the server and describes the five services.
- A server-side `.env` file provides secrets and runtime settings.
- The image reference in compose points to GHCR tags, not a locally built image.
- The ECS has outbound network access to GHCR.
- The ECS user used by Actions can run `docker` and `docker compose` without interactive prompts.

## Rollback Strategy

Rollback must not require rebuilding or republishing.

- Keep every release immutable via `sha-<shortsha>`.
- If a bad deploy ships, update the compose image tag on the ECS to the known-good `sha-<shortsha>`.
- Re-run `docker compose pull && docker compose up -d`.
- `latest` is only the convenience pointer; it is not the rollback source of truth.

## Tagging Policy

- `latest`
  - Tracks the current successful mainline build.
  - Used for routine deploys.
- `sha-<shortsha>`
  - Identifies an exact Git revision.
  - Used for rollback and incident triage.

The workflow should not depend on semantic versions in this phase.

## Resource Plan for 4c4g ECS

The target host has limited memory, so the service budget must be conservative.

### Recommended baseline split

- Postgres: `1.0G` memory cap
- Redis: `128M` to `256M`
- MinIO: `256M` to `384M`
- Web/API: `512M` to `768M`
- Worker: `768M` to `1.0G`
- Host OS and Docker overhead: reserve at least `512M`

### Operational guidance

- Run a single worker container at first.
- Keep worker concurrency low unless ingest throughput proves it is safe to increase.
- Avoid enabling optional monitoring services on day one.
- If the first production load is heavy, reduce worker concurrency before raising container memory caps.
- If memory pressure appears, the first knob to turn is worker concurrency, not Postgres.

### Capacity warning

This layout is viable for a modest single-node production setup, but it is not comfortable for sustained high ingest volume. The design should assume the service is being kept lean until a future scale-out phase.

## Security Model

- GitHub Actions must store deploy credentials as repository secrets.
- The ECS must not contain GitHub tokens in the repo tree.
- GHCR access should use a token with only the package-read scope needed for pull.
- The SSH key used for deployment should be distinct from any personal login key.
- Feishu notification credentials should live in GitHub Secrets, not in the repository.
- Production secrets live only on the ECS `.env` file or the server secret store, not in GitHub source.

## Failure Handling

- If pull succeeds but restart fails, the workflow should fail visibly in GitHub Actions.
- If the image pull fails, the old containers should remain intact until the compose restart step is reached.
- Health checks should verify the app is reachable after restart.
- If the health check fails, the deploy output must show the failing stage clearly enough to roll back manually.

## Implementation Surface

The implementation is expected to touch these areas:

- `.github/workflows/` for build-and-deploy automation
- `docker/docker-compose.prod.yml` for GHCR image references and deploy-friendly settings
- `deploy/` for server bootstrap and rollback instructions
- `README.md` for updated quick-start and production notes

## Acceptance Criteria

- `push main` produces a GHCR image.
- The ECS automatically updates by pulling the new image and recreating containers.
- The stack starts successfully on a fresh Ubuntu 22.04 ECS after one-time bootstrap.
- A Feishu message is sent after a successful deploy.
- A bad release can be rolled back to a prior `sha-<shortsha>` without rebuilding.
- The documented memory budget fits the 4c4g machine without assuming extra headroom.

## Open Questions Resolved

- Registry choice: GHCR.
- ECS deployment mechanism: SSH plus `docker compose pull && docker compose up -d`.
- Environment model: single production environment.
- Host topology: all runtime services on the same ECS for now.
