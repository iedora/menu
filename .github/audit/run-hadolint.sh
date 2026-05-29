#!/usr/bin/env bash
# Hadolint wrapper. Lança hadolint com JSON output, faz pipe para o
# parser TS (parse-hadolint.ts) que converte para workflow annotations.
#
# Threshold: warnings anotam mas exit=0; só level=error quebra CI.
#
# Uso: run-hadolint.sh <Dockerfile> [Dockerfile2 ...]

set -eu  # NÃO -o pipefail: hadolint exit 1 com findings (qualquer nível)

if [ $# -lt 1 ]; then
  echo "usage: $0 <Dockerfile> [...]" >&2
  exit 2
fi

HERE="$(dirname "$(readlink -f "$0")")"
/opt/audit-bin/hadolint --no-color --format json "$@" | bun "$HERE/parse-hadolint.ts"
