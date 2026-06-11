# Offline-First Mode

MONAD is designed to keep the core knowledge workflow available without internet access after setup.

## Architecture

```text
Browser
  -> MONAD admin API
  -> local filesystem vault (storage/vault)
  -> local vector cache (storage/vault/.monad-index/vectors.json)
  -> local Ollama API (OLLAMA_BASE_URL)
```

Core offline data paths:

- Markdown knowledge is stored in the Obsidian Vault.
- Attachments are stored under `storage/vault/docs/assets/`.
- Vault embeddings are cached locally in `storage/vault/.monad-index/vectors.json`.
- AI inference uses the configured local Ollama-compatible endpoint.

## Offline Configuration

Set:

```env
MONAD_OFFLINE_MODE=true
OLLAMA_BASE_URL=http://host.docker.internal:11434
VAULT_PATH=storage/vault
```

When offline mode is enabled:

- MONAD skips the external internet probe.
- Version checks use cached metadata.
- Release-note subscription calls are disabled.
- Non-local `ai.remoteOllamaUrl` values are ignored.
- Vault keyword search remains available without AI.

Allowed local AI hosts include:

- `localhost`
- `host.docker.internal`
- private LAN IPs such as `192.168.x.x`, `10.x.x.x`, `172.16.x.x`
- `.local` hostnames

## Offline Status

```http
GET /api/system/offline-status
```

The response reports:

- offline mode state
- whether the external internet probe was skipped
- local Ollama health
- Vault writability
- local vector index/cache status
- whether MONAD is ready for offline use

## Failure Handling

| Failure                                  | Behavior                                                            |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Internet unavailable                     | Core Vault, notes, docs, and local search continue working          |
| Ollama unavailable                       | `/api/vault/ask` returns matching local snippets instead of failing |
| Embeddings unavailable                   | semantic search falls back to keyword mode                          |
| Vector index missing                     | semantic search tries to rebuild from local Markdown                |
| Remote AI URL configured in offline mode | non-local URL is ignored in favor of local `OLLAMA_BASE_URL`        |
| Version/update APIs unreachable          | cached metadata is used; core app remains available                 |

## Vault Ask Fallback

When local AI is unavailable, `/api/vault/ask` returns:

```json
{
  "answer": "Local AI is unavailable, so MONAD is using offline Vault retrieval only...",
  "aiAvailable": false,
  "fallback": true,
  "sources": []
}
```

This keeps retrieval useful even when generation is not possible.
