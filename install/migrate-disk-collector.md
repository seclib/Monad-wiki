# MONAD — About the Disk Collector Migration Script

This script migrates your MONAD installation from the old host-based disk info collector to the project-local disk metadata writer. It modifies `${MONAD_DIR}/compose.yml` to add the service and remove the old bind mount, then restarts the full compose stack to apply the changes.

### Why the Migration?

The disk-collector writes metadata into `cache/monad-disk-info.json`. It removes the original direct file bind mount, which was fragile and prone to issues on host reboots.

The original host-based collector relied on a process running on the host that wrote disk info to a file, which was then read by the admin container via a bind mount. This approach had several drawbacks:

- The host process could fail or be killed, leading to stale or missing disk info.
- The bind mount to `storage/monad-disk-info.json` was cleared on host reboots, causing Docker to create a directory at the mount point instead of a file.
- Created tighter host coupling, which made portable deployment options tougher to support.

The migration script automates the necessary changes to your compose configuration and ensures a smooth transition to the new architecture.

### Why does MONAD need the monad-disk-info.json file?

MONAD uses the disk info stored and updated in `monad-disk-info.json` to allow users to view disk usage and availability within the MONAD "Command Center". While not critical to the core functionality of MONAD, it provides a more pleasant experience for users with limited storage space and/or who aren't familiar with command-line tools and Linux management.

### Why a separate container?

The disk-collector runs in a separate container to isolate its functionality from the main admin container. This separation provides several benefits:

- **Stability**: If the disk-collector encounters an issue or crashes, it won't affect the main admin container and vice versa.
- **Security**: The default MONAD stack avoids mounting the Docker daemon socket and avoids exposing the host filesystem. Keeping disk metadata in project-local storage preserves that boundary.
- **Modularity**: Because having the host disk info is not a critical component of MONAD's core functionality, isolating it in a sidecar allows users who don't need/want the disk info features to simply not run that container, without impacting the main admin container or other services. It also allows for more flexible future development of the disk-collector without needing to modify the main admin container.

### What if I don't want to run the migration script?

No worries - you can replicate the changes manually by editing your `${MONAD_DIR}/compose.yml` to add the new disk-collector service and remove the old bind mount from the admin service, then restarting your compose stack. The migration script just automates these steps and ensures they're done correctly, but the underlying changes are straightforward if you prefer to do it yourself. Just be sure to back up your `compose.yml` before making any changes.

Here's the disk-collector service configuration to add to your `compose.yml`:

```yml
disk-collector:
  image: ghcr.io/seclib/monad-disk-collector:latest
  pull_policy: always
  container_name: monad_disk_collector
  restart: unless-stopped
  volumes:
    - ./storage:/storage
```

and remove the old `monad-disk-info.json` bind mount from the admin service volumes.
