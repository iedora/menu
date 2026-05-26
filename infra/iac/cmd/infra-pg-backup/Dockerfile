# infra-pg-backup — encrypted Postgres backup container.
#
# Multi-stage: golang:alpine builder → postgres-based runtime that
# bundles pg_dump / pg_dumpall / pg_restore / psql + gpg + tini.
#
# Build context: REPO ROOT (not infra/). arm64-only because the only
# runtime is the Hetzner CAX box (Ampere arm64) — CI never pulls
# this image, so amd64 is wasted bytes:
#
#   docker buildx build \
#     --platform linux/arm64 \
#     -f infra/iac/cmd/infra-pg-backup/Dockerfile \
#     -t ghcr.io/eduvhc/infra-pg-backup:18 \
#     --push .
#
# Tag `:18` tracks the postgres major the runtime is built FROM. Bump
# the postgres tag below + the image tag together when upgrading.
# CVE-2025-8715 (pg_dump newline → RCE on restore) is fixed in 18.2+.

FROM golang:1.26-alpine AS builder
WORKDIR /src
# No go.sum — the module has zero external deps (every import is
# internal under `github.com/eduvhc/iedora/`), so `go mod download`
# resolves nothing and never writes a sum file.
COPY go.mod ./
COPY internal ./internal
COPY infra/iac/cmd/infra-pg-backup ./infra/iac/cmd/infra-pg-backup
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /infra-pg-backup ./infra/iac/cmd/infra-pg-backup

# Tag-only reference (no `@sha256:` pin) — SHA-pinned bases lock to a
# specific manifest blob, which is per-arch in a multi-arch image, and
# leaks amd64-only binaries (tini, gnupg) into an arm64 host.
FROM postgres:18.4-alpine

RUN apk add --no-cache gnupg tini

COPY --from=builder /infra-pg-backup /infra-pg-backup

LABEL org.opencontainers.image.source="https://github.com/eduvhc/iedora"
LABEL org.opencontainers.image.title="infra-pg-backup"
LABEL org.opencontainers.image.description="Encrypted Postgres backup → S3 (R2) with GPG passphrase."

# pg_dump + gpg don't need root. The postgres base image already
# ships a `postgres` user (uid 70). Drop privileges so a bug or a
# malicious dump can't write where the base image protects.
USER postgres

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/infra-pg-backup"]
