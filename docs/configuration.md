# Configuration

MONAD uses environment variables for deployment-specific settings. Keep real
secrets in `.env` and commit only `.env.example`.

## Required Local File

```bash
cp .env.example .env
```

Do not commit `.env`.

## Core Variables

| Variable | Purpose |
| --- | --- |
| `PROJECT_NAME` | Human-readable project name. Use `MONAD`. |
| `APP_AUTHOR` | Maintainer or author name. Use `seclib`. |
| `URL` | Public URL used by the admin service. |
| `MONAD_HTTP_PORT` | Host port exposed by Caddy, usually `80`. |
| `APP_KEY` | Application secret key. Generate locally. |
| `DB_PASSWORD` | Database user password. Generate locally. |
| `MYSQL_ROOT_PASSWORD` | Database root password. Generate locally. |
| `TZ` | Timezone, for example `Indian/Reunion`. |
| `LANG` | Locale, for example `fr_FR.UTF-8`. |
| `LC_ALL` | Locale override, for example `fr_FR.UTF-8`. |
| `OLLAMA_BASE_URL` | Optional host Ollama API URL. |

## Local Domain

For local development and private deployments:

```text
127.0.0.1 monad.local
```

Add the line above to your local hosts configuration, then set:

```env
URL=http://monad.local
```

## Ollama

Ollama is expected to run outside the MONAD Compose project. MONAD only consumes
its HTTP API.

Default value:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

If Ollama is not running, MONAD should continue to start. AI features should
report that the local AI engine is unavailable instead of blocking the whole
application.

## Vault Storage

Vault data is local runtime data. Keep it outside Git.

Default project-local path:

```text
storage/vault
```

Recommended folders:

```text
storage/vault/
├── notes/
├── docs/
├── ai/
└── services/
```
