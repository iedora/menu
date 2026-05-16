# Secrets

> One-line purpose: where every credential in the project lives, how to
> rotate it, and what breaks when it's gone.
> **Last reviewed:** 2026-05-16.

## Model

| Location | Holds | Why |
|---|---|---|
| **Bitwarden Secrets Manager** (`meta-menu` project) | All 8 production secrets | Single source of truth; survives laptop loss |
| `infra/.env` (gitignored, on one laptop) | `BWS_ACCESS_TOKEN` + `BWS_PROJECT_ID` + non-secret IDs (account/zone/hostnames) | The one credential that unlocks the rest — must be on disk to bootstrap |
| `infra/tofu/terraform.tfstate` (gpg-encrypted) | Cloudflare tunnel token (`tunnel_token` output), R2 sub-token (`r2_access_key_id`, `r2_secret_access_key` outputs) | Created by Tofu; rotate via `tofu apply -replace=<resource>` |

`BWS_ACCESS_TOKEN` is the keys-to-the-kingdom: it unlocks every other secret. Treat it as if it were the master password.

## The 8 secrets in BWS

| Key | What it does | Impact of leak | Rotation effort |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Master Cloudflare API token (5 scopes: Tunnel, DNS, R2, Account Read, API Tokens) | Attacker can edit DNS, manage tunnel, write to R2, mint new tokens | Browser create-new → BWS edit → revoke old. Sub-tokens (tunnel/R2) survive; rotate them separately only if suspected leaked |
| `STATE_PASSPHRASE` | Tofu state encryption (PBKDF2 + AES-GCM) | Old state file becomes decryptable if attacker has the file | `tofu init -migrate-state` with new passphrase |
| `BETTER_AUTH_SECRET` | Signs Better Auth sessions | Attacker can forge sessions for any user | `make rotate-secret KEY=BETTER_AUTH_SECRET` — **invalidates every active session** |
| `POSTGRES_PASSWORD` | Postgres root + app DB password | Full DB read/write | `make rotate-secret` + reboot postgres accessory + redeploy app |
| `MINIO_ROOT_PASSWORD` | MinIO root + app's S3 secret | Full asset bucket access | `make rotate-secret` + reboot minio accessory + redeploy app |
| `BACKUP_PASSPHRASE` | GPG passphrase for encrypted Postgres dumps in R2 | Attacker with R2 access can decrypt past dumps | **Don't rotate** — invalidates historical dumps. Maintain dual-passphrase overlap if necessary |
| `GHCR_TOKEN` | GitHub PAT (`write:packages`) for image push/pull | Attacker can push malicious images to `ghcr.io/eduvhc/meta-menu` | GitHub UI regenerate + BWS edit + redeploy |

## "I think it leaked — what now?"

For any of the rotatable ones (everything except `BACKUP_PASSPHRASE`):

```bash
make rotate-secret KEY=BETTER_AUTH_SECRET   # or whatever
```

The Makefile target prompts for the new value (no echo), updates BWS, and reminds you to `make redeploy`.

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
3. Replace `BWS_ACCESS_TOKEN=` in `infra/.env`

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

All live in `infra/.env` next to the BWS access token.

## When designing rotation for a new credential

The mature 2026 patterns ranked by maturity:

1. **Workload Identity Federation / OIDC** (Tier 3) — preferred when the destination supports it. Currently only GitHub Actions → Cloudflare/AWS/GCP works for us; we don't deploy from Actions.
2. **Just-in-time / dynamic secrets** (Tier 2) — HashiCorp Vault or AWS IAM-auth-for-RDS. Overkill for one homelab box.
3. **Long-lived in vault + scheduled rotation** (Tier 1) — what we do. BWS + `make rotate-secret`.
4. **Hardware-backed roots** (Tier 4) — only for the root credential. `BWS_ACCESS_TOKEN` could move to macOS Keychain if you specifically worry about laptop-file-read attacks.

For new secrets: default to Tier 1 unless the consumer service supports something better.
