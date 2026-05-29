#!/usr/bin/env bash
# Mac → Beelink one-shot deploy. Idempotent — re-correr safely.
#
#   1. valida pré-requisitos (kamal, tofu, sops, gh, age key, secrets file)
#   2. `tofu apply -auto-approve` (no-op se nada mudou)
#   3. detecta cold deploy (postgres ainda não up) ou hot
#   4. `kamal -c "$KAMAL_CONFIG" deploy` (build cache hit → fast no-op; push é no-op se digest igual)
#   5. se cold → re-corre `kamal -c "$KAMAL_CONFIG" deploy` para aplicar migrations skipadas
#   6. smoke check `https://iedora.com/up`
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOFU_DIR="$SCRIPT_DIR/tofu"
KAMAL_CONFIG="infra/live/kamal/deploy.yml"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# ─── Cores ──────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD=$'\e[1m'; RED=$'\e[31m'; GRN=$'\e[32m'; YEL=$'\e[33m'; RST=$'\e[0m'
else
  BOLD=''; RED=''; GRN=''; YEL=''; RST=''
fi
step() { printf '%s▶ %s%s\n' "$BOLD" "$1" "$RST"; }
ok()   { printf '%s✓ %s%s\n' "$GRN" "$1" "$RST"; }
warn() { printf '%s! %s%s\n' "$YEL" "$1" "$RST"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$1" "$RST" >&2; exit 1; }

# ─── 1. Pré-requisitos ──────────────────────────────────────────────
step "Validar pré-requisitos"

for bin in kamal tofu sops gh docker base64 curl ssh; do
  command -v "$bin" >/dev/null 2>&1 || die "$bin não está instalado"
done

[[ -f "$HOME/.config/sops/age/keys.txt" ]] \
  || die "age key em falta: ~/.config/sops/age/keys.txt"

[[ -f "$HOME/.config/iedora/secrets.sops.yaml" ]] \
  || die "SOPS secrets em falta: ~/.config/iedora/secrets.sops.yaml"

gh auth status >/dev/null 2>&1 \
  || die "gh não autenticado — corre: gh auth login"

[[ -f "$TOFU_DIR/terraform.tfvars" ]] \
  || die "infra/live/tofu/terraform.tfvars em falta — copia de terraform.tfvars.example"

[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] \
  || die "export CLOUDFLARE_API_TOKEN (Zone:Read, DNS:Edit, Tunnel:Edit)"

ok "pré-requisitos OK"

# ─── 2. Tofu (CF tunnel + DNS) ──────────────────────────────────────
step "Tofu apply (Cloudflare)"
(
  cd "$TOFU_DIR"
  [[ -d .terraform ]] || tofu init -input=false
  tofu apply -auto-approve -input=false
)
[[ -s "$TOFU_DIR/.tunnel-token" ]] \
  || die "tofu não escreveu infra/live/tofu/.tunnel-token (ou vazio)"
ok "tunnel + DNS reconciliados"

# ─── 3. Detectar cold vs hot ────────────────────────────────────────
HOST="$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' "$KAMAL_CONFIG" | head -1)"
[[ -n "$HOST" ]] || die "não consegui extrair host de $KAMAL_CONFIG"

SSH_KEY="$HOME/.ssh/ci_ed25519"
[[ -f "$SSH_KEY" ]] || die "SSH key em falta: $SSH_KEY"

COLD=0
if ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
       root@"$HOST" 'docker ps --format "{{.Names}}" | grep -qx iedora-web-postgres' 2>/dev/null; then
  ok "hot deploy (postgres up)"
else
  COLD=1
  warn "cold deploy detectado (postgres não up) — kamal -c "$KAMAL_CONFIG" deploy correrá 2x"
fi

# ─── 4. Kamal deploy ────────────────────────────────────────────────
step "Kamal deploy"
kamal -c "$KAMAL_CONFIG" deploy

if (( COLD )); then
  step "Cold deploy — re-correr para aplicar migrations"
  kamal -c "$KAMAL_CONFIG" deploy
fi

# ─── 5. Smoke check ─────────────────────────────────────────────────
step "Smoke check"
for i in 1 2 3 4 5; do
  if curl -fsS --max-time 5 https://iedora.com/up >/dev/null 2>&1; then
    ok "https://iedora.com/up → 200"
    ok "deploy concluído"
    exit 0
  fi
  sleep 3
done
warn "smoke check falhou após 5 tentativas — verifica logs: ssh root@$HOST 'docker logs iedora-web'"
exit 1
