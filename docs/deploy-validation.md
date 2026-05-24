# Deploy pipeline — end-to-end validation runbook

> Companion to [`infra/cmd/iedora/`](../infra/cmd/iedora/) (Go orchestrator)
> and [`docs/deploy-failure-modes.md`](deploy-failure-modes.md) (post-mortem
> catalogue). This file is the **before-you-merge runbook**: a manual
> 6-step sequence that exercises every code path the orchestrator owns —
> cold bootstrap, warm idempotence, destroy + reconverge, the DNS-race
> gate, the parallel house pipeline, and the BWS write-throughs.
>
> Run it whenever you change anything that affects how the estate is
> created or torn down (see the [Hard rule](#hard-rule) below for the
> exact paths). The sequence takes **~30–40 minutes** end-to-end and
> spins real cloud resources (Hetzner CPX22, Cloudflare R2/DNS/Workers,
> GitHub Actions config). Don't skip it on deploy-shaped changes — the
> shape of the bugs we've caught with it (CWD trap, Zitadel action-target
> DNS race, R2 bucket-empty 409) all show up only on the second cold
> cycle.

## Hard rule

After modifying any of:
- `infra/cmd/iedora/*.go`
- `infra/cmd/with-secrets/*.go`
- `infra/cmd/bws-upsert/*.go`
- `infra/cmd/zitadel-grant/*.go`
- `infra/internal/proxy/*.go`, `infra/internal/tlsprobe/*.go`, `infra/internal/r2/*.go`, `infra/internal/cloudflare/*.go`, `infra/internal/bws/*.go`
- `infra/tofu/*.tf` (especially `containers.tf`, `zitadel.tf`, `main.tf`, `hetzner.tf`, `github.tf`, `secrets.tf`)
- `infra/bin/with-secrets`, `infra/bin/iedora`, `infra/bin/bws-upsert`, `infra/bin/zitadel-grant`
- `products/*/infra/tofu/*.tf`
- `products/*/infra/justfile`

…run the full 6-step sequence below. **One failed step ⇒ do not merge.**
Unit tests (`go test ./...`) cover the SigV4 + escape rules + retry
chain in isolation; this runbook is the only thing that proves the
moving parts compose correctly against live cloud APIs.

## The sequence

Run from the repo root. Each step blocks until the previous one is `✓`.

```
task down   # 1: tear down (idempotent — works from any state)
just deploy             # 2: cold deploy (full bootstrap dance)
just deploy             # 3: warm deploy (should be a no-op)
task down   # 4: destroy from a full estate
just deploy             # 5: cold deploy AGAIN (catches state-vs-cloud drift, DNS races)
just deploy             # 6: warm deploy (final no-op check)
```

The second cold/destroy pair (steps 4–5) is the load-bearing part. It
catches:
- **DNS race** between Pass 2's `cloudflare_dns_record.menu_iedora` and
  Pass 3's `zitadel_action_target.menu_permissions` (the
  `Errors.Target.DeniedURL` flake — fix lives at `deploy.go:waitForMenuDNS`).
- **Orphan handling**: prior crashed runs may have left Hetzner/CF/GH
  resources without state entries. Step 1's destroy on an "already
  empty" state must converge cleanly.
- **House-vs-central state isolation**: a CWD bug in `bin/with-secrets`
  silently routed house's `tofu` calls at the central state until
  caught here (fix: `ORIG_PWD` passthrough in the bash wrapper +
  `os.Chdir` in the Go side).

## What each step asserts

| Step | Path exercised | Expected outcome |
|---|---|---|
| 1. destroy | `destroy.go` — state-rm zitadel+docker → R2 bucket-empty → tofu destroy → BWS scrub → known_hosts scrub → parallel house destroy | `✓ destroy complete`, `Resources: N destroyed` (N>0 from an up estate, N=0 from already-empty), `house destroy complete` |
| 2. cold deploy | `deploy.go` Pass 1 (Hetzner) → Pass 2 (placeholder Zitadel + LE cert wait) → `waitForMenuDNS` (NEW gate) → `fetchAndStoreSAKey` (SSH+docker) → Pass 3 (real Zitadel apply). House deploys in parallel. | All `Apply complete!` markers non-error, `→ Waiting for menu.iedora.com to resolve from inside iedora network` followed by `✓ menu.iedora.com resolves after Xs`, **NO `Errors.Target.DeniedURL`**, `house deploy complete` |
| 3. warm deploy | Same `deploy.go` but `saKeyPresent=true` → single apply path, no DNS gate, no SA-key fetch | Every `Apply complete!` line reads `0 added, 0 changed, 0 destroyed`. House same. Total runtime ~30–60s. |
| 4. destroy (full) | Same as #1 but from a populated state | `Resources: ~32 destroyed`, R2 buckets emptied + dropped in ≤1s each (proves `internal/r2.EmptyBucket` works against real R2), `house destroy complete` |
| 5. cold deploy #2 | Same as #2. Critical: the DNS gate must fire and Pass 3 must succeed on first try. | Same markers as #2. If `DeniedURL` appears here, the `waitForMenuDNS` budget needs tuning OR Zitadel's resolver chain changed. |
| 6. warm deploy | Same as #3. Final idempotency check. | Same as #3. |

## Verifying state + cloud after a destroy

After steps 1 and 4, the state files AND the cloud should both be empty
of iedora-managed resources. Quick post-checks (run from `infra/`):

```
# State should both be empty (zero lines).
bin/with-secrets tofu -chdir=tofu state list | wc -l
(cd ../products/house/infra && ../../../infra/bin/with-secrets tofu -chdir=tofu state list | wc -l)

# Hetzner should have no iedora-* resources.
bin/with-secrets sh -c 'HCLOUD_TOKEN=$INFRA_HCLOUD_TOKEN hcloud server list'
bin/with-secrets sh -c 'HCLOUD_TOKEN=$INFRA_HCLOUD_TOKEN hcloud firewall list'
bin/with-secrets sh -c 'HCLOUD_TOKEN=$INFRA_HCLOUD_TOKEN hcloud ssh-key list'

# Cloudflare: no iedora-* R2 buckets, no iedora-*-r2 tokens (the bootstrap
# `iedora-deploy` token must remain), no DNS records for auth/menu/obs/assets.iedora.com.
# Worker scripts: no `iedora-com`.

# GitHub: no actions vars/secrets (Tofu manages them, destroy nukes them).
gh variable list --repo eduvhc/iedora
gh secret list --repo eduvhc/iedora
```

If any of those show iedora-managed leftovers after a `✓ destroy
complete`, the destroy path has a regression — open an issue and don't
merge whatever you just changed.

## Verifying counts after a cold deploy (steps 2 + 5)

After a successful cold deploy, expect:

| State | Count | Includes |
|---|---|---|
| Central `tofu -chdir=tofu state list` | **68** | hcloud {server, firewall, ssh-key}, docker_{network, volume, container}.*, cloudflare_{r2_bucket, dns_record, r2_custom_domain, r2_bucket_cors, api_token}.*, github_actions_{secret, variable}.*, random_password.*, terraform_data.bws_sync_autogen[*], zitadel_{org, project, project_role, action_target, action_execution_*, application_oidc, machine_user, instance_member, personal_access_token}.*, null_resource.{docker_ready, iedora_admin_grants}, data.{tls_public_key.operator, zitadel_orgs.iedora}, modules postgres/zitadel/zitadel-login |
| House `tofu -chdir=tofu state list` | **3** | data.cloudflare_zone.iedora, cloudflare_workers_script.house, cloudflare_workers_custom_domain.apex |

The pass-by-pass apply summary on the orchestrator stdout reads:
```
Apply complete! Resources: 2 added, 0 changed, 0 destroyed.   (Pass 1: hcloud_ssh_key + hcloud_firewall)
Apply complete! Resources: 4 added, 0 changed, 0 destroyed.   (Pass 1 cont'd: hcloud_server + docker_ready, etc)
Apply complete! Resources: 35 added, 0 changed, 0 destroyed.  (Pass 2: containers + CF + GH + autogen)
Apply complete! Resources: 1 imported, 25 added, 0 changed, 0 destroyed.  (Pass 3: zitadel + menu_web)
```

(Exact splits between Pass 1's two apply calls vary; the cumulative
`Resources: N` for the cold deploy is the load-bearing check.)

## Common failure shapes and what they mean

| Symptom | Likely cause | Where to fix |
|---|---|---|
| Pass 1 fails: `SSH key not unique` / `name is already used` / `409 Already exists` | State is empty but cloud has orphans (probably from a prior crashed destroy). | Manually delete the orphans (see "Verifying state + cloud" above for what to inspect), then re-run. The orchestrator deliberately doesn't auto-clean — that'd be too easy to do unsafely. |
| R2 bucket destroy hangs 30s then 409s `bucket not empty` | `internal/r2.EmptyBucket` failed silently and tofu tried the bucket destroy anyway. | Read the orchestrator's `! R2 empty failed` line. Likely the CF token lost R2 perms or the SigV4 escape rules regressed. Check `infra/internal/r2/r2_test.go` is still green. |
| Pass 3 fails: `Errors.Target.DeniedURL` on `zitadel_action_target.menu_{permissions,grants}` | `waitForMenuDNS` budget exhausted OR the probe doesn't reflect Zitadel's resolver view anymore. | Check `deploy.go:waitForMenuDNS`. The 90s budget assumes infra-caddy's nslookup matches Zitadel's resolver — true today because both inherit the host's `/etc/resolv.conf`. If that ever changes, the probe needs to move into the Zitadel container (or a `--network iedora` sidecar). |
| Warm deploy shows `N added` / `N changed` instead of `0/0/0` | Tofu plan drift. Read the plan output before the apply — usually a downstream resource attribute change cascaded from a provider upgrade. | Read the diff; commit the state + reason; do not merge until warm deploy is fully idempotent. |
| `house deploy failed: known Cloudflare transient (10007 on assets-upload-session)` | CF's assets pipeline is in a transient 500 window (see workers-sdk#11153). Not your code, not your account. | Wait 15–30 min, re-run `task up`. Tofu picks up where it left off. |

More entries in [`deploy-failure-modes.md`](deploy-failure-modes.md).

## When NOT to run this

- Pure docs / `.md` edits — no deploy code touched.
- Edits below `products/menu/src/**` (app code; covered by Vitest/Playwright in `docs/testing.md`).
- Edits to `packages/**` (workspace libraries; their own test suites cover them).
- CI workflow edits that don't touch the `*.tf` or Go orchestrator — the workflow on the next push is the validation.

For everything else listed in the [Hard rule](#hard-rule), running this
sequence is cheaper than debugging a half-broken deploy in production.
