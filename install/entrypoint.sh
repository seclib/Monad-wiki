#!/bin/sh

set -e

echo "Starting entrypoint script..."

CONFIG_DIR="${MONAD_CONFIG_PATH:-runtime/config}"

# Ensure required project-local directories exist (volumes may be freshly mounted)
mkdir -p \
  "${MONAD_STORAGE_PATH:-storage}" \
  "${MONAD_STORAGE_PATH:-storage}/kb_uploads" \
  "${MONAD_LOGS_PATH:-logs}" \
  "${MONAD_CACHE_PATH:-cache}" \
  "${MONAD_CACHE_PATH:-cache}/update-shared" \
  "${CONFIG_DIR}" \
  "${MONAD_MODELS_PATH:-models}" \
  "${MONAD_DATA_PATH:-data}" \
  "${VAULT_PATH:-storage/vault}"

if [ ! -f "${CONFIG_DIR}/permissions.json" ]; then
  if [ -f /app/defaults/config/permissions.json ]; then
    cp /app/defaults/config/permissions.json "${CONFIG_DIR}/permissions.json"
  else
    cat > "${CONFIG_DIR}/permissions.json" <<'JSON'
{
  "version": 1,
  "outbound": [
    {
      "id": "local-ollama",
      "description": "Local or LAN Ollama-compatible API.",
      "allowPrivateNetwork": true,
      "allowedHosts": ["localhost", "127.0.0.1", "::1", "host.docker.internal"],
      "allowedPorts": [11434, 1234],
      "allowUserData": true
    }
  ]
}
JSON
  fi
fi

if [ ! -f "${CONFIG_DIR}/settings.json" ]; then
  if [ -f /app/defaults/config/settings.json ]; then
    cp /app/defaults/config/settings.json "${CONFIG_DIR}/settings.json"
  else
    cat > "${CONFIG_DIR}/settings.json" <<'JSON'
{
  "project": "MONAD",
  "mode": "local-first",
  "memory": {
    "storage_path": "storage/memory",
    "index_path": "storage/db/memory_index.enc",
    "encryption": "AES-256-GCM",
    "allow_plaintext_index": false,
    "allow_external_transmission": false
  }
}
JSON
  fi
fi

if [ ! -f /app/config/vite.js ] && [ -d /app/defaults/adonis-config ]; then
  echo "AdonisJS config files are missing from /app/config; restoring image defaults..."
  mkdir -p /app/config
  cp -R /app/defaults/adonis-config/. /app/config/
fi

# Run AdonisJS migrations
echo "Running AdonisJS migrations..."
node ace migration:run --force

# Seed the database if needed
echo "Seeding the database..."
node ace db:seed

# Start background workers for all queues
echo "Starting background workers for all queues..."
node ace queue:work --all &

# Start the AdonisJS application
echo "Starting AdonisJS application..."
exec node bin/server.js
