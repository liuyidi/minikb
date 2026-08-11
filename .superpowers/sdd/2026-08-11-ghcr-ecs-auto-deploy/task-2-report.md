# Task 2 Report

## Scope

Implemented Task 2 in `/Users/liuyidi/github/minikb/.worktrees/codex-ghcr-ecs-auto-deploy` by creating `.github/workflows/release.yml` and leaving compose files and docs unchanged.

## What Changed

- Added a new `Release` GitHub Actions workflow at `.github/workflows/release.yml`.
- Wired triggers to:
  - `push` on `main` for automatic releases after CI passes
  - `workflow_dispatch` with `image_tag` input for tag-based redeploys
- Set workflow permissions to `contents: read` and `packages: write`.
- Added metadata resolution so the workflow:
  - waits for the matching `CI` run on the pushed commit before releasing
  - deploys `latest` on successful `CI` runs from `main`
  - redeploys `sha-<shortsha>` tags by resolving them back to the full commit SHA
  - treats non-`sha-*` custom tags as opaque redeploy inputs
- Added GHCR publish steps for automatic releases:
  - checkout the exact release commit
  - build `docker/Dockerfile.ecs` for `linux/amd64`
  - push `ghcr.io/<owner>/minikb:latest`
  - push `ghcr.io/<owner>/minikb:sha-<shortsha>`
- Added ECS deploy over SSH:
  - logs into GHCR on the remote host with `GHCR_USERNAME` and `GHCR_READ_TOKEN`
  - updates `MINIKB_IMAGE` inside `/opt/minikb/.env`
  - syncs `docker/docker-compose.prod.yml` to `/opt/minikb/docker-compose.prod.yml`
  - runs `docker compose --env-file .env -f docker-compose.prod.yml pull`
  - runs `docker compose --env-file .env -f docker-compose.prod.yml up -d`
  - verifies `http://127.0.0.1:${MINIKB_PORT:-8080}/health/live`
- Added Feishu notification with `if: always()` so deploy status is reported for both success and failure, while webhook failures still fail the workflow.

## Assumptions

- The ECS bootstrap for later tasks will place deployment artifacts in `/opt/minikb`.
- The server-side compose file is named `docker-compose.prod.yml` and sits beside `.env` in `/opt/minikb`.
- The server-side `.env` file is shell-sourceable by `.` in POSIX shell.
- `GHCR_READ_TOKEN` is valid for host-side pulls, while the workflow itself publishes with `GITHUB_TOKEN` plus `packages: write`.

## Validation

Ran the requested validation command:

```bash
actionlint .github/workflows/release.yml
```

Observed result:

- No output
- Exit status `0`

Also verified the file parses as YAML:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml"); puts "YAML OK"'
```

Observed result:

- Command succeeded and printed `YAML OK`.

## Commit

Implementation commit:

- `52ed45c` `fix: finalize manual release metadata handling`

## Concerns

- The release workflow assumes the ECS bootstrap will provide SSH access, Docker, and a writable `/opt/minikb` directory.
- Custom manual tags that are neither `latest` nor `sha-*` are treated as opaque deploy inputs, so the notification reports `commit SHA: unknown` for those redeploys.

## Fix Round 1

Addressed the review findings by:

- switching the release trigger to `push main`
- keeping CI gating inside the workflow by polling the `CI` workflow run for the pushed commit
- resolving rollback `sha-<shortsha>` tags back to the full commit SHA for notifications, and resolving `latest` to the latest successful CI commit on `main`
- treating other manual redeploy tags as opaque inputs instead of inventing a source commit
- syncing `docker/docker-compose.prod.yml` to `/opt/minikb/docker-compose.prod.yml` before deploy
- checking out the repository for manual dispatches before syncing deploy assets, while keeping deploy metadata honest
- making Feishu notification failures fail the workflow instead of being ignored

Re-validated the workflow with:

- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml"); puts "YAML OK"'`
- `actionlint .github/workflows/release.yml`

`actionlint` produced no output and exited with status 0.
Transcript:

```text
$ actionlint .github/workflows/release.yml
<no output>
exit 0
```
