# Secrets

> One-line purpose: where every credential in the project lives, how to
> rotate it, and what breaks when it's gone.
> **Last reviewed:** 2026-05-16 — house migrated off Cloudflare Pages onto
> Workers Static Assets; this doc tracks the new surface.

## Model

| Location | Holds | Why |
|---|---|---|
| **Bitwarden Secrets Manager** (`meta-menu` project) | All 8 production secrets | Single source of truth; survives laptop loss |
| `products/menu/infra/.env` (gitignored, on one laptop) | `BWS_ACCESS_TOKEN` + `BWS_PROJECT_ID` + non-secret IDs (account/zone/hostnames) | The one credential that unlocks the rest — must be on disk to bootstrap |
| `products/menu/infra/tofu/terraform.tfstate` (encrypted) | Tunnel token + R2 sub-tokens (`assets_r2`, `backups_r2`) for the menu product | Created by Tofu; rotate via `tofu apply -replace=<resource>` |
| `products/house/infra/tofu/terraform.tfstate` (encrypted) | Narrow `workers_deploy` token (Workers Scripts: Write + DNS: Write) for `wrangler deploy` | Created by Tofu; rotate via `tofu apply -replace=cloudflare_api_token.workers_deploy` |

`BWS_ACCESS_TOKEN` is the keys-to-the-kingdom: it unlocks every other secret. Treat it as if it were the master password.

## Token tiers — bootstrap vs workload

The Cloudflare credentials follow a two-tier pattern, deliberately:

1. **Bootstrap token** — one token, in BWS (`CLOUDFLARE_API_TOKEN`). Categories it must hold (any new workload token's `permission_groups` is a subset of this — Cloudflare won't let a parent grant what it lacks). The current set, as of the Workers migration:

   **Account scope** (`Eduardoferdcarvalho@gmail.com's Account`):

   | Category | Why it's on the bootstrap |
   |---|---|
   | `Workers Scripts: Edit` | Granted onto `workers_deploy` (house) for asset upload. |
   | `Workers R2 Storage: Edit` | Granted onto menu's `assets_r2` and `backups_r2` sub-tokens. |
   | `Cloudflare Tunnel: Edit` | Used by menu's `tofu` to provision the tunnel + cloudflared accessory creds. |
   | `Account Settings: Read` | Various data sources / sanity reads. |

   **Zone scope** (scoped to `iedora.com` only — not wildcarded across all zones):

   | Category | Why it's on the bootstrap |
   |---|---|
   | `Workers Routes: Edit` | Granted onto `workers_deploy` so wrangler can bind the apex custom domain. |
   | `DNS: Edit` | Granted onto workload tokens that touch DNS; also used directly by menu's `tofu` for tunnel DNS records (same `iedora.com` zone serves both apex + subdomains). |

   **User scope** (`All users`):

   | Category | Why it's on the bootstrap |
   |---|---|
   | `API Tokens: Edit` | Required to create / replace / rotate every workload token resource. |

   Total: 7 permission groups. What the bootstrap **no longer needs** (vs. the Pages-era setup) — removed during the post-deploy contract phase:
   - `Cloudflare Pages: Edit` — Pages gone.
   - `Account Filter Lists: Edit` and `Account Rulesets: Edit` — the Bulk Redirect that bounced *.pages.dev → iedora.com is gone (`workers_dev = false` closes the leak directly).

   The bootstrap *has* to exist (chicken/egg — Tofu can't provision the credential it logs in with) and it *has* to be admin-ish for the categories the `.tf` files touch. The narrowing here is "permissions Tofu needs to manage *this* infra," not "all account."

2. **Workload tokens** — many, Tofu-managed, surfaced as sensitive outputs:
   - `cloudflare_api_token.assets_r2` (in `products/menu/infra/tofu/menu/`) — R2 Bucket Item Write, scoped to **one bucket** (the assets bucket). Consumed by the menu app for uploads.
   - `cloudflare_api_token.backups_r2` (in `products/menu/infra/tofu/menu/`) — R2 Bucket Item Write, scoped to **one bucket** (the backups bucket). Consumed by the backups accessory.
   - `cloudflare_api_token.workers_deploy` (in `products/house/infra/tofu/`) — Workers Scripts: Edit (account) + Workers Routes: Edit (zone) + DNS: Edit (zone). Consumed by `wrangler deploy` in `just house::deploy`. NOTE: the resource carries `lifecycle { ignore_changes = [policies] }` to work around a cloudflare/cloudflare v5 provider bug that reports policies in non-deterministic order on every refresh.

The point: **runtime tools never authenticate with the bootstrap.** If wrangler leaks a token, the worst outcome is "someone redeploys iedora.com and twiddles DNS records." If the menu app leaks its R2 token, the worst outcome is "someone overwrites objects in the assets bucket." None of those leak surfaces include "destroy the tunnel" or "mint new tokens."

**Rotation** is one resource at a time: `tofu -chdir=tofu/<root> apply -replace=cloudflare_api_token.<name>`. CF generates a new value, Tofu state captures it, the next `just <product>::deploy` picks it up via `tofu output`. The bootstrap is rotated separately in the CF dashboard.

**Adding a workload**: copy the pattern — `cloudflare_api_token "X"` resource with a narrow `permission_groups` list (the UUID is stable, found via `curl -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/user/tokens/permission_groups`), surface as a sensitive output, consume via `tofu output -raw` at runtime. Whatever permission groups you reference must already be on the bootstrap — if you're adding a new category (e.g. Workers KV, Hyperdrive), grant it to the bootstrap first.

## The 8 secrets in BWS

| Key | What it does | Impact of leak | Rotation effort |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Master Cloudflare API token (7 permission groups across Account / Zone(`iedora.com`) / User scopes — see Token tiers above) | Attacker can edit `iedora.com` DNS, manage the tunnel, write to R2, push Workers, mint new tokens | Browser create-new → BWS edit → revoke old. Sub-tokens (tunnel/R2/workers_deploy) survive; rotate them separately only if suspected leaked |
| `STATE_PASSPHRASE` | Tofu state encryption (PBKDF2 + AES-GCM) | Old state file becomes decryptable if attacker has the file | `tofu init -migrate-state` with new passphrase |
| `BETTER_AUTH_SECRET` | Signs Better Auth sessions | Attacker can forge sessions for any user | `just menu::rotate-secret BETTER_AUTH_SECRET` — **invalidates every active session** |
| `POSTGRES_PASSWORD` | Postgres root + app DB password | Full DB read/write | `just menu::rotate-secret POSTGRES_PASSWORD` + reboot postgres accessory + redeploy app |
| `MINIO_ROOT_PASSWORD` | MinIO root + app's S3 secret | Full asset bucket access | `just menu::rotate-secret MINIO_ROOT_PASSWORD` + reboot minio accessory + redeploy app |
| `BACKUP_PASSPHRASE` | GPG passphrase for encrypted Postgres dumps in R2 | Attacker with R2 access can decrypt past dumps | **Don't rotate** — invalidates historical dumps. Maintain dual-passphrase overlap if necessary |
| `GHCR_TOKEN` | GitHub PAT (`write:packages`) for image push/pull | Attacker can push malicious images to `ghcr.io/eduvhc/meta-menu` | GitHub UI regenerate + BWS edit + redeploy |

## Expand–Contract for permission / token changes

The same pattern database migrations use to rename a column without taking
the app down: **never remove the old surface in the same step that
introduces the new one**. Martin Fowler calls it [Parallel Change][];
infrastructure folks usually call it Expand–Contract or
Expand–Migrate–Contract. Three phases:

1. **Expand** — widen the surface so both the old and the new world work
   simultaneously. The system is a *superset* of what it needs to be.
2. **Migrate** — actually do the swap: deploy the new code / mint the new
   tokens / point the new DNS. Both sides remain valid during this step.
3. **Contract** — shrink the surface back down by deleting the now-unused
   legacy half.

Skipping the expand phase is the classic mistake. If you remove the old
surface *first*, the migrate step needs a permission it no longer has
(token apply) or hits a unique constraint it can't satisfy (database
rename) — and rolling back is harder than just doing the three steps.

### Worked example — the Pages → Workers bootstrap shift

Done in May 2026 when house migrated off Cloudflare Pages onto Workers
Static Assets. The bootstrap token needed `Workers Scripts: Edit` and
`Workers Routes: Edit` (new) and stopped needing `Pages: Edit`,
`Account Filter Lists: Edit`, `Account Rulesets: Edit` (old). The naive
single-edit version would have broken the cleanup apply.

| Phase | Action | What the bootstrap holds during this phase |
|---|---|---|
| **1. Expand** | Dashboard → Edit bootstrap → **add** `Workers Scripts: Edit` (account) and `Workers Routes: Edit` (zone). Leave the legacy Pages grants in place. | OLD + NEW (superset) |
| **2. Migrate** | `just house::deploy`. Tofu destroys the orphaned Pages resources (needs Pages/Filter/Ruleset grants) AND creates `workers_deploy` (needs Workers Scripts/Routes grants). Wrangler then deploys the worker + binds the apex custom domain. | OLD + NEW |
| **3. Contract** | Dashboard → Edit bootstrap → **remove** `Pages: Edit`, `Account Filter Lists: Edit`, `Account Rulesets: Edit`. | NEW only |

Each phase is independently safe: between phase 1 and phase 2 the
bootstrap holds more than it strictly needs, but nothing breaks. Between
phase 2 and phase 3 the same. Only the *transition itself* (mid-apply
with the wrong grants) would have failed, which is exactly what we're
avoiding. Two small surprises during the actual run worth recording:

- Wrangler's deploy required `Workers Routes: Edit` (not `Workers Scripts: Edit` alone) because it `GET`s `/zones/{id}/workers/routes` even when binding a custom domain. Worth adding to the workload token's policies *and* the bootstrap before phase 2 — discovered mid-apply on the live migration.
- The cloudflare/cloudflare v5 provider reports `api_token.policies` in non-deterministic order on every refresh, tripping "Provider produced inconsistent result after apply." Workaround: `lifecycle { ignore_changes = [policies] }` on the token resource (already applied in `products/house/infra/tofu/iedora.tf`). The token still works correctly in Cloudflare; Tofu just stops trying to reconcile a thing the provider can't represent stably.

### When to reach for this

Apply the same shape any time you:

- Change the permissions on a long-lived credential other tools depend on.
- Rename or replace a database column / table whose old name has live readers.
- Switch DNS targets for a hostname that has live traffic.
- Replace an environment variable that's read by multiple processes — set the
  new name, deploy the readers in waves, then drop the old name.

The cost is one extra round-trip. The benefit is you can pause or revert
at any phase boundary without leaving the system in an undefined state.

[Parallel Change]: https://www.martinfowler.com/bliki/ParallelChange.html

## "I think it leaked — what now?"

For any of the rotatable ones (everything except `BACKUP_PASSPHRASE`):

```bash
just menu::rotate-secret BETTER_AUTH_SECRET   # or whatever
```

The recipe prompts for the new value (no echo), updates BWS, and reminds you to `just menu::deploy` to roll the new value out — Kamal re-reads `.kamal/secrets` (which fetches from BWS via the `bitwarden-sm` adapter) on every deploy, so the rotated value lands in the container env on the next image swap.

For `CLOUDFLARE_API_TOKEN` rotation: sub-tokens (tunnel + R2 + workers_deploy) are independent credentials once created by Tofu — they keep working when the master rotates. Only rotate the sub-tokens if you suspect they're individually compromised. The one-liners (paths assume you're inside `products/<product>/infra/`):

```bash
# Rotate menu's R2 sub-token (suspected R2 leak, e.g. via backup logs):
cd products/menu/infra
bin/with-secrets tofu -chdir=tofu/menu apply -replace=cloudflare_api_token.backups_r2

# Rotate menu's tunnel token (~30-60s public blip):
cd products/menu/infra
cd kamal && kamal accessory stop cloudflared && cd ..
bin/with-secrets tofu -chdir=tofu/menu apply -replace=cloudflare_zero_trust_tunnel_cloudflared.menu
cd kamal && kamal accessory reboot cloudflared

# Rotate house's wrangler deploy token (suspected leak from CI/host scrollback):
cd products/house/infra
bin/with-secrets tofu -chdir=tofu apply -replace=cloudflare_api_token.workers_deploy
cd .. && just house::deploy   # picks up the new value end-to-end
```

For `BWS_ACCESS_TOKEN` itself (the bootstrap secret):

1. Bitwarden → Secrets Manager → Machine accounts → `meta-menu-deploy` → Access tokens → revoke the old one
2. Generate a new access token
3. Replace `BWS_ACCESS_TOKEN=` in `products/menu/infra/.env`

No code changes — `.kamal/secrets` and `bin/with-secrets` both pull `BWS_ACCESS_TOKEN` from env at runtime.

## Expiration discipline

| Credential | Expires | Reminder |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Every 90 days (set at token creation) | Cloudflare emails 14/7/1 days before |
| `GHCR_TOKEN` | 1 year (set at token creation) | GitHub emails 1 week before |
| `BWS_ACCESS_TOKEN` | No expiration | Rotate manually every 6-12 months |
| Everything else in BWS | No expiration | Rotate on suspicion of leak |

## Detection (more important than rotation)

Cloudflare notifications subscribed (account home → Notifications):
- **API Token Created** — disparo crítico if any new token shows up
- **API Token Deleted** — second disparo
- **Account Owner Change** — sequestro indicator
- **Two-Factor Authentication Disabled** — pre-attack pattern
- **Access Authentication Failed Events** — brute-force on dashboard login

GitHub: secret scanning is enabled by default. If you accidentally commit a token to a public repo, GitHub revokes it within minutes and emails you.

The principle: rotation is the cleanup; detection is what tells you to clean.

## The pieces that do NOT live in BWS

Configuration data — visible in DNS records or public-facing places, no security benefit to hiding:

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID` — identifiers, not credentials
- `PUBLIC_HOSTNAME` — the public URL itself
- `ONPREM_HOST` — homelab LAN IP (RFC1918)
- `GHCR_USER` — username, public

All live in `products/menu/infra/.env` next to the BWS access token.

## When designing rotation for a new credential

The mature 2026 patterns ranked by maturity:

1. **Workload Identity Federation / OIDC** (Tier 3) — preferred when the destination supports it. Currently only GitHub Actions → Cloudflare/AWS/GCP works for us; we don't deploy from Actions.
2. **Just-in-time / dynamic secrets** (Tier 2) — HashiCorp Vault or AWS IAM-auth-for-RDS. Overkill for one homelab box.
3. **Long-lived in vault + scheduled rotation** (Tier 1) — what we do. BWS + `just menu::rotate-secret`.
4. **Hardware-backed roots** (Tier 4) — only for the root credential. `BWS_ACCESS_TOKEN` could move to macOS Keychain if you specifically worry about laptop-file-read attacks.

For new secrets: default to Tier 1 unless the consumer service supports something better.
