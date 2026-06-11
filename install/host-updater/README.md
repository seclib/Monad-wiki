# MONAD Secure Host Updater

This updater replaces the Docker-socket sidecar with a project-local host
process. It executes only allowlisted MONAD update actions and keeps updater
state inside the repository folder.

## Local Run

From the MONAD project root:

```bash
mkdir -p config cache/update-shared
openssl rand -hex 32 > config/updater.token
chmod 600 config/updater.token
python3 install/host-updater/monad_updater_daemon.py
```

The default API binds to `127.0.0.1:8765`. The admin update flow can also
communicate through `cache/update-shared` by writing `update-request` and
reading `update-status` / `update-log`.

## API

All POST requests require:

```http
X-MONAD-Updater-Token: <contents of config/updater.token>
```

```bash
curl -s http://127.0.0.1:8765/update/status | jq
curl -s -X POST http://127.0.0.1:8765/update/check \
  -H "X-MONAD-Updater-Token: $(cat config/updater.token)" | jq
curl -s -X POST http://127.0.0.1:8765/update/apply \
  -H "Content-Type: application/json" \
  -H "X-MONAD-Updater-Token: $(cat config/updater.token)" \
  -d '{"target_tag":"latest","services":["admin","mysql","redis","caddy"]}' | jq
```

## Security Model

- No container gets Docker daemon access.
- Only this host process executes `docker compose`.
- Services are allowlisted with `MONAD_ALLOWED_UPDATE_SERVICES`.
- Image repositories are allowlisted with `MONAD_ALLOWED_IMAGE_REPOS`.
- Tags must match a conservative version pattern or `latest`.
- Commands are executed without a shell.
- Status and logs are written to `cache/update-shared` for the UI.
