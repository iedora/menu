# Secrets

> One-line purpose: where every credential in the project lives, how to
> rotate it, and what breaks when it's gone.
> **Last reviewed:** 2026-05-16.

## Model

| Location | Holds | Why |
|---|---|---|
| **Bitwarden Secrets Manager** (`meta-menu` project) | All 8 production secrets | Single source of truth; survives laptop loss |
| `products/menu/infra/.env` (gitignored, on one laptop) | `BWS_ACCESS_TOKEN` + `BWS_PROJECT_ID` + non-secret IDs (account/zone/hostnames) | The one credential that unlocks the rest — must be on disk to bootstrap |
| `products/menu/infra/tofu/terraform.tfstate` (encrypted) | Tunnel token + R2 sub-tokens (`assets_r2`, `backups_r2`) for the menu product | Created by Tofu; rotate via `tofu apply -replace=<resource>` |
| `products/house/infra/tofu/terraform.tfstate` (encrypted) | Narrow `pages_deploy` token (Pages·Write only) for `wrangler pages deploy` | Created by Tofu; rotate via `tofu apply -replace=cloudflare_api_token.pages_deploy` |

`BWS_ACCESS_TOKEN` is the keys-to-the-kingdom: it unlocks every other secret. Treat it as if it were the master password.

## Token tiers — bootstrap vs workload

The Cloudflare credentials follow a two-tier pattern, deliberately:

1. **Bootstrap token** — one token, in BWS (`CLOUDFLARE_API_TOKEN`). Categories it can touch: Tunnel · DNS · R2 · Pages · API-Tokens · Account-Read. This is what `tofu apply` itself authenticates with. It *has* to exist (chicken/egg — Tofu can't provision the credential it logs in with) and it *has* to be admin-ish for the categories the `.tf` files touch. The narrowing here is "permissions Tofu needs to manage *this* infra," not "all account."

2. **Workload tokens** — many, Tofu-managed, surfaced as sensitive outputs:
   - `cloudflare_api_token.assets_r2` (in `tofu/menu/`) — R2 Bucket Item Write, scoped to **one bucket** (the assets bucket). Consumed by the menu app for uploads.
   - `cloudflare_api_token.backups_r2` (in `tofu/menu/`) — R2 Bucket Item Write, scoped to **one bucket** (the backups bucket). Consumed by the backups accessory.
   - `cloudflare_api_token.pages_deploy` (in `tofu/iedora-com/`) — Pages Write only (no R2, no Tunnel, no DNS). Consumed by `wrangler pages deploy` in `just house::deploy`.

The point: **runtime tools never authenticate with the bootstrap.** If wrangler leaks a token, the worst outcome is "someone redeploys iedora.com." If the menu app leaks its R2 token, the worst outcome is "someone overwrites objects in the assets bucket." None of those leak surfaces include "rewrite DNS" or "destroy the tunnel" or "mint new tokens."

**Rotation** is one resource at a time: `tofu -chdir=tofu/<root> apply -replace=cloudflare_api_token.<name>`. CF generates a new value, Tofu state captures it, the next `just menu::deploy*` picks it up via `tofu output`. The bootstrap is rotated separately in the CF dashboard.

**Adding a workload**: copy the pattern — `cloudflare_api_token "X"` resource with a narrow `permission_groups` list (the UUID is stable, found via `curl -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/user/tokens/permission_groups`), surface as a sensitive output, consume via `tofu output -raw` at runtime.

## The 8 secrets in BWS

| Key | What it does | Impact of leak | Rotation effort |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Master Cloudflare API token (5 scopes: Tunnel, DNS, R2, Account Read, API Tokens) | Attacker can edit DNS, manage tunnel, write to R2, mint new tokens | Browser create-new → BWS edit → revoke old. Sub-tokens (tunnel/R2) survive; rotate them separately only if suspected leaked |
| `STATE_PASSPHRASE` | Tofu state encryption (PBKDF2 + AES-GCM) | Old state file becomes decryptable if attacker has the file | `tofu init -migrate-state` with new passphrase |
| `BETTER_AUTH_SECRET` | Signs Better Auth sessions | Attacker can forge sessions for any user | `just menu::rotate-secret BETTER_AUTH_SECRET` — **invalidates every active session** |
| `POSTGRES_PASSWORD` | Postgres root + app DB password | Full DB read/write | `just menu::rotate-secret POSTGRES_PASSWORD` + reboot postgres accessory + redeploy app |
| `MINIO_ROOT_PASSWORD` | MinIO root + app's S3 secret | Full asset bucket access | `just menu::rotate-secret MINIO_ROOT_PASSWORD` + reboot minio accessory + redeploy app |
| `BACKUP_PASSPHRASE` | GPG passphrase for encrypted Postgres dumps in R2 | Attacker with R2 access can decrypt past dumps | **Don't rotate** — invalidates historical dumps. Maintain dual-passphrase overlap if necessary |
| `GHCR_TOKEN` | GitHub PAT (`write:packages`) for image push/pull | Attacker can push malicious images to `ghcr.io/eduvhc/meta-menu` | GitHub UI regenerate + BWS edit + redeploy |

## "I think it leaked — what now?"

For any of the rotatable ones (everything except `BACKUP_PASSPHRASE`):

```bash
just menu::rotate-secret BETTER_AUTH_SECRET   # or whatever
```

The recipe prompts for the new value (no echo), updates BWS, and reminds you to `just menu::deploy` to roll the new value out — Kamal re-reads `.kamal/secrets` (which fetches from BWS via the `bitwarden-sm` adapter) on every deploy, so the rotated value lands in the container env on the next image swap.

For `CLOUDFLARE_API_TOKEN` rotation: sub-tokens (tunnel + R2) are independent credentials once created by Tofu — they keep working when the master rotates. Only rotate the sub-tokens if you suspect they're individually compromised. The one-liners:

```bash
# Rotate the R2 sub-token (after suspecting R2 keys leaked, e.g. via backup logs):
bin/with-secrets tofu -chdir=tofu apply -replace=cloudflare_api_token.backups_r2

# Rotate the tunnel (after suspecting the tunnel token leaked; ~30-60s public blip):
cd kamal && kamal accessory stop cloudflared && cd ..
bin/with-secrets tofu -chdir=tofu apply -replace=cloudflare_zero_trust_tunnel_cloudflared.menu
cd kamal && kamal accessory reboot cloudflared
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
