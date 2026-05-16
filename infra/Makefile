.PHONY: help deploy destroy tofu-apply logs console redeploy rollback migrate backup restore build-backup rotate-secret

# infra/.env holds non-secret config + the ONE secret on disk: BWS_ACCESS_TOKEN
# (machine-account credential for Bitwarden Secrets Manager). Every other
# secret lives in BWS and is fetched at deploy time by bin/with-secrets.
# Filename doesn't match Next.js's auto-load pattern (.env, .env.local, ...)
# AND lives outside the project root, so `bun run dev` can't see any of this.
-include .env
export

# Kamal is a Ruby gem. On Linux with `sudo gem install`, the binary lands in
# /usr/local/bin (already on PATH) and the glob below is empty — fine. On
# macOS with brew-Ruby it lands in /opt/homebrew/lib/ruby/gems/*/bin which
# isn't on PATH by default; we prepend it. rbenv/asdf paths covered too.
KAMAL_GEM_BIN := $(firstword \
  $(wildcard /opt/homebrew/lib/ruby/gems/*/bin) \
  $(wildcard /usr/local/lib/ruby/gems/*/bin) \
  $(wildcard $(HOME)/.gem/ruby/*/bin) \
  $(wildcard $(HOME)/.rbenv/versions/*/bin))

# Both Tofu and Kamal go through `bin/with-secrets`. The wrapper does a
# `bws run` (injects every BWS secret into env) and aliases STATE_PASSPHRASE
# → TF_VAR_state_passphrase so subshells inside `.kamal/secrets` that call
# `$(tofu output …)` can decrypt the encrypted Tofu state without each line
# repeating the env. Kamal still uses its own bitwarden-sm adapter for the
# app secrets it fetches itself — this wrapper just sets the parent env.
TOFU := bin/with-secrets tofu -chdir=tofu
KAMAL := bin/with-secrets sh -c 'cd kamal && $(if $(KAMAL_GEM_BIN),PATH="$(KAMAL_GEM_BIN):$$PATH" )exec kamal "$$@"' --

help:  ## Show this help
	@echo "First-time setup (once, manual):"
	@echo "  1. cp infra/.env.example infra/.env  &&  fill in non-secret config + BWS access token"
	@echo "  2. Populate Bitwarden Secrets Manager — see docs/deploy.md for the bws CLI walkthrough"
	@echo "  3. ssh-copy-id root@\$$ONPREM_HOST   (cloud VPS images ship with this; homelab needs it once)"
	@echo "  4. gh auth refresh -s write:packages    (only if you don't have a dedicated GHCR_TOKEN)"
	@echo "  5. make deploy"
	@echo ""
	@echo "  Kamal connects as root with SSH-key-only login (gem's design — server bootstrap"
	@echo "  installs Docker via get.docker.com). Use a separate sudo user for ad-hoc admin."
	@echo ""
	@echo "Deploy:"
	@echo "  make deploy                   - tofu apply + kamal setup (idempotent; works on first run and every run)"
	@echo ""
	@echo "Day-to-day:"
	@echo "  make logs                     - tail app logs"
	@echo "  make console                  - bash inside the app container"
	@echo "  make migrate                  - run migrations against current image"
	@echo "  make redeploy                 - re-pull current image, no rebuild"
	@echo "  make rollback                 - rollback to previous version"
	@echo ""
	@echo "Backups:"
	@echo "  make backup                   - force a pg_dump now (cron runs daily anyway)"
	@echo "  make restore                  - restore latest dump (interactive)"
	@echo "  make build-backup             - rebuild + push the backup image"
	@echo ""
	@echo "Maintenance:"
	@echo "  make rotate-secret KEY=...    - rotate one BWS secret (prompts for new value, redeploys)"
	@echo "  Sub-token rotation (R2, tunnel): tofu apply -replace=<resource> (rare, see docs/secrets.md)"
	@echo ""
	@echo "Teardown:"
	@echo "  make destroy                  - remove Cloudflare tunnel + DNS (does not touch the box)"

# `kamal setup` internally does: server bootstrap + accessory boot all + deploy.
# Each step is idempotent on already-set-up boxes (~10s no-op overhead vs plain
# `kamal deploy`). Tradeoff: accessory boot SKIPS containers that already exist
# even when Exited — if cloudflared has a stale tunnel token after `make
# destroy`, run `kamal accessory reboot cloudflared` once.
deploy: tofu-apply  ## Build + push + deploy (idempotent; first-time + every-other-time)
	$(KAMAL) setup

tofu-apply:
	@$(TOFU) init -upgrade -input=false >/dev/null
	$(TOFU) apply -auto-approve

destroy:  ## Tofu destroy: removes Cloudflare tunnel + DNS only
	$(TOFU) destroy -auto-approve

# Rotate a single Bitwarden secret: prompt for the new value, edit it in
# BWS, then `kamal redeploy` so the container env picks up the change.
# Usage:  make rotate-secret KEY=BETTER_AUTH_SECRET
# Caveats: rotating BETTER_AUTH_SECRET invalidates every session; rotating
# POSTGRES_PASSWORD/MINIO_ROOT_PASSWORD also needs the accessory rebooted
# (run `kamal accessory reboot <name>` after).
rotate-secret:  ## Rotate one BWS secret. Usage: make rotate-secret KEY=BETTER_AUTH_SECRET
	@[ -n "$(KEY)" ] || { echo "Usage: make rotate-secret KEY=BETTER_AUTH_SECRET"; exit 1; }
	@SECRET_ID=$$(bws secret list "$(BWS_PROJECT_ID)" -o json | jq -r '.[] | select(.key=="$(KEY)") | .id'); \
	  [ -n "$$SECRET_ID" ] || { echo "No BWS secret named $(KEY) in project"; exit 1; }; \
	  printf "New value for $(KEY) (no echo): "; \
	  stty -echo; read -r NEW; stty echo; printf "\n"; \
	  [ -n "$$NEW" ] || { echo "Empty value, aborting"; exit 1; }; \
	  bws secret edit "$$SECRET_ID" --value "$$NEW" -o none && \
	  echo "✓ $(KEY) rotated in BWS"; \
	  echo "→ run 'make redeploy' to roll the new value out to the app container"

logs:      ; $(KAMAL) app logs -f
console:   ; $(KAMAL) app exec --interactive --reuse bash
redeploy:  ; $(KAMAL) redeploy
rollback:  ; $(KAMAL) rollback
migrate:   ; $(KAMAL) app exec --reuse "node scripts/migrate.mjs"
backup:    ; $(KAMAL) accessory exec backups --reuse "sh /backup.sh"  ## Force a pg_dump now
restore:   ; $(KAMAL) accessory exec backups --interactive --reuse "sh /restore.sh"  ## Restore latest dump

# Build + push the backup accessory image. Uses GHCR_TOKEN from BWS if
# present (read-only fetch), else falls back to `gh auth token`.
build-backup:  ## Build + push ghcr.io/$GHCR_USER/meta-menu-backup:18
	@TOKEN=$$($(WS) sh -c 'printf "%s" "$${GHCR_TOKEN:-$$(gh auth token)}"') && \
	  echo "Logging into GHCR..." && \
	  printf "%s" "$$TOKEN" | docker login ghcr.io -u "$(GHCR_USER)" --password-stdin
	@echo "Building + pushing ghcr.io/$(GHCR_USER)/meta-menu-backup:18..."
	docker buildx build \
	  --platform linux/amd64 \
	  --tag "ghcr.io/$(GHCR_USER)/meta-menu-backup:18" \
	  --push \
	  backup
