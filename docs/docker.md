# Docker Operations

MONAD is managed through Docker Compose. These commands assume you are in the
repository root.

## Services

| Service | Container | Purpose | Host Port |
| --- | --- | --- | --- |
| `caddy` | `monad_caddy` | Reverse proxy and public HTTP entry point | `${MONAD_HTTP_BIND:-127.0.0.1}:${MONAD_HTTP_PORT:-80}` |
| `admin` | `monad_admin` | MONAD web UI and API | none, internal `8050` only |
| `mysql` | `monad_mysql` | Application database | none, internal `3306` only |
| `redis` | `monad_redis` | Queue/cache backend | none, internal `6379` only |
| `disk-collector` | `monad_disk_collector` | Optional host disk metrics collector | none, profile `host-metrics` |

The default stack does not mount the host Docker daemon socket. Docker control
features stay disabled unless a restricted Docker API endpoint is explicitly
configured. The optional `disk-collector` profile writes project-local disk
metadata and should only be enabled when those metrics are needed.

Enable optional host metrics:

```bash
docker compose --profile host-metrics up -d
```

## Start

```bash
docker compose up -d --build
```

## Status

```bash
docker compose ps
```

## Logs

All services:

```bash
docker compose logs -f
```

Admin service only:

```bash
docker logs -f monad_admin
```

## Restart

```bash
docker compose restart
```

## Rebuild

```bash
docker compose up -d --build
```

## Stop

```bash
docker compose down
```

## Validate Compose

```bash
docker compose --env-file .env.example config --quiet
```

## Port Exposure

Caddy is the intended public entry point for local access. Keep backend services
on Docker networks unless a service explicitly needs a host port.

By default Caddy binds to localhost only:

```env
MONAD_HTTP_BIND=127.0.0.1
MONAD_HTTP_PORT=80
```

To allow trusted LAN access, set:

```env
MONAD_HTTP_BIND=0.0.0.0
```

Default access:

```text
http://monad.local
http://localhost
```

## Persistent Data

Runtime data should live in Docker volumes or host-mounted storage, not in Git.
Do not commit database files, vault contents, logs, or generated application
state.
