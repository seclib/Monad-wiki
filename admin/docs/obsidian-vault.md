# Obsidian Vault

MONAD can mirror selected data into an Obsidian-compatible Markdown vault. The vault is filesystem-only, offline-first, and does not require any cloud service.

## Folder Structure

The default vault path is configured with `VAULT_PATH=storage/vault`.

```text
storage/vault/
  notes/
  docs/
    assets/
  ai/
  services/
```

- `notes/` stores local notes.
- `docs/` stores document index Markdown files.
- `docs/assets/` stores copied document attachments.
- `ai/` stores generated AI answers when saved.
- `services/` stores local service directory entries.

## API

All routes are also available with the `/api` prefix.

| Method | Path            | Purpose                                            |
| ------ | --------------- | -------------------------------------------------- |
| `GET`  | `/vault/status` | Check vault path, writability, and enabled folders |
| `GET`  | `/vault/index/status` | Check the local vector index status |
| `POST` | `/vault/index` | Rebuild or refresh the local vector index |
| `POST` | `/vault/save`   | Save a Markdown file into the vault                |
| `GET`  | `/vault/list`   | List Markdown files in the vault                   |
| `GET`  | `/vault/search` | Search Markdown content in the vault               |
| `POST` | `/vault/search/semantic` | Search Markdown content by local embeddings |
| `POST` | `/vault/ask` | Ask a question using vault content only |

### Save Markdown

```http
POST /api/vault/save
Content-Type: application/json
```

```json
{
  "folder": "notes",
  "title": "Note locale",
  "content": "Contenu Markdown...",
  "tags": ["reunion", "perso"],
  "filename": "note-locale",
  "metadata": {
    "category": "maison"
  }
}
```

Allowed folders are `notes`, `docs`, `ai`, and `services`.

### List Markdown

```http
GET /api/vault/list?folder=notes&limit=100
```

The `folder` query parameter is optional. The response is sorted by most recently updated files first.

### Search Markdown

```http
GET /api/vault/search?q=maison&limit=20
```

Search is local filesystem text search. It does not call external APIs.

## Intelligent Search

MONAD can build a local vector index for the vault. The index is stored inside the vault and remains fully offline.

```text
storage/vault/
  .monad-index/
    vectors.json
```

### Architecture

```text
Obsidian Markdown files
  -> MONAD Vault scanner
  -> Markdown chunks
  -> local Ollama embeddings
  -> storage/vault/.monad-index/vectors.json
  -> semantic search / vault ask
```

The vector index does not replace Markdown files. Obsidian remains the source of truth.

### Indexing Flow

1. MONAD scans `.md` files in `notes`, `docs`, `ai`, and `services`.
2. Markdown frontmatter is stripped from the embedding text.
3. Long files are split into smaller chunks.
4. Chunks are embedded with the configured Ollama-compatible embedding model.
5. Vectors are written to `storage/vault/.monad-index/vectors.json`.
6. Unchanged files reuse existing vectors based on file path, size, and updated timestamp.

```http
POST /api/vault/index
Content-Type: application/json
```

```json
{
  "embeddingModel": "nomic-embed-text:v1.5",
  "force": false
}
```

### Semantic Search

```http
POST /api/vault/search/semantic
Content-Type: application/json
```

```json
{
  "query": "documents administratifs pour la maison",
  "limit": 8,
  "scoreThreshold": 0.2,
  "embeddingModel": "nomic-embed-text:v1.5"
}
```

If embeddings are unavailable, MONAD falls back to keyword search and marks the response as `mode: "keyword"`.

### Ask The Vault

```http
POST /api/vault/ask
Content-Type: application/json
```

```json
{
  "question": "Quels documents dois-je préparer cette semaine ?",
  "model": "llama3.1",
  "limit": 5
}
```

MONAD retrieves matching vault snippets, sends only those snippets to the local AI model, and instructs the model to cite source file names.

## Markdown Rules

Every exported file is plain Markdown with Obsidian-friendly YAML frontmatter.

```markdown
---
title: 'Example'
date: 2026-06-11
tags: [monad, note]
source: 'MONAD'
module: 'notes'
---

Markdown body goes here.
```

Rules:

- Files must use the `.md` extension.
- `title` is always a string.
- `date` uses ISO date format.
- `tags` is always an array.
- Body content stays standard Markdown.
- Attachments are linked relatively from `docs/assets/`.
