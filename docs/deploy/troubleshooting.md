# Failure modes / troubleshooting

> Part of [the deploy docs](./README.md). Sibling guides: [Day 0](day-0.md) · [Day 1](day-1.md) · [Day 2](day-2.md) · [Troubleshooting](troubleshooting.md).


The ones operators are likely to hit. Most are recoverable by re-running
the affected stage; the rest have explicit recovery steps below.

### Tofu apply / destroy

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `Error: error during placement (resource_unavailable, ...)` on `hcloud_server.iedora` | Hetzner datacenter (default `fsn1`) is temporarily out of capacity for the chosen SKU (e.g. CAX11). | Wait 5–10 min, OR pass `TF_VAR_hetzner_location=nbg1` (Nuremberg) or `hel1` (Helsinki) — same EU backbone, similar latency from PT. Validated tier list in `variables.tf::hetzner_location`. |
| `Error acquiring the state lock` (HTTP 412 `PreconditionFailed`) | Previous `tofu apply` was Ctrl-C'd before releasing the R2-backend lock. Lock ID + path are in the error body. | `bin/iedora-env tofu -chdir=infra/iac/tofu force-unlock -force <LOCK_ID>`. Safe when you know the prior operation is dead (the error shows `Who:` so you can confirm). |
| `tofu destroy` reports `0 destroyed` but the Hetzner box / CF DNS / R2 buckets still exist | A previous `tofu apply` was cancelled mid-run; resources were created on the provider side but never persisted to the state file. State is empty so destroy has nothing to do. | Cleanup via API directly. Inventory: `curl ... https://api.hetzner.cloud/v1/servers`, `curl ... /accounts/$AID/r2/buckets`, `curl ... /zones/$ZID/dns_records`. Delete by ID. |
| Destroy fails: bucket DELETE returns 409 / hangs | `rclone purge` skipped (binary missing or no creds) and the R2 bucket has objects. | `brew install rclone` if missing. Re-run destroy. If buckets stay, manually `rclone purge :s3:<bucket>` with `RCLONE_S3_*` env (see `destroy-hooks.tf`). |
| `bin/iedora-env` aborts with `RSA: command not found` on tempfile line N | Older versions of iedora-env sourced `bws secret list -o env` directly; multi-line values (SSH private key) break bash quoting. | Pull latest; the helper now reads JSON + base64-decodes per key. If still hitting: `git pull && rm -rf node_modules` + re-test. |

### Stage 2 — infra (Hetzner / Cloudflare)

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `iedora.service failed because the control process exited with error code` after first apply, log says `service "X" refers to undefined volume "Y": invalid compose project` | HCL volume map key doesn't match the name referenced in the service's `volumes` list. yamlencode emits keys verbatim. | Quote hyphenated keys in `compose.tf::local.compose.volumes` — `"my-data" = { name = "my-data" }` — so the key matches the service reference. |
| All containers restart on a small env change | Older `iedora.service` ran `systemctl restart` which fires `ExecStop = docker compose down` → `ExecStart` (full down/up). | Pull latest. The unit now has `ExecReload = docker compose up -d --remove-orphans` and `sync.tf` calls `systemctl reload` instead of restart — only containers whose config actually changed are recreated. |
| BWS destroy hooks report `429 Too Many Requests` and leave 1–2 IAC_* keys behind | BWS mutating-call rate limit is ~1/s server-side. Older code fired N parallel `terraform_data.bws_sync_*` provisioners and saturated it. | Pull latest. `bws-sync` (single resource, sequential batch) replaces the per-key resources. Lingering keys: drop directly via `bws secret delete <id>`. |

### Stage 3 — app state

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `Host key verification failed` from a configurator's SSH call | Operator's `~/.ssh/known_hosts` pins a stale key for the Hetzner IP (recycled across destroy/apply). | `internal/ssh.Client` uses `UserKnownHostsFile=/dev/null + StrictHostKeyChecking=no` — pull latest. For ad-hoc `ssh root@$HOST` from the laptop: `ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@$HOST`. |
| `menu-db-migrations: connection refused` | `infra-postgres` isn't up. | `ssh root@$HOST docker ps`. If missing, `bin/iedora-env tofu -chdir=infra/iac/tofu apply`. |

### Stage 4 — deploy

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `tofu output X empty` | Stage 2 wasn't run, OR an `outputs.tf` entry was added but not applied. | `bin/iedora-env tofu -chdir=infra/iac/tofu apply`. |
| `unauthorized` from `docker pull ghcr.io/...` | `IAC_BOOTSTRAP_GHCR_TOKEN` expired OR not in scope. | Regenerate the GHCR PAT, `bws secret edit`. The configurator's `docker login` step uses `--password-stdin` so the token never appears in `docker history`. |
| `Type 'string \| undefined' is not assignable to parameter of type 'string'` in `proxy.ts` during `next build` | `noUncheckedIndexedAccess` is on; `(host ?? '').split(':')[0]` is `string \| undefined`. | `… .split(':')[0] ?? ''`. Or any guard before `houseHosts.has(host)`. |
| `iedora.com` / `menu.iedora.com` → 502 from the tunnel | `infra-web` upstream isn't running (Stage 4 didn't deploy, or container crashed). | `ssh root@$HOST docker ps` — confirm `infra-web` listed. If missing: `bin/iedora-env bin/iedora deploy menu`. |
| Hot-swap window (~150ms) where `menu.iedora.com` 502s mid-deploy | The brief alias-unbind during `docker network disconnect/connect`. | Retry the request; the alias rebinds within the second. If persistent: both `infra-web` and `infra-web-next` running means the rename never landed — rename manually. |

### CI

| Symptom | Cause | Recovery |
|---------|-------|----------|
| Any CI workflow fails with `BWS_ACCESS_TOKEN must be set in your shell` | `BWS_ACCESS_TOKEN` GH Actions secret was removed (most often by `tofu destroy` if it was Tofu-managed historically, or never set on a fresh repo). | Set it manually — one-time, survives destroy: `gh secret set BWS_ACCESS_TOKEN --repo eduvhc/iedora`. Then re-run the workflow. CI uses this token to hydrate every other secret from BWS via `bin/iedora-env`. |
| Stage 3 / 4 workflow fails with `Error loading key "/home/runner/.ssh/id_ed25519": error in libcrypto` | The SSH-key-write step couldn't read `$IAC_BOOTSTRAP_SSH_PRIVATE_KEY` from the BWS-hydrated env — usually means the BWS secret itself was deleted or never set. | `bws secret list "$BWS_PROJECT_ID"` to confirm presence; recreate with `bws secret create IAC_BOOTSTRAP_SSH_PRIVATE_KEY "$(cat ~/.ssh/id_ed25519)" "$BWS_PROJECT_ID"` if missing. |
| `[product:menu] CI` E2E run hangs / fails after long re-arrangement | Stale CI cache (e.g. node_modules, Playwright browsers) confused by a workspaces refactor. | Re-run the workflow with `gh run rerun <run-id> --failed`. If still red: bump the cache key or delete the cache via the Actions UI. |

