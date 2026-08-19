# Bootstrap Ubuntu 22.04

Use this once on a fresh ECS instance before the release workflow can deploy.

## 1. Install Docker prerequisites

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
```

## 2. Install Docker Engine and Compose plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

## 3. Prepare the deployment user

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

Recommended SSH hardening:

- use a dedicated non-root deploy user
- disable password login
- allow only key-based SSH access
- keep the private deploy key in GitHub Secrets as `ECS_SSH_KEY`

## 4. Sync the application tree

`/opt/minikb` is the git/rsync checkout (compose lives at `docker/docker-compose.prod.yml`). Keep `.env` out of rsync.

## 5. Create the runtime env file

Store the server-side env file at:

```bash
/opt/minikb/.env
```

Start from [`.env.example`](../.env.example) and fill in:

- `MINIKB_POSTGRES_PASSWORD`
- `MINIKB_S3_ACCESS_KEY`
- `MINIKB_S3_SECRET_KEY`
- `MINIKB_OPENAI_API_KEY`
- `MINIKB_JWT_SECRET`
- `MINIKB_SESSION_SECRET`
- any host-specific port overrides

Do not set `MINIKB_IMAGE` / `MINIKB_WEB_IMAGE`.

## 6. Bring up the stack (on-host build)

```bash
bash /opt/minikb/deploy/remote-build.sh
```

Do not `docker compose pull` app images from GHCR.

## 7. Confirm the persistent volumes

The compose project creates these Docker volumes:

- `minikb_pgdata` for Postgres
- `minikb_redisdata` for Redis
- `minikb_miniodata` for MinIO

Optional monitoring also uses `minikb_prometheus_data`.

## 8. Validate health

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
```

Web is bound to loopback (`127.0.0.1:8080`). Public HTTPS is host nginx; see [`nginx.kb.liuyidi.me.conf.example`](./nginx.kb.liuyidi.me.conf.example) and keep `MINIKB_PORT=8080` in `/opt/minikb/.env`.
