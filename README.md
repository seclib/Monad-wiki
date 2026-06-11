<div align="center">
  <img src="admin/public/monad_logo.webp" width="180" height="180" alt="MONAD logo" />

# MONAD

**A modular Docker-based stack for local services**

Built by **seclib**
</div>

---

## Overview

MONAD is a local-first service stack designed to run from Docker Compose. It provides a browser-accessible admin interface and supporting infrastructure for managing services on a single machine or local network.

The project is intentionally container-driven: services are declared in Docker Compose, data is persisted through host-mounted storage, and the admin application is exposed through a predictable local port.

## Project Identity

- Project name: `MONAD`
- Compose project: `monad`
- Creator: `seclib`
- Default admin container: `monad_admin`
- Default local URL: `http://localhost:4080`

## Requirements

Before starting MONAD, install:

- Docker
- Docker Compose plugin
- Git

On Debian/Kali-based systems:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

If your user is not in the Docker group, either run Docker commands with `sudo` or add your user to the group:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

## Installation

Clone the repository:

```bash
git clone https://github.com/seclib/monad.git
cd monad
```

Review the Compose file before first start:

```bash
nano docker-compose.yaml
```

At minimum, check these values:

- `APP_KEY`
- `DB_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `URL`

For a local install using the default port, `URL` should be:

```text
http://localhost:4080
```

## Start With Docker Compose

Start the stack:

```bash
docker compose up -d
```

Check container status:

```bash
docker compose ps
```

Follow the admin logs:

```bash
docker logs -f monad_admin
```

## Access MONAD

Open the admin interface in your browser:

```text
http://localhost:4080
```

Health check endpoint:

```bash
curl http://localhost:4080/api/health
```

Expected response:

```json
{"status":"ok"}
```

## Docker Compose Layout

The default Compose stack keeps the existing service architecture intact:

- `admin`: web admin service exposed on host port `4080`
- `mysql`: database service
- `redis`: queue/cache service
- `dozzle`: optional log viewer on port `9999`
- `updater`: update helper sidecar
- `disk-collector`: host disk information helper
- `caddy`: optional reverse proxy profile

The admin service listens internally on port `8050` and is published to the host as:

```yaml
ports:
  - "4080:8050"
```

## Persistent Data

MONAD stores persistent runtime data under:

```text
/opt/monad
```

Main paths:

```text
/opt/monad/storage
/opt/monad/mysql
/opt/monad/redis
```

Back up these directories before removing or rebuilding the stack if you want to keep application data.

## Environment Identity

The admin container includes project identity variables:

```yaml
APP_AUTHOR=seclib
PROJECT_NAME=monad
```

These values identify the local MONAD deployment without changing the service architecture.

## Stop, Restart, And Update

Stop the stack:

```bash
docker compose down
```

Restart services:

```bash
docker compose restart
```

Pull updated images and recreate containers:

```bash
docker compose pull
docker compose up -d
```

## Optional Local Domain

The simplest supported local URL is:

```text
http://localhost:4080
```

If you want to use a local hostname such as `monad.local`, add this line to `/etc/hosts`:

```text
127.0.0.1 monad.local
```

Then access:

```text
http://monad.local:4080
```

Do not put a port inside `/etc/hosts`; hosts files map names to IP addresses only.

## Notes

- MONAD is intended for local or private-network use.
- Exposing the admin interface to the public internet is not recommended without additional security controls.
- The Docker images declared in Compose are left unchanged for compatibility.
- Service names, ports, and dependencies are managed through Docker Compose.

## License

See [LICENSE](LICENSE).
