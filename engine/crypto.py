from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


MONAD_SECURITY_VIOLATION = "MONAD_SECURITY_VIOLATION"
MONAD_CRYPTO_ERROR = "MONAD_CRYPTO_ERROR"

BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = BASE_DIR / "storage"
MEMORY_DIR = STORAGE_DIR / "memory"
DB_DIR = STORAGE_DIR / "db"
CACHE_DIR = BASE_DIR / "cache"
LOGS_DIR = BASE_DIR / "logs"
CONFIG_DIR = BASE_DIR / "config"
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"

KEY_FILE = CONFIG_DIR / "key.bin"
SETTINGS_FILE = CONFIG_DIR / "settings.json"

KEY_BYTES = 32
IV_BYTES = 12
TAG_BYTES = 16
KDF_PREFIX = b"MONADKDF1"
KDF_SALT_BYTES = 16
KDF_ITERATIONS = 310_000


class MonadSecurityError(RuntimeError):
    pass


class MonadCryptoError(RuntimeError):
    pass


def _security_error() -> None:
    raise MonadSecurityError(MONAD_SECURITY_VIOLATION)


def _crypto_error() -> None:
    raise MonadCryptoError(MONAD_CRYPTO_ERROR)


def ensure_runtime_dirs() -> None:
    for directory in (
        STORAGE_DIR,
        MEMORY_DIR,
        DB_DIR,
        CACHE_DIR,
        LOGS_DIR,
        CONFIG_DIR,
        MODELS_DIR,
        DATA_DIR,
    ):
        safe_path(directory, must_be_inside=BASE_DIR)
        directory.mkdir(parents=True, exist_ok=True)


def safe_path(path: Path | str, *, must_be_inside: Path = BASE_DIR) -> Path:
    root = must_be_inside.resolve()
    candidate = Path(path)
    resolved = (BASE_DIR / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()

    try:
        resolved.relative_to(root)
    except ValueError:
        _security_error()

    # If the target does not exist yet, resolve the nearest existing parent to
    # catch symlinks that would escape MONAD after the write is created.
    current = resolved if resolved.exists() else resolved.parent
    while not current.exists():
        parent = current.parent
        if parent == current:
            _security_error()
        current = parent

    try:
        current.resolve().relative_to(root)
    except ValueError:
        _security_error()

    return resolved


def storage_path(*parts: str) -> Path:
    return safe_path(STORAGE_DIR.joinpath(*parts), must_be_inside=STORAGE_DIR)


def memory_path(memory_id: str) -> Path:
    safe_id = validate_memory_id(memory_id)
    return storage_path("memory", f"{safe_id}.mem")


def validate_memory_id(memory_id: Any) -> str:
    if not isinstance(memory_id, str):
        _security_error()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", memory_id):
        _security_error()
    return memory_id


def _parse_env_key(value: str | None) -> bytes | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None

    for decoder in (base64.b64decode, bytes.fromhex):
        try:
            decoded = decoder(raw)
            if len(decoded) == KEY_BYTES:
                return decoded
        except Exception:
            pass

    return None


def _derive_key_from_password(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_BYTES,
        salt=salt,
        iterations=KDF_ITERATIONS,
    )
    return kdf.derive(password.encode("utf-8"))


def load_key() -> bytes:
    ensure_runtime_dirs()

    env_key = _parse_env_key(os.getenv("MONAD_MEMORY_KEY")) or _parse_env_key(
        os.getenv("MONAD_ENCRYPTION_KEY")
    )
    if env_key:
        return env_key

    key_file = safe_path(KEY_FILE, must_be_inside=CONFIG_DIR)
    password = os.getenv("MONAD_MEMORY_PASSWORD") or os.getenv("MONAD_ENCRYPTION_PASSWORD")

    if key_file.exists():
        payload = key_file.read_bytes()
        if payload.startswith(KDF_PREFIX):
            if not password:
                _crypto_error()
            salt = payload[len(KDF_PREFIX) :]
            if len(salt) != KDF_SALT_BYTES:
                _crypto_error()
            return _derive_key_from_password(password, salt)
        if len(payload) != KEY_BYTES:
            _crypto_error()
        return payload

    if password:
        salt = os.urandom(KDF_SALT_BYTES)
        key_file.write_bytes(KDF_PREFIX + salt)
    else:
        key_file.write_bytes(os.urandom(KEY_BYTES))

    try:
        key_file.chmod(0o600)
    except OSError:
        pass

    return load_key()


def encrypt_bytes(plaintext: bytes) -> bytes:
    key = load_key()
    iv = os.urandom(IV_BYTES)
    ciphertext_and_tag = AESGCM(key).encrypt(iv, plaintext, None)
    return iv + ciphertext_and_tag


def decrypt_bytes(payload: bytes) -> bytes:
    if len(payload) < IV_BYTES + TAG_BYTES:
        _crypto_error()
    iv = payload[:IV_BYTES]
    ciphertext_and_tag = payload[IV_BYTES:]
    try:
        return AESGCM(load_key()).decrypt(iv, ciphertext_and_tag, None)
    except InvalidTag:
        _crypto_error()
    except Exception:
        _crypto_error()
    raise AssertionError("unreachable")


def write_encrypted_json(path: Path | str, value: Any) -> None:
    target = safe_path(path, must_be_inside=STORAGE_DIR)
    target.parent.mkdir(parents=True, exist_ok=True)
    plaintext = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )
    target.write_bytes(encrypt_bytes(plaintext))
    try:
        target.chmod(0o600)
    except OSError:
        pass


def read_encrypted_json(path: Path | str) -> Any:
    target = safe_path(path, must_be_inside=STORAGE_DIR)
    try:
        plaintext = decrypt_bytes(target.read_bytes())
        return json.loads(plaintext.decode("utf-8"))
    except FileNotFoundError:
        raise
    except (json.JSONDecodeError, UnicodeDecodeError):
        _crypto_error()


def secure_delete(path: Path | str) -> None:
    target = safe_path(path, must_be_inside=STORAGE_DIR)
    if not target.exists():
        return
    if not target.is_file():
        _security_error()

    size = target.stat().st_size
    with target.open("r+b") as handle:
        if size > 0:
            handle.write(os.urandom(size))
            handle.flush()
            os.fsync(handle.fileno())
    target.unlink()
