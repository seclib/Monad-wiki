from __future__ import annotations

from typing import Any

from .crypto import DB_DIR, ensure_runtime_dirs, read_encrypted_json, safe_path, write_encrypted_json


INDEX_FILE = DB_DIR / "memory_index.enc"
INDEX_VERSION = 1


def _empty_index() -> dict[str, Any]:
    return {"version": INDEX_VERSION, "entries": {}}


def load_index() -> dict[str, Any]:
    ensure_runtime_dirs()
    path = safe_path(INDEX_FILE, must_be_inside=DB_DIR)
    if not path.exists():
        return _empty_index()

    index = read_encrypted_json(path)
    if not isinstance(index, dict):
        return _empty_index()
    if index.get("version") != INDEX_VERSION:
        return _empty_index()
    if not isinstance(index.get("entries"), dict):
        return _empty_index()
    return index


def save_index(index: dict[str, Any]) -> None:
    ensure_runtime_dirs()
    entries = index.get("entries")
    if not isinstance(entries, dict):
        entries = {}
    sanitized_entries: dict[str, dict[str, Any]] = {}

    for memory_id, entry in entries.items():
        if not isinstance(entry, dict):
            continue
        sanitized_entries[str(memory_id)] = {
            "id": str(entry.get("id", memory_id)),
            "type": str(entry.get("type", "")),
            "timestamp": float(entry.get("timestamp", 0)),
        }

    write_encrypted_json(
        safe_path(INDEX_FILE, must_be_inside=DB_DIR),
        {"version": INDEX_VERSION, "entries": sanitized_entries},
    )


def upsert_index_entry(memory_id: str, memory_type: str, timestamp: float) -> None:
    index = load_index()
    index["entries"][memory_id] = {
        "id": memory_id,
        "type": memory_type,
        "timestamp": float(timestamp),
    }
    save_index(index)


def remove_index_entry(memory_id: str) -> None:
    index = load_index()
    index["entries"].pop(memory_id, None)
    save_index(index)


def list_index_entries(memory_type: str | None = None) -> list[dict[str, Any]]:
    entries = list(load_index()["entries"].values())
    if memory_type is not None:
        entries = [entry for entry in entries if entry.get("type") == memory_type]
    return sorted(entries, key=lambda entry: entry.get("timestamp", 0), reverse=True)
