# MONAD Secure Host Updater

This updater replaces the Docker-socket sidecar with a host-level daemon.

The daemon runs on Kali Linux under `systemd`, owns the Docker CLI access on the
host, and exposes only a small whitelist of MONAD update actions. Containers do
not receive `/var/run/docker.sock`.

## Install

```bash
sudo mkdir -p /opt/monad/install/host-updater /opt/monad/update-shared /etc/monad
sudo cp install/host-updater/monad_updater_daemon.py /opt/monad/install/host-updater/
sudo cp install/host-updater/README.md /opt/monad/install/host-updater/
openssl rand -hex 32 | sudo tee /etc/monad/updater.token >/dev/null
sudo chmod 600 /etc/monad/updater.token
sudo cp install/host-updater/monad-updater.service /etc/systemd/system/monad-updater.service
sudo systemctl daemon-reload
sudo systemctl enable --now monad-updater.service
```

The default API binds to `127.0.0.1:8765`. The existing admin update flow can
also communicate through `/opt/monad/update-shared` by writing `update-request`
and reading `update-status` / `update-log`.

## API

All POST requests require:

```http
X-MONAD-Updater-Token: <contents of /etc/monad/updater.token>
```

```bash
curl -s http://127.0.0.1:8765/update/status | jq
curl -s -X POST http://127.0.0.1:8765/update/check \
  -H "X-MONAD-Updater-Token: $(sudo cat /etc/monad/updater.token)" | jq
curl -s -X POST http://127.0.0.1:8765/update/apply \
  -H "Content-Type: application/json" \
  -H "X-MONAD-Updater-Token: $(sudo cat /etc/monad/updater.token)" \
  -d '{"target_tag":"latest","services":["admin","mysql","redis","dozzle"]}' | jq
```

## Security Model

- No container gets Docker daemon access.
- Only this host process executes `docker compose`.
- Services are allowlisted with `MONAD_ALLOWED_UPDATE_SERVICES`.
- Image repositories are allowlisted with `MONAD_ALLOWED_IMAGE_REPOS`.
- Tags must match a conservative version pattern or `latest`.
- Commands are executed without a shell.
- Status and logs are written to the shared update directory for the UI.
