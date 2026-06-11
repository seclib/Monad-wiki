# MONAD

**A local-first AI and knowledge system for private workspaces.**

MONAD brings together a Docker-based application interface, local knowledge
storage, optional AI assistance, and Obsidian-compatible Markdown workflows. It
is designed for people who want useful automation and knowledge tools without
making cloud services the center of their system.

Maintained by **seclib**.

---

## What MONAD Is

MONAD is a self-hosted workspace for local knowledge, AI-assisted workflows, and
private service management. It runs with Docker Compose, stores data on your own
machine, and can connect to local AI engines such as Ollama.

It is meant for:

- personal knowledge systems,
- offline-first documentation,
- local AI experimentation,
- private home or lab deployments,
- portable knowledge environments.

## Key Features

| Feature | Description |
| --- | --- |
| Local-first storage | Keep application data, vault files, and runtime content on the host. |
| Offline-first design | Core workflows continue to work without internet after setup. |
| External Ollama support | Use a locally installed Ollama server without embedding it in the Docker stack. |
| Obsidian Vault compatibility | Save notes, documents, services, and AI outputs as Markdown files. |
| Docker deployment | Start the system with Docker Compose and a small set of services. |
| Reverse proxy access | Use Caddy as the single local HTTP entry point. |
| Knowledge workflows | Manage notes, documents, local services, vault exports, and AI outputs. |

## Architecture Summary

```text
Browser
  |
  v
Caddy reverse proxy
  |
  v
MONAD admin application
  |
  +--> MySQL
  +--> Redis
  +--> Local filesystem storage
  +--> Obsidian-compatible vault
  +--> Ollama on host, optional
```

MONAD keeps the main application stack separate from the AI runtime. Ollama runs
outside Docker on the host machine, and MONAD communicates with it through its
HTTP API.

```text
MONAD container -> http://host.docker.internal:11434 -> Ollama
```

The vault is plain filesystem storage:

```text
vault/
├── notes/
├── docs/
├── ai/
└── services/
```

## Usage Example

Start the stack:

```bash
cp .env.example .env
docker compose up -d --build
```

Add a local hostname:

```text
127.0.0.1 monad.local
```

Open:

```text
http://monad.local
```

Optional local AI:

```bash
ollama serve
```

Then configure MONAD with:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Application | Node.js, AdonisJS |
| Frontend | Inertia, React, TypeScript |
| Database | MySQL |
| Queue/cache | Redis |
| Deployment | Docker Compose |
| Reverse proxy | Caddy |
| Local AI | Ollama, external host service |
| Knowledge storage | Markdown, Obsidian-compatible vault |

## Philosophy

### Local-first

MONAD treats the local machine as the primary source of truth. Data should remain
usable, inspectable, and portable without relying on a hosted account.

### Offline-first

MONAD should keep its core workflows available when internet access is missing.
Downloads, model pulls, package installs, and update checks may need connectivity,
but the system itself should not depend on cloud APIs for startup.

### Modular

AI, storage, and application logic are separate layers. MONAD does not manage the
Ollama lifecycle, and the Obsidian vault remains plain Markdown on disk.

### Transparent

The repository should be easy to inspect, easy to run, and honest about security
tradeoffs. Production use should start from clear configuration, not hidden
defaults.

## Project Links

- [Installation](installation.md)
- [Configuration](configuration.md)
- [Docker Operations](docker.md)
- [Security Guide](security.md)
- [Contributing](../CONTRIBUTING.md)
- [License](../LICENSE)

## License

MONAD is released under the MIT License.
