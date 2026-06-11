# Repository Structure

MONAD keeps public project files at the repository root and application code in
dedicated directories.

```text
MONAD/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── .env.example
├── .gitignore
├── docker-compose.yaml
├── Dockerfile
├── admin/
├── collections/
├── docs/
├── install/
├── scripts/
└── vault/
```

## Root Files

- `README.md`: project overview, installation summary, and common commands.
- `LICENSE`: MIT license text.
- `CONTRIBUTING.md`: contributor workflow and pull request guidance.
- `CODE_OF_CONDUCT.md`: expected community behavior.
- `SECURITY.md`: vulnerability reporting and deployment guidance.
- `.env.example`: documented environment template.
- `.gitignore`: excludes secrets, dependencies, builds, logs, and runtime data.
- `docker-compose.yaml`: local Compose stack entry point.

## Application Directories

- `admin/`: main MONAD admin application.
- `collections/`: bundled collection metadata.
- `install/`: installation, migration, and updater support scripts.

## Public Documentation

- `docs/`: repository-level documentation for GitHub users.
- `admin/docs/`: in-app documentation rendered by the admin UI.

## Runtime Data

- `vault/`: placeholder for local vault structure. Real vault contents should
  remain private and ignored by Git.
- `scripts/`: repository-level helper scripts. Keep scripts small, documented,
  and safe to run repeatedly.
