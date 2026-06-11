FROM node:22-slim AS base

# Install bash & curl for entrypoint script compatibility, graphicsmagick for pdf2pic, and vips-dev & build-base for sharp 
RUN apt-get update && apt-get install -y \
      bash \
      curl \
      graphicsmagick \
      libvips-dev \
      build-essential \
      pciutils \
      && apt-get clean

# All deps stage
FROM base AS deps
WORKDIR /app
ADD admin/package.json admin/package-lock.json ./
RUN npm ci

# Production only deps stage
FROM base AS production-deps
WORKDIR /app
ADD admin/package.json admin/package-lock.json ./
RUN npm ci --omit=dev

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
ADD admin/ ./
RUN node ace build

# Production stage
FROM base
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF
ARG TARGETARCH

# go-pmtiles (regional map extracts). Pinned so the CLI's stdout format stays
# in sync with parseDryRunOutput().
ARG PMTILES_VERSION=1.30.2
# Upstream releases don't ship a checksums file, so pin per-arch SHA256 here.
# When bumping PMTILES_VERSION, regenerate these with:
#   curl -fsSL <release-url> | sha256sum
ARG PMTILES_SHA256_AMD64=2cd3aa18868297fc88425038f794efdc0995e0275f4ca16fa496dd79e245a40c
ARG PMTILES_SHA256_ARM64=804cdf071834e1156af554c1a26cc42b56b9cde5a2db9c6e3653d16fb846d5fa
RUN set -eux; \
    mkdir -p /app/bin /app/cache/build; \
    case "${TARGETARCH:-amd64}" in \
      amd64) PMTILES_ARCH=x86_64; PMTILES_SHA256="${PMTILES_SHA256_AMD64}" ;; \
      arm64) PMTILES_ARCH=arm64;  PMTILES_SHA256="${PMTILES_SHA256_ARM64}" ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    TARBALL="go-pmtiles_${PMTILES_VERSION}_Linux_${PMTILES_ARCH}.tar.gz"; \
    cd /app/cache/build; \
    curl -fsSL -o "$TARBALL" \
      "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${TARBALL}"; \
    echo "${PMTILES_SHA256}  ${TARBALL}" | sha256sum -c -; \
    tar -xzf "$TARBALL" -C /app/bin pmtiles; \
    rm -f "$TARBALL"; \
    chmod +x /app/bin/pmtiles; \
    /app/bin/pmtiles version

# Labels
LABEL org.opencontainers.image.title="MONAD" \
      org.opencontainers.image.description="The MONAD Official Docker image" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="seclib" \
      org.opencontainers.image.authors="seclib" \
      org.opencontainers.image.documentation="https://github.com/seclib/monad/blob/main/README.md" \
      org.opencontainers.image.source="https://github.com/seclib/monad" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    MONAD_PROJECT_ROOT=. \
    MONAD_STORAGE_PATH=storage \
    MONAD_LOGS_PATH=logs \
    MONAD_CACHE_PATH=cache \
    MONAD_CONFIG_PATH=runtime/config \
    MONAD_MODELS_PATH=models \
    MONAD_DATA_PATH=data \
    VAULT_PATH=storage/vault \
    PMTILES_BINARY_PATH=bin/pmtiles
WORKDIR /app
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app
# Generate version.json from the VERSION build-arg so the image tag is the
# single source of truth (previously copied root package.json, which drifted
# from the tag when semantic-release did not commit the bump back).
RUN echo "{\"version\":\"${VERSION}\"}" > /app/version.json

# Copy docs, README, and runtime config defaults for access within the container
COPY admin/docs /app/docs
COPY README.md /app/README.md
RUN mkdir -p /app/defaults/config /app/defaults/adonis-config /app/runtime/config \
    && cp -R /app/config/. /app/defaults/adonis-config/
COPY config/permissions.json /app/defaults/config/permissions.json
COPY config/settings.json /app/defaults/config/settings.json

# Copy entrypoint script and ensure it's executable
COPY install/entrypoint.sh /app/bin/entrypoint.sh
RUN chmod +x /app/bin/entrypoint.sh

EXPOSE 8050
ENTRYPOINT ["/app/bin/entrypoint.sh"]
