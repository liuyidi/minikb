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

## 4. Create the deployment directory

```bash
sudo mkdir -p /opt/minikb
sudo chown -R "$USER":"$USER" /opt/minikb
```

Copy the production compose file into place:

```bash
cp docker/docker-compose.prod.yml /opt/minikb/docker-compose.prod.yml
```

## 5. Create the runtime env file

Store the server-side env file at:

```bash
/opt/minikb/.env
```

Start from [`.env.example`](../.env.example) and fill in:

- `MINIKB_IMAGE`
- `MINIKB_POSTGRES_PASSWORD`
- `MINIKB_S3_ACCESS_KEY`
- `MINIKB_S3_SECRET_KEY`
- `MINIKB_OPENAI_API_KEY`
- any host-specific port overrides

## 6. Verify GHCR pull access

The ECS needs a GHCR read token before `docker compose pull` can work.

Use a token stored in GitHub Secrets as `GHCR_READ_TOKEN` and log in on the host:

```bash
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
```

If the login succeeds, the host can pull `ghcr.io/<owner>/minikb:*` images.

## 7. Bring up the stack

```bash
cd /opt/minikb
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## 8. Confirm the persistent volumes

The compose project creates these Docker volumes:

- `minikb_pgdata` for Postgres
- `minikb_redisdata` for Redis
- `minikb_miniodata` for MinIO

Optional monitoring also uses `minikb_prometheus_data`.

## 9. Validate health

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/health/live
```
