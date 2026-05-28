#!/usr/bin/env bash
# Util: cria um PAT via Gitea API. Idempotent — revoga PAT existente
# com mesmo nome antes de criar (rotação limpa). Stdout = valor do PAT.
#
# Genérico — qualquer consumer pode usar (ex: `home-infra/iedora/`
# para gerar `IEDORA_GIT_PAT` automaticamente em vez de manual).
#
# Uso:
#   GITEA_URL=https://git.example.com \
#   GITEA_USER=alice \
#   GITEA_PASSWORD=*** \
#   TOKEN_NAME=my-deploy-key \
#   TOKEN_SCOPES=read:repository,write:package \
#     ./create-token.sh
#
# Output: PAT value em stdout (capturar em var).

set -euo pipefail
: "${GITEA_URL:?must be set}"
: "${GITEA_USER:?must be set}"
: "${GITEA_PASSWORD:?must be set}"
: "${TOKEN_NAME:?must be set}"
: "${TOKEN_SCOPES:?must be set (comma-separated)}"

AUTH=(-u "$GITEA_USER:$GITEA_PASSWORD")
[ -n "${GITEA_OTP:-}" ] && AUTH+=(-H "X-Gitea-OTP: $GITEA_OTP")

# Revoke if exists (idempotent). 404 e 204 ambos OK.
curl -fsS -o /dev/null -X DELETE "${AUTH[@]}" \
  "$GITEA_URL/api/v1/users/$GITEA_USER/tokens/$TOKEN_NAME" 2>/dev/null || true

SCOPES_JSON=$(echo "$TOKEN_SCOPES" | jq -R 'split(",")|map(ltrimstr(" ")|rtrimstr(" "))')

PAT=$(curl -fsS "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$TOKEN_NAME\",\"scopes\":$SCOPES_JSON}" \
  "$GITEA_URL/api/v1/users/$GITEA_USER/tokens" | jq -r '.sha1')

[ -n "$PAT" ] && [ "$PAT" != "null" ] || { echo "create-token: failed for $TOKEN_NAME" >&2; exit 1; }
echo "$PAT"
