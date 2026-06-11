# Security Policy

## Supported Use

MONAD is designed for trusted local networks, private labs, and offline-first personal deployments. It is not intended to be exposed directly to the public internet without additional access controls.

## Reporting a Vulnerability

Please do not open a public GitHub issue for security-sensitive reports.

Report vulnerabilities through GitHub Security Advisories for the `seclib/monad` repository when available. If advisories are not available, open a minimal private contact request through the maintainer channel listed on the repository profile and avoid including exploit details in public discussion.

When reporting, include:

- affected version or commit,
- affected component,
- steps to reproduce,
- impact,
- suggested mitigation if known.

## Docker Control Notice

The default MONAD Compose architecture does not mount the host Docker daemon socket into application containers. Docker control features are disabled unless a maintainer explicitly configures a restricted Docker API endpoint.

Direct Docker daemon access is equivalent to powerful host-level Docker control. Do not enable it for untrusted users or public deployments.

Practical guidance:

- keep MONAD on localhost or trusted private networks,
- keep Caddy as the only exposed service,
- do not expose the admin UI directly to the internet,
- do not grant untrusted users access to the admin UI,
- prefer the host-side updater in `install/host-updater/` for controlled update flows,
- rotate `.env` secrets before sharing a deployment,
- review Compose changes before applying updates.

## Secrets

Never commit real `.env` files, database passwords, app keys, API keys, vault contents, logs, or generated runtime storage.

Use `.env.example` as documentation only. Generate real secrets locally with:

```bash
openssl rand -base64 32
```

## Security Updates

Security fixes should be prioritized over feature work. Maintainers may release patched container images and GitHub releases when a vulnerability affects published versions.
