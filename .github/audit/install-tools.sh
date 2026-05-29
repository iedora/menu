#!/usr/bin/env bash
# Restore-or-install audit binaries (gitleaks + hadolint + osv-scanner).
#
# Idempotente: cada tool só descarrega se a versão actual no cache diferir
# da pinned. Cache persiste entre runs via actions/cache@v4 keyed em
# ${GITLEAKS_VERSION}-${HADOLINT_VERSION}-${OSV_VERSION}.
#
# Cold start: ~15-20s. Cache hit: ~1s (apenas valida versões).
#
# Variáveis pinned (vêm do workflow env):
#   GITLEAKS_VERSION   default 8.30.1
#   HADOLINT_VERSION   default 2.14.0
#   OSV_VERSION        default 2.3.8

set -euo pipefail

mkdir -p /opt/audit-bin

need() {
  local bin="$1" version_flag="$2" want="$3"
  [ ! -x "/opt/audit-bin/$bin" ] && return 0
  local have
  have=$("/opt/audit-bin/$bin" "$version_flag" 2>&1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)
  [ "$have" != "$want" ]
}

if need gitleaks version "$GITLEAKS_VERSION"; then
  echo "→ download gitleaks $GITLEAKS_VERSION"
  curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    | tar -xz -C /opt/audit-bin gitleaks
fi

if need hadolint --version "$HADOLINT_VERSION"; then
  echo "→ download hadolint $HADOLINT_VERSION"
  curl -fsSL -o /opt/audit-bin/hadolint \
    "https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/hadolint-linux-x86_64"
  chmod +x /opt/audit-bin/hadolint
fi

if need osv-scanner --version "$OSV_VERSION"; then
  echo "→ download osv-scanner $OSV_VERSION"
  curl -fsSL -o /opt/audit-bin/osv-scanner \
    "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_linux_amd64"
  chmod +x /opt/audit-bin/osv-scanner
fi

/opt/audit-bin/gitleaks version
/opt/audit-bin/hadolint --version
/opt/audit-bin/osv-scanner --version
