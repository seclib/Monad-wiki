#!/usr/bin/env python3
"""
MONAD host-side updater daemon.

This process runs on the host, not inside Docker. It is the only component that
executes Docker commands, and it exposes only pre-approved MONAD update actions.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


PROJECT_NAME = os.getenv("MONAD_COMPOSE_PROJECT", "monad")
COMPOSE_FILE = Path(os.getenv("MONAD_COMPOSE_FILE", "/opt/monad/compose.yml"))
SHARED_DIR = Path(os.getenv("MONAD_UPDATE_SHARED_DIR", "/opt/monad/update-shared"))
HOST = os.getenv("MONAD_UPDATER_HOST", "127.0.0.1")
PORT = int(os.getenv("MONAD_UPDATER_PORT", "8765"))
TOKEN_FILE = Path(os.getenv("MONAD_UPDATER_TOKEN_FILE", "/etc/monad/updater.token"))
TOKEN = os.getenv("MONAD_UPDATER_TOKEN", "")

REQUEST_FILE = SHARED_DIR / "update-request"
STATUS_FILE = SHARED_DIR / "update-status"
LOG_FILE = SHARED_DIR / "update-log"

ALLOWED_SERVICES = {
    item.strip()
    for item in os.getenv(
        "MONAD_ALLOWED_UPDATE_SERVICES",
        "admin,mysql,redis,dozzle,caddy,disk-collector",
    ).split(",")
    if item.strip()
}

ALLOWED_IMAGE_REPOS = {
    item.strip()
    for item in os.getenv(
        "MONAD_ALLOWED_IMAGE_REPOS",
        "ghcr.io/crosstalk-solutions/project-nomad",
    ).split(",")
    if item.strip()
}

TAG_PATTERN = re.compile(r"^(latest|v?\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9_.-]+)?)$")
lock = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_paths() -> None:
    SHARED_DIR.mkdir(parents=True, exist_ok=True)
    if not COMPOSE_FILE.exists():
        raise RuntimeError(f"Compose file not found: {COMPOSE_FILE}")


def load_token() -> str:
    if TOKEN:
        return TOKEN.strip()
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text(encoding="utf-8").strip()
    return ""


def write_status(stage: str, progress: int, message: str, extra: dict[str, Any] | None = None) -> None:
    payload = {
        "stage": stage,
        "progress": progress,
        "message": message,
        "timestamp": utc_now(),
    }
    if extra:
        payload.update(extra)
    STATUS_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def log(message: str) -> None:
    line = f"[{utc_now()}] {message}\n"
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(line)


def run_cmd(args: list[str], stage: str) -> subprocess.CompletedProcess[str]:
    log(f"$ {' '.join(args)}")
    proc = subprocess.run(args, text=True, capture_output=True, check=False)
    if proc.stdout:
        log(proc.stdout.rstrip())
    if proc.stderr:
        log(proc.stderr.rstrip())
    if proc.returncode != 0:
        raise RuntimeError(f"{stage} failed with exit code {proc.returncode}")
    return proc


def docker_compose_args(*args: str) -> list[str]:
    return ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_FILE), *args]


def validate_services(requested: Any) -> list[str]:
    if requested is None:
        return [service for service in ["admin", "mysql", "redis", "dozzle", "caddy"] if service in ALLOWED_SERVICES]
    if not isinstance(requested, list) or not all(isinstance(item, str) for item in requested):
        raise ValueError("services must be a list of strings")
    rejected = sorted(set(requested) - ALLOWED_SERVICES)
    if rejected:
        raise ValueError(f"service(s) not allowed: {', '.join(rejected)}")
    return requested


def validate_tag(tag: str) -> str:
    if not TAG_PATTERN.match(tag):
        raise ValueError("target_tag is not allowed")
    return tag


def compose_images() -> list[str]:
    proc = run_cmd(docker_compose_args("config", "--images"), "compose image listing")
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def image_id(image: str) -> str | None:
    proc = subprocess.run(
        ["docker", "image", "inspect", "--format", "{{.Id}}", image],
        text=True,
        capture_output=True,
        check=False,
    )
    return proc.stdout.strip() if proc.returncode == 0 else None


def update_compose_tag(target_tag: str) -> None:
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    updated = content
    for repo in ALLOWED_IMAGE_REPOS:
        escaped = re.escape(repo)
        updated = re.sub(rf"(image:\s*{escaped})(?::[^\s#]+)?", rf"\1:{target_tag}", updated)
    if updated != content:
        backup = COMPOSE_FILE.with_suffix(COMPOSE_FILE.suffix + ".bak")
        backup.write_text(content, encoding="utf-8")
        COMPOSE_FILE.write_text(updated, encoding="utf-8")
        log(f"Updated approved image tag(s) to {target_tag}; backup: {backup}")
    else:
        log("No approved image references required tag updates")


def check_updates() -> dict[str, Any]:
    with lock:
        write_status("checking", 10, "Checking approved MONAD images")
        services = validate_services(None)
        images = [image for image in compose_images() if any(image.startswith(repo) for repo in ALLOWED_IMAGE_REPOS)]
        before = {image: image_id(image) for image in images}
        write_status("checking", 45, "Pulling approved image metadata")
        run_cmd(docker_compose_args("pull", "--quiet", *services), "image pull")
        after = {image: image_id(image) for image in images}
        changed = [image for image in images if before.get(image) != after.get(image)]
        write_status(
            "idle",
            0,
            "Update check complete",
            {"updatesAvailable": bool(changed), "changedImages": changed},
        )
        return {"updatesAvailable": bool(changed), "changedImages": changed, "checkedImages": images}


def apply_update(payload: dict[str, Any]) -> dict[str, Any]:
    with lock:
        LOG_FILE.write_text("", encoding="utf-8")
        services = validate_services(payload.get("services"))
        target_tag = validate_tag(str(payload.get("target_tag", "latest")))

        write_status("starting", 0, "MONAD update accepted")
        log(f"Applying MONAD update: tag={target_tag}, services={','.join(services)}")

        write_status("preparing", 10, "Updating compose file")
        update_compose_tag(target_tag)

        write_status("pulling", 30, "Pulling approved images")
        run_cmd(docker_compose_args("pull", *services), "image pull")

        progress = 50
        per_service = max(1, int(45 / max(1, len(services))))
        for service in services:
            write_status("recreating", progress, f"Recreating {service}")
            run_cmd(docker_compose_args("up", "-d", "--no-deps", "--force-recreate", service), f"recreate {service}")
            progress = min(95, progress + per_service)

        write_status("complete", 100, "MONAD update completed successfully")
        return {"success": True, "services": services, "target_tag": target_tag}


def get_status() -> dict[str, Any]:
    if not STATUS_FILE.exists():
        return {"stage": "idle", "progress": 0, "message": "No update in progress", "timestamp": utc_now()}
    return json.loads(STATUS_FILE.read_text(encoding="utf-8"))


def process_request_file() -> None:
    if not REQUEST_FILE.exists():
        return
    try:
        payload = json.loads(REQUEST_FILE.read_text(encoding="utf-8") or "{}")
        REQUEST_FILE.unlink(missing_ok=True)
        apply_update(payload)
    except Exception as exc:  # noqa: BLE001 - daemon must report failures, not die.
        log(f"ERROR: {exc}")
        write_status("error", 0, str(exc))


def request_watcher() -> None:
    while True:
        process_request_file()
        time.sleep(1)


class Handler(BaseHTTPRequestHandler):
    server_version = "MonadUpdater/1.0"

    def do_GET(self) -> None:
        if self.path == "/update/status":
            self.send_json(200, get_status())
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if not self.authorized():
            self.send_json(401, {"error": "unauthorized"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/update/check":
                self.send_json(200, check_updates())
            elif self.path == "/update/apply":
                self.send_json(202, apply_update(payload))
            else:
                self.send_json(404, {"error": "not found"})
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001 - API returns operational failure.
            log(f"ERROR: {exc}")
            write_status("error", 0, str(exc))
            self.send_json(500, {"error": str(exc)})

    def authorized(self) -> bool:
        expected = load_token()
        if not expected:
            return HOST in {"127.0.0.1", "localhost"}
        return self.headers.get("X-MONAD-Updater-Token") == expected

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:
        log(fmt % args)


def main() -> None:
    ensure_paths()
    write_status("idle", 0, "Ready for update requests")
    threading.Thread(target=request_watcher, daemon=True).start()
    log(f"Starting MONAD updater daemon on {HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
