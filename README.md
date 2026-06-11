# MONAD

**Local-first AI + knowledge system**

Maintained by **seclib**

MONAD is a Docker-based local knowledge system designed to run on a personal
machine or private network. It provides an admin interface for local services,
offline-capable knowledge storage, optional AI features through a local Ollama
server, and Obsidian-compatible Markdown vault workflows.

MONAD is built for local-first use: data stays on the host, services run through
Docker Compose, and the core system does not require cloud services to start.

## Features

- **Docker-based deployment:** run MONAD with Docker Compose.
- **Offline-first architecture:** core services and local data remain usable
  without internet access after setup.
- **External Ollama integration:** connect to a local Ollama service running on
  the host, without embedding Ollama inside the MONAD Compose stack.
- **Obsidian Vault compatibility:** store notes, documents, service entries, and
  AI outputs as plain Markdown files.
- **Local admin interface:** manage the system from a browser-based UI.
- **Reverse proxy support:** access MONAD through Caddy using `http://monad.local`
  or `http://localhost`.
- **Open-source project structure:** includes documentation, contribution
  guidelines, security policy, and MIT license.

## Repository Structure

```text
MONAD/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── .env.example
├── docker-compose.yaml
├── Dockerfile
├── admin/
├── config/
├── collections/
├── storage/
├── logs/
├── cache/
├── models/
├── data/
├── docs/
├── install/
├── scripts/
└── vault/
```

## Requirements

- Linux host, such as Kali, Debian, or Ubuntu
- Docker Engine
- Docker Compose v2 plugin
- Git
- OpenSSL for generating local secrets
- Optional: Ollama installed on the host for local AI features

Install the base packages on Kali or another Debian-based system:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin openssl
sudo systemctl enable --now docker
```

Optional: allow your user to run Docker commands without `sudo`:

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

Create a local environment file:

```bash
cp .env.example .env
```

Generate strong local secrets:

```bash
openssl rand -base64 32
```

Edit `.env` and set deployment-specific values, especially:

- `APP_KEY`
- `DB_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `URL`

For a default local setup, use:

```env
URL=http://monad.local
MONAD_HTTP_PORT=80
PROJECT_NAME=MONAD
APP_AUTHOR=seclib
```

Start MONAD:

```bash
docker compose up -d --build
```

Check service status:

```bash
docker compose ps
```

## Access

For local domain access, add this entry to your local hosts configuration:

```text
127.0.0.1 monad.local
```

Open MONAD in your browser:

```text
http://monad.local
```

You can also use:

```text
http://localhost
```

Health check:

```bash
curl http://localhost/api/health
```

Expected response:

```json
{ "status": "ok" }
```

## Usage

Common Docker commands:

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

Follow admin logs:

```bash
docker logs -f monad_admin
```

Rebuild after local changes:

```bash
docker compose up -d --build
```

## Ollama Integration

Ollama is an external local service. MONAD does not install, start, stop, or
manage Ollama.

Install and run Ollama on the host if you want local AI features:

```bash
ollama serve
```

The default MONAD configuration expects Ollama at:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

If Ollama is not running, MONAD should still start. AI-dependent features should
report that the local AI service is unavailable.

## Obsidian Vault Compatibility

MONAD can store knowledge content as Obsidian-compatible Markdown.

Recommended vault structure:

```text
vault/
├── notes/
├── docs/
├── ai/
└── services/
```

Vault files are plain Markdown with optional frontmatter. Runtime vault data is
private by default and should not be committed to Git.

## Documentation

- [Installation](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Docker Operations](docs/docker.md)
- [Repository Structure](docs/repository-structure.md)
- [Security Guide](docs/security.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Security

MONAD is intended for localhost, trusted LAN, and private offline-first
deployments. Do not expose the admin interface directly to the public internet.

Before using MONAD outside a trusted local environment:

- review `docker-compose.yaml`,
- rotate all `.env` secrets,
- restrict network access,
- place the app behind a trusted reverse proxy or VPN,
- read [SECURITY.md](SECURITY.md).

## Disclaimer

MONAD is provided as a local-first open-source system. Core functionality is
designed to work offline after setup, but image pulls, dependency installation,
model downloads, map/content downloads, and update checks may require internet
access.

You are responsible for securing the host machine, Docker daemon, network
exposure, secrets, and private vault data. Review the configuration before using
MONAD with sensitive information or in shared environments.

## Contributing

Contributions are welcome. Please read:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)

## License

MONAD is released under the [MIT License](LICENSE).
