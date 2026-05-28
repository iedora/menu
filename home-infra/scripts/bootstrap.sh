#!/usr/bin/env bash
# 1 comando para um homelab novo (ou substituição de server).
# Genérico — sem hardcodes de apps/repos. Idempotent.
#
# Pré-requisitos:
#   BWS_ACCESS_TOKEN  exportado
#   HOMELAB_HOST      ex: ssh://root@<ip>
#
# Etapas:
#   1. Server: apt deps + Kamal + BWS CLI + SSH loopback keypair
#   2. Boot home-infra services (openobserve, gitea)
#
# Setup específico de uma app (clone de source, CF tunnels, R2 buckets,
# /etc/hosts, /root/.netrc, etc.) vive na app — ex:
# `home-infra/iedora/scripts/bootstrap.sh`.

set -euo pipefail
: "${BWS_ACCESS_TOKEN:?must be set}"
: "${HOMELAB_HOST:?must be set, e.g. ssh://root@<ip>}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/.."
export HOMELAB_HOST DOCKER_HOST="$HOMELAB_HOST"

"$HERE/install-kamal.sh"
"$ROOT/openobserve/bin.sh"
"$ROOT/gitea/bin.sh"

echo
echo "✓ home-infra pronto."
echo "  Próximo: bootstrap das apps consumers (ex: home-infra/iedora/scripts/bootstrap.sh)."
