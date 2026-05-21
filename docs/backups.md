# Backups — daily Postgres dumps to Cloudflare R2

The Tofu-managed `docker_container.backups` runs a self-built `postgres:18-alpine`-based image (source: `infra/backup/`) on the same Docker network as `infra-postgres`. Daily it `pg_dumpall`s every database (menu, zitadel, anything future), GPG-encrypts the dump with `AUTOGEN_INFRA_BACKUP_PASSPHRASE` (Tofu-minted, write-through to BWS), and uploads to the `iedora-backups` R2 bucket. 14-day retention. ~€0/yr at this size (R2 free tier ≤ 10 GB + zero egress).

> **Why self-built.** The canonical `eeshugerman/postgres-backup-s3` image stops at tag `:16` upstream as of mid-2026. Postgres rejects pg_dump version mismatch outright, so a 16-client image can't dump our PG 18 server. Self-built (~40 lines bash + a 7-line Dockerfile) guarantees client/server parity. When bumping Postgres, bump the image tag in `infra/tofu/containers.tf` and rebuild via `docker buildx build --platform linux/amd64 --tag "ghcr.io/$GHCR_USER/iedora-backup:18" --push infra/backup` after `docker login ghcr.io`.

## One-time setup

The infra Tofu root provisions BOTH the `iedora-backups` R2 bucket AND its scoped S3 access keys via a single `cloudflare_api_token` resource — Cloudflare's R2 S3 API accepts a regular CF API token as credentials (Access Key ID = token ID, Secret = SHA-256(token value); [docs](https://developers.cloudflare.com/r2/api/tokens/)). The values flow directly into `docker_container.backups.env`.

Prerequisite: `INFRA_CLOUDFLARE_API_TOKEN` needs **User · API Tokens · Edit** (see `docs/deploy.md` step 3).

The GPG passphrase (`AUTOGEN_INFRA_BACKUP_PASSPHRASE`) is Tofu-minted on first apply via `random_password.backup_passphrase` and synced to BWS for human lookup. **The value lives in encrypted Tofu state — if you ever lose the state file _and_ the BWS entry, every past backup is unrecoverable.** Keep both. The committed `infra/tofu/terraform.tfstate` is your backstop.

```bash
docker buildx build --platform linux/amd64 \
  --tag "ghcr.io/$GHCR_USER/iedora-backup:18" --push infra/backup   # one-off
just deploy                                                          # mints AUTOGEN_INFRA_BACKUP_PASSPHRASE + boots backups container
HOST=$(cd infra && bin/with-secrets tofu -chdir=tofu output -raw hetzner_ipv4)
ssh root@$HOST docker exec infra-backups sh /backup.sh               # force a dump to verify end-to-end
```

Rebuild the backup image only when Postgres major changes or `infra/backup/*.sh` is edited.

## Force an on-demand backup

```bash
HOST=$(cd infra && bin/with-secrets tofu -chdir=tofu output -raw hetzner_ipv4)
ssh root@$HOST docker exec infra-backups sh /backup.sh
```

Output lands in R2 with a timestamped key like `pg/all-2026-05-15T14:30:00.sql.gpg`.

## Recovery scenarios

### Lost rows (accidental DELETE/DROP) — within 24 h

Don't whole-DB-restore over a live database. Restore into scratch, surgically copy.

```bash
# 1. Scratch postgres locally:
docker run -d --name scratch-pg -e POSTGRES_PASSWORD=x -p 5433:5432 postgres:18-alpine

# 2. Pull + decrypt the latest dump:
ssh root@$(tofu -chdir=infra/tofu output -raw hetzner_ipv4) 'docker exec -it infra-backups bash'
# Inside: aws --endpoint-url=$S3_ENDPOINT s3 cp s3://$S3_BUCKET/pg/<latest>.sql.gpg /tmp/
# Decrypt: gpg --batch --passphrase=$PASSPHRASE --decrypt /tmp/<latest>.sql.gpg > /tmp/dump

# 3. Restore into scratch:
pg_restore -h localhost -p 5433 -U postgres -d postgres /tmp/dump

# 4. Pull the lost rows:
pg_dump -h localhost -p 5433 -U postgres -t <table> --data-only > rows.sql

# 5. Insert into live:
ssh -t root@$HOST docker exec -it infra-postgres psql -U postgres
# \i rows.sql
```

### Postgres data corruption — restore over fresh DB

```bash
HOST=$(cd infra && bin/with-secrets tofu -chdir=tofu output -raw hetzner_ipv4)

INFRA_MENU_IMAGE_TAG=<known-good-sha> just deploy                    # roll back image if needed
ssh root@$HOST 'docker rm -f infra-postgres; rm -rf /root/infra-postgres'  # wipe
just deploy                                                          # boots fresh postgres + backups + menu
ssh -t root@$HOST docker exec -it infra-backups sh /restore.sh       # restore latest pg_dumpall
just deploy                                                          # menu picks up populated DB
```

Wall-clock: ~10 min for a < 1 GB dump.

### Whole VPS dies (Hetzner regional outage)

A new VPS is one `just deploy` away — Tofu provisions a fresh CPX22 via the `hcloud` provider.

```bash
just deploy --destroy          # tear down dead box's state (skip if Hetzner already removed it)
just deploy                    # provisions NEW VPS + boots every container
HOST=$(cd infra && bin/with-secrets tofu -chdir=tofu output -raw hetzner_ipv4)
ssh -t root@$HOST docker exec -it infra-backups sh /restore.sh   # restore latest dump
just deploy                    # menu picks up the now-populated DB
```

Wall-clock: ~30 min. DNS A records repoint automatically (Tofu rewrites `cloudflare_dns_record.*` to the new IPv4); user-facing hostnames stay put.

### Bad migration shipped

```bash
INFRA_MENU_IMAGE_TAG=<previous-good-sha> just deploy
# If destructive (DROP COLUMN, etc.), follow "lost rows" against yesterday's dump.
```

Drizzle migrations are forward-only; the migrator detects the DB schema is newer than the code's `drizzle/` dir and logs a warning but doesn't auto-down-migrate.

### Image uploads — Cloudflare R2

User-uploaded restaurant assets live in the `menu-assets` R2 bucket (separate from `iedora-backups`). R2 has built-in redundancy across edge regions, so the bucket is the source of truth. Enable Object Versioning on `menu-assets` via the CF dashboard for belt-and-suspenders against accidental delete.

## Beyond pg_dump

- **Sub-hour RPO** → switch to [WAL-G](https://github.com/wal-g/wal-g) or WAL archiving. Worth it past ~50 GB or when paying customers demand it.
- **Cross-region restore** → R2 is multi-region by default; storage location set via `backups_bucket_location` (default `EEUR`).
- **Belt-and-suspenders on Hetzner** → keep this accessory AND enable Hetzner Cloud Backups (€11/yr) for whole-VM rollback.
