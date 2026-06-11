from __future__ import annotations

import json
import time
from copy import deepcopy
from typing import Any

from .crypto import (
    MEMORY_DIR,
    ensure_runtime_dirs,
    memory_path,
    read_encrypted_json,
    secure_delete,
    validate_memory_id,
    write_encrypted_json,
)
from .index import list_index_entries, remove_index_entry, upsert_index_entry


MEMORY_TYPES = {"preference", "technical", "event", "project", "temporary"}
REQUIRED_FIELDS = {"id", "type", "content", "timestamp"}


def _assert_json_serializable(value: Any) -> None:
    json.dumps(value, ensure_ascii=False)


def validate_memory_entry(entry: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ValueError("memory entry must be an object")

    missing = REQUIRED_FIELDS - set(entry)
    if missing:
        raise ValueError(f"memory entry missing field(s): {', '.join(sorted(missing))}")

    memory_id = validate_memory_id(entry["id"])
    memory_type = entry["type"]
    if memory_type not in MEMORY_TYPES:
        raise ValueError(f"invalid memory type: {memory_type}")

    timestamp = entry["timestamp"]
    if not isinstance(timestamp, (int, float)):
        raise ValueError("timestamp must be a unix time number")

    _assert_json_serializable(entry["content"])

    clean = {
        "id": memory_id,
        "type": memory_type,
        "content": deepcopy(entry["content"]),
        "timestamp": float(timestamp),
    }

    return clean


def write_memory(entry: dict[str, Any]) -> str:
    ensure_runtime_dirs()
    clean = validate_memory_entry(entry)
    target = memory_path(clean["id"])

    if target.exists():
        raise FileExistsError(f"memory already exists: {clean['id']}")

    write_encrypted_json(target, clean)
    upsert_index_entry(clean["id"], clean["type"], clean["timestamp"])
    return clean["id"]


def read_memory(memory_id: str) -> dict[str, Any]:
    ensure_runtime_dirs()
    validate_memory_id(memory_id)
    memory = read_encrypted_json(memory_path(memory_id))
    if not isinstance(memory, dict):
        raise ValueError("stored memory is invalid")
    return validate_memory_entry(memory)


def update_memory(memory_id: str, new_data: dict[str, Any]) -> dict[str, Any]:
    ensure_runtime_dirs()
    validate_memory_id(memory_id)
    if not isinstance(new_data, dict):
        raise ValueError("new_data must be an object")
    if "id" in new_data and new_data["id"] != memory_id:
        raise ValueError("memory id cannot be changed")

    current = read_memory(memory_id)
    updated = {
        **current,
        **{key: deepcopy(value) for key, value in new_data.items() if key != "id"},
    }

    if "timestamp" not in new_data:
        updated["timestamp"] = time.time()

    clean = validate_memory_entry(updated)
    write_encrypted_json(memory_path(memory_id), clean)
    upsert_index_entry(clean["id"], clean["type"], clean["timestamp"])
    return clean


def delete_memory(memory_id: str) -> None:
    ensure_runtime_dirs()
    validate_memory_id(memory_id)
    secure_delete(memory_path(memory_id))
    remove_index_entry(memory_id)


def list_memories(memory_type: str | None = None) -> list[dict[str, Any]]:
    ensure_runtime_dirs()
    if memory_type is not None and memory_type not in MEMORY_TYPES:
        raise ValueError(f"invalid memory type: {memory_type}")
    return list_index_entries(memory_type)


def memory_storage_path() -> str:
    ensure_runtime_dirs()
    return str(MEMORY_DIR)
