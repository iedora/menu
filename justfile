# Iedora monorepo — root entry point.
#
# Three flat recipes for everything you do day-to-day:
#
#   just deploy [FLAGS]       apply the infra estate (Pass 1/2/3 via Go orchestrator)
#   just deploy --destroy     tear it down (flag handled in Go — same binary, same code)
#   just deploy -d            short form of --destroy
#   just dev [FLAGS]          bring up the local dev stack (OpenTofu, no docker-compose)
#   just dev --destroy        tear the dev stack down
#   just doctor               preflight: PATH, BWS auth, bootstrap secrets present
#
# Single dispatch point per axis: the justfile passes flags straight to
# the Go binary; Go decides what to do with --destroy. No bash branching.
#
# Per-product modules below (`just house::…`). Menu has no module — its
# deploy (container + R2 + DNS) lives entirely in the shared `infra/tofu/`
# root, the dev loop lives in `infra/cmd/dev/`. Per-product Tofu
# disappeared with the iedora-data / iedora-assets bucket merge.
#
# Day-2 ops on the Hetzner box — operator-side ad-hoc SSH:
#
#   HOST=$(cd infra && bin/with-secrets tofu -chdir=tofu output -raw hetzner_ipv4)
#   ssh root@$HOST docker logs -f --tail=200 infra-<svc>           # logs
#   ssh -t root@$HOST docker exec -it infra-postgres psql -U postgres
#   ssh root@$HOST docker exec infra-backups sh /backup.sh         # pg_dump now
#   ssh -t root@$HOST docker exec -it infra-backups sh /restore.sh # restore

# `just deploy` runs the shared infra Tofu root which OWNS the menu app
# container. House (Astro on Cloudflare Workers) deploys via its own CI
# workflow (`.github/workflows/house-deploy.yml`) on push to main — no
# root-level recipe needed. For ad-hoc local house deploys, work from
# its own justfile: `cd products/house/infra && just deploy`.

# Default: list recipes.
[private]
_default:
    @just --list

# Apply (or, with --destroy, tear down) every infra resource: Hetzner VPS
# + Cloudflare R2 + DNS + GitHub Actions config + every Docker container.
# Thin shim over the Go orchestrator at `infra/cmd/iedora` — every Pass
# 1/2/3 detail, the cert-ready probe, the DNS-override CONNECT proxy
# that sidesteps the macOS NXDOMAIN cache, and the BWS write-through of
# INFRA_HOST_IP live there.
#
# Flags pass straight through to `bin/iedora deploy`:
#   -d, --destroy         tear down (same binary handles both directions)
#       --skip-init       skip leading `tofu init` (CI flag)
#       --ready-budget    cap the Zitadel /debug/ready + LE cert wait (default 6m)
[doc("apply the infra estate (--destroy / -d to tear it down)")]
deploy *FLAGS:
    @cd infra && bin/iedora deploy {{FLAGS}}

# Boot the local dev stack — everything (or a subset, via -i / --only / --except).
# Pure OpenTofu — `infra/dev/tofu/` calls the shared `infra/modules/services/*`
# modules with dev inputs (local docker daemon, host-published ports,
# LocalStack instead of R2). No docker-compose.
#
# `just dev --destroy` tears the dev stack down (was the old `just dev-down`
# recipe; folded into the Go orchestrator at `infra/cmd/dev/`).
[doc("boot the dev stack via OpenTofu (--destroy to wipe everything)")]
dev *FLAGS:
    @cd infra && go run ./cmd/dev {{FLAGS}}

# Preflight check — runs locally, no mutation. Verifies bws + tofu + ssh
# are on PATH, BWS auth works, and every required bootstrap secret is in
# the iedora-deploy project. Cheap to run before `deploy` if you're not
# sure the environment is set up.
[doc("preflight check: PATH, BWS auth, bootstrap secrets present")]
doctor:
    @cd infra && bin/iedora doctor
