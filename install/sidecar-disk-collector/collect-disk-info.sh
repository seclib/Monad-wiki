#!/bin/bash

# MONAD - Project-local Disk Info Collector Sidecar
#
# Reads only the project storage mount and writes JSON to project-local cache.
# It does not mount or inspect the host root filesystem.

set -euo pipefail

STORAGE_DIR="${MONAD_STORAGE_PATH:-/storage}"
CACHE_DIR="${MONAD_CACHE_PATH:-/cache}"
OUTPUT_FILE="${CACHE_DIR}/monad-disk-info.json"

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log "disk-collector sidecar starting..."
mkdir -p "$STORAGE_DIR"
mkdir -p "$CACHE_DIR"

while true; do
    STATS=$(df -P -B1 "$STORAGE_DIR" 2>/dev/null | awk 'NR==2{print $1,$2,$3,$4,$5}')
    if [[ -n "$STATS" ]]; then
        read -r dev size used avail pct <<< "$STATS"
        pct="${pct/\%/}"
        FS_JSON="[{\"fs\":\"${dev}\",\"size\":${size},\"used\":${used},\"available\":${avail},\"use\":${pct},\"mount\":\"storage\"}]"
    else
        FS_JSON="[]"
    fi

    cat > "${OUTPUT_FILE}.tmp" << EOF
{
"diskLayout": {"blockdevices":[]},
"fsSize": ${FS_JSON}
}
EOF

    mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
    log "Disk info updated successfully."
    sleep 120
done
