# Installation

This guide covers a local Docker Compose installation of MONAD.

## Requirements

- Linux host, preferably Debian, Kali, or Ubuntu
- Docker Engine
- Docker Compose v2 plugin
- Git
- OpenSSL for generating local secrets
- Optional: Ollama on the host for local AI features

Install the base packages on Kali or another Debian-based system:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin openssl
sudo systemctl enable --now docker
```

If you want to run Docker without `sudo`, add your user to the Docker group:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

## Clone

```bash
git clone https://github.com/seclib/monad.git
cd monad
```

## Configure

Create a local environment file:

```bash
cp .env.example .env
```

Generate strong local secrets:

```bash
openssl rand -base64 32
```

Update `.env` with deployment-specific values, especially:

- `APP_KEY`
- `DB_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `URL`

## Start

```bash
docker compose up -d --build
```

Check that services are running:

```bash
docker compose ps
```

## Access

For local hostname access, add this entry to your local hosts configuration:

```text
127.0.0.1 monad.local
```

Then open:

```text
http://monad.local
```

You can also use:

```text
http://localhost
```

## Stop

```bash
docker compose down
```
