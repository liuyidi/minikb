# Task 2 Report

## Scope

Implemented Task 2 in `/Users/liuyidi/github/minikb/.worktrees/codex-ghcr-ecs-auto-deploy` by creating `.github/workflows/release.yml` and leaving compose files and docs unchanged.

## What Changed

- Added a new `Release` GitHub Actions workflow at `.github/workflows/release.yml`.
- Wired triggers to:
  - `workflow_run` for `CI` completions on `main`
  - `workflow_dispatch` with `image_tag` input for tag-based redeploys
- Set workflow permissions to `contents: read` and `packages: write`.
- Added metadata resolution so the workflow:
  - deploys `latest` on successful `CI` runs from `main`
  - redeploys any existing `image_tag` manually without rebuilding
  - derives and records `sha-<shortsha>` tags from the release commit
- Added GHCR publish steps for automatic releases:
  - checkout the exact `workflow_run.head_sha`
  - build `docker/Dockerfile.ecs` for `linux/amd64`
  - push `ghcr.io/<owner>/minikb:latest`
  - push `ghcr.io/<owner>/minikb:sha-<shortsha>`
- Added ECS deploy over SSH:
  - logs into GHCR on the remote host with `GHCR_USERNAME` and `GHCR_READ_TOKEN`
  - updates `MINIKB_IMAGE` inside `/opt/minikb/.env`
  - runs `docker compose --env-file .env -f docker-compose.prod.yml pull`
  - runs `docker compose --env-file .env -f docker-compose.prod.yml up -d`
  - verifies `http://127.0.0.1:${MINIKB_PORT:-8080}/health/live`
- Added Feishu notification with `if: always()` and `continue-on-error: true` so deploy status is reported without turning a successful deploy into a failed workflow solely because the webhook had an issue.

## Assumptions

- The ECS bootstrap for later tasks will place deployment artifacts in `/opt/minikb`.
- The server-side compose file is named `docker-compose.prod.yml` and sits beside `.env` in `/opt/minikb`.
- The server-side `.env` file is shell-sourceable by `.` in POSIX shell.
- `GHCR_READ_TOKEN` is valid for host-side pulls, while the workflow itself publishes with `GITHUB_TOKEN` plus `packages: write`.

## Validation

Attempted the requested validation command:

```bash
actionlint .github/workflows/release.yml
```

Result:

- `actionlint` is not installed in the local environment, so this exact check could not be run.

Fallback verification actually run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml"); puts "YAML OK"'
```

Observed result:

- Command succeeded and printed `YAML OK`.

## Commit

Implementation commit:

- `68a6769` `feat: add GHCR ECS release workflow`

## Concerns

- Manual `workflow_dispatch` redeploys use the provided `image_tag`, but the reported `commit SHA` is the workflow commit SHA available in GitHub Actions. If operators dispatch `sha-<shortsha>` rollbacks from a later commit, the notification will show the dispatch commit rather than a guaranteed full source commit for the deployed image.
- The deploy path is intentionally minimal and depends on the host bootstrap matching `/opt/minikb` plus `docker-compose.prod.yml`; if Task 3 chooses a different host layout, this workflow will need a small follow-up adjustment.
