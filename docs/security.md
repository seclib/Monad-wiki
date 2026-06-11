# Security Guide

This guide summarizes practical security expectations for running MONAD.

## Intended Deployment

MONAD is designed for:

- localhost usage,
- trusted LAN usage,
- private lab environments,
- offline-first personal deployments.

Do not expose MONAD directly to the public internet without additional access
controls such as a VPN, firewall rules, and reverse proxy authentication.

## Secrets

Never commit:

- `.env`
- database passwords
- application keys
- API keys
- private vault contents
- logs
- generated runtime data

Use `.env.example` as documentation only.

Generate secrets locally:

```bash
openssl rand -base64 32
```

## Docker Control

The default MONAD stack does not mount the host Docker daemon socket into
containers. Treat any optional Docker API access as highly trusted because it
can control containers and images on the host.

For hardened deployments:

- keep Caddy as the only exposed service,
- restrict access to trusted networks,
- avoid direct admin service exposure,
- prefer host-managed update flows where possible,
- use a restricted Docker API endpoint only when Docker control is required,
- review Compose changes before running updates.

## Network Exposure

Use Caddy as the public entry point:

```text
client -> Caddy -> MONAD admin service
```

Keep internal services on Docker networks unless a host port is explicitly
required.

## Reporting Vulnerabilities

Follow the process in [SECURITY.md](../SECURITY.md). Do not publish exploit
details in public issues.
