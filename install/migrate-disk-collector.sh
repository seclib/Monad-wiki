#!/bin/bash

# MONAD — Disk Collector Migration Script
#
# Script                | MONAD Disk Collector Migration Script
# Version               | 1.0.0
# Author                | seclib
# Website               | https://github.com/seclib/monad
#
# PURPOSE:
#   One-time migration from the host-based disk info collector to the
#   disk-collector Docker sidecar. The old approach used a nohup background
#   process that wrote an external disk-info file, which was bind-mounted
#   into the admin container. This could break on host reboots when that
#   external location disappeared.
#
#   The new approach writes directly to project-local cache/monad-disk-info.json,
#   which the admin container already reads via its existing storage bind-mount.

###############################################################################
# Color Codes
###############################################################################

RESET='\033[0m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
GREEN='\033[1;32m'
WHITE_R='\033[39m'

###############################################################################
# Constants
###############################################################################

MONAD_DIR="${MONAD_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${MONAD_DIR}/compose.yml"
COMPOSE_PROJECT_NAME="monad"

###############################################################################
# Pre-flight Checks
###############################################################################

check_is_bash() {
  if [[ -z "$BASH_VERSION" ]]; then
    echo -e "${RED}#${RESET} This script must be run with bash."
    echo -e "${RED}#${RESET} Example: bash $(basename "$0")"
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Running in bash.\n"
}

check_has_sudo() {
  if sudo -n true 2>/dev/null; then
    echo -e "${GREEN}#${RESET} Sudo permissions confirmed.\n"
  else
    echo -e "${RED}#${RESET} This script requires sudo permissions."
    echo -e "${RED}#${RESET} Example: sudo bash $(basename "$0")"
    exit 1
  fi
}

check_confirmation() {
  echo -e "${YELLOW}#${RESET} This script migrates your MONAD installation from the"
  echo -e "${YELLOW}#${RESET} host-based disk info collector to the new disk-collector sidecar."
  echo -e "${YELLOW}#${RESET} It will modify compose.yml and restart the full compose stack"
  echo -e "${YELLOW}#${RESET} to drop the old external bind mount and start the disk-collector sidecar."
  echo -e "${YELLOW}#${RESET} Please ensure you have a backup of your data before proceeding.\n"

  echo -e "${RED}#${RESET} STOP: If you have customized your compose.yml or MONAD's storage setup (not common), please make these changes manually instead of using this script!\n"
  read -rp "Do you want to continue? (y/N) " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${RED}#${RESET} Aborting. No changes have been made."
    exit 0
  fi
  echo -e "${GREEN}#${RESET} Confirmation received. Proceeding with migration...\n"
}

check_docker_running() {
  if ! command -v docker &>/dev/null; then
    echo -e "${RED}#${RESET} Docker is not installed. Cannot proceed."
    exit 1
  fi
  if ! systemctl is-active --quiet docker; then
    echo -e "${RED}#${RESET} Docker is not running. Please start Docker and try again."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Docker is running.\n"
}

check_compose_file() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo -e "${RED}#${RESET} compose.yml not found at ${COMPOSE_FILE}."
    echo -e "${RED}#${RESET} MONAD does not appear to be installed or compose.yml is missing."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Found compose.yml at ${COMPOSE_FILE}.\n"
}

# Step 1: Stop old host process
stop_old_host_process() {
  local pid_file="${MONAD_DIR}/monad-collect-disk-info.pid"

  if [[ -f "$pid_file" ]]; then
    echo -e "${YELLOW}#${RESET} Stopping old collect-disk-info background process..."
    local pid
    pid=$(cat "$pid_file")
    if kill "$pid" 2>/dev/null; then
      echo -e "${GREEN}#${RESET} Process ${pid} stopped.\n"
    else
      echo -e "${YELLOW}#${RESET} Process ${pid} was not running (already stopped).\n"
    fi
    rm -f "$pid_file"
  else
    echo -e "${GREEN}#${RESET} No old collect-disk-info PID file found — nothing to stop.\n"
  fi
}

# Step 2: Backup compose.yml
backup_compose_file() {
  local backup="${COMPOSE_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  echo -e "${YELLOW}#${RESET} Backing up compose.yml to ${backup}..."
  if cp "$COMPOSE_FILE" "$backup"; then
    echo -e "${GREEN}#${RESET} Backup created at ${backup}.\n"
  else
    echo -e "${RED}#${RESET} Failed to create backup. Aborting."
    exit 1
  fi
}

# Step 3: Remove old bind-mount from admin volumes
remove_old_bind_mount() {
  if ! grep -q 'monad-disk-info\.json' "$COMPOSE_FILE"; then
    echo -e "${GREEN}#${RESET} Old storage/monad-disk-info.json bind-mount not found — already removed.\n"
    return 0
  fi

  echo -e "${YELLOW}#${RESET} Removing old storage/monad-disk-info.json bind-mount from admin volumes..."
  sed -i '/monad-disk-info\.json:\/app\/storage\/monad-disk-info\.json/d' "$COMPOSE_FILE"

  if grep -q 'monad-disk-info\.json' "$COMPOSE_FILE"; then
    echo -e "${RED}#${RESET} Failed to remove old bind-mount from compose.yml. Please remove it manually:"
    echo -e "${WHITE_R}      - storage/monad-disk-info.json:/app/storage/monad-disk-info.json${RESET}"
    exit 1
  fi

  echo -e "${GREEN}#${RESET} Old bind-mount removed.\n"
}

# Step 4: Add disk-collector service block
add_disk_collector_service() {
  if grep -q 'disk-collector:' "$COMPOSE_FILE"; then
    echo -e "${GREEN}#${RESET} disk-collector service already present in compose.yml — skipping.\n"
    return 0
  fi

  echo -e "${YELLOW}#${RESET} Adding disk-collector service to compose.yml..."

  # Insert the disk-collector service block before the top-level `volumes:` key
  awk '/^volumes:/{
    print "  disk-collector:"
    print "    image: ghcr.io/seclib/monad-disk-collector:latest"
    print "    pull_policy: always"
    print "    container_name: monad_disk_collector"
    print "    restart: unless-stopped"
    print "    volumes:"
    print "      - ${MONAD_DIR}/storage:/storage:ro  # Project-local storage dir used only for disk sizing"
    print "      - ${MONAD_DIR}/cache:/cache  # Project-local cache dir for disk metadata"
    print ""
  }
  {print}' "$COMPOSE_FILE" > "${COMPOSE_FILE}.tmp" && mv "${COMPOSE_FILE}.tmp" "$COMPOSE_FILE"

  if ! grep -q 'disk-collector:' "$COMPOSE_FILE"; then
    echo -e "${RED}#${RESET} Failed to add disk-collector service. Please add it manually before the top-level volumes: key."
    exit 1
  fi

  echo -e "${GREEN}#${RESET} disk-collector service added.\n"
}

# Step 5 — Pull new image and restart the full stack
# This will re-create the admin container and drop the old external bind, and
# also starts the new disk-collector sidecar we just added to compose.yml
restart_stack() {
  echo -e "${YELLOW}#${RESET} Pulling latest images (including disk-collector)..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" pull; then
    echo -e "${RED}#${RESET} Failed to pull images. Check your network connection."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Images pulled.\n"

  echo -e "${YELLOW}#${RESET} Restarting stack..."
  if ! docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d; then
    echo -e "${RED}#${RESET} Failed to bring the stack up."
    exit 1
  fi
  echo -e "${GREEN}#${RESET} Stack restarted.\n"
}

# Step 6: Verify
verify_disk_collector_running() {
  sleep 3
  if docker ps --filter "name=^monad_disk_collector$" --filter "status=running" --format '{{.Names}}' | grep -qx "monad_disk_collector"; then
    echo -e "${GREEN}#${RESET} disk-collector container is running.\n"
  else
    echo -e "${RED}#${RESET} disk-collector container does not appear to be running."
    echo -e "${RED}#${RESET} Check its logs with: docker logs monad_disk_collector"
    exit 1
  fi
}

# Main
echo -e "${GREEN}#########################################################################${RESET}"
echo -e "${GREEN}#${RESET}      MONAD — Disk Collector Migration Script             ${GREEN}#${RESET}"
echo -e "${GREEN}#########################################################################${RESET}\n"

check_is_bash
check_has_sudo
check_confirmation
check_docker_running
check_compose_file

echo -e "${YELLOW}#${RESET} Step 1: Stopping old host process...\n"
stop_old_host_process

echo -e "${YELLOW}#${RESET} Step 2: Backing up compose.yml...\n"
backup_compose_file

echo -e "${YELLOW}#${RESET} Step 3: Removing old bind-mount...\n"
remove_old_bind_mount

echo -e "${YELLOW}#${RESET} Step 4: Adding disk-collector service...\n"
add_disk_collector_service

echo -e "${YELLOW}#${RESET} Step 5: Pulling images and restarting stack...\n"
restart_stack

echo -e "${YELLOW}#${RESET} Step 6: Verifying disk-collector is running...\n"
verify_disk_collector_running

echo -e "${GREEN}#########################################################################${RESET}"
echo -e "${GREEN}#${RESET} Migration completed successfully!"
echo -e "${GREEN}#${RESET}"
echo -e "${GREEN}#${RESET} The disk-collector sidecar is now running and will update disk info"
echo -e "${GREEN}#${RESET} every 2 minutes. The /api/system/info endpoint will return disk data"
echo -e "${GREEN}#${RESET} after the first collector write (~5 seconds after startup)."
echo -e "${GREEN}#${RESET}"
echo -e "${GREEN}#########################################################################${RESET}\n"
