# Runbook — dev + deploy

## Dev local

```bash
bun install
bun run dev:up           # postgres + s3mock
bun run dev:migrate      # schema nas 3 DBs (core, menu, imopush)
bun run dev              # next dev em :3000
```

Dois ficheiros em `dev/`:
- `docker-compose.yml` — Postgres + s3mock (port `:5432`, `:9090`, buckets `iedora-data`/`iedora-assets` hardcoded).
- `local.env` — runtime env (DB URLs, S3 creds, better-auth, `NEXT_PUBLIC_*`). Tracked, sem secrets. Lida por `dev:migrate` e `dev` via `set -a; . dev/local.env`.

Reset volumes: `bun run dev:reset`. Logs: `bun run dev:logs`.

## Deploy

**Auto (push a main):** `.gitea/workflows/deploy.yml` dispara em mudanças a source/Dockerfile/Kamal config. Faz `ssh root@beelink` que corre `git fetch` + `kamal deploy -d production`.

**Manual (Mac):**
```bash
ssh root@192.168.50.53 'cd /opt/iedora && git fetch && git checkout <SHA> && \
  BWS_ACCESS_TOKEN=$(bws-token) kamal deploy -d production'
```

**Rollback:**
```bash
ssh root@192.168.50.53 'cd /opt/iedora && kamal rollback <version> -d production'
```

Secrets vêm de Bitwarden Secrets Manager (`bws run` no Beelink lê via `BWS_ACCESS_TOKEN`). Kamal corre nativo no Beelink (não no runner) — build local, push localhost-to-localhost para o Gitea OCI registry.

## Ops

```bash
HOST=192.168.50.53
ssh root@$HOST docker logs -f --tail=200 iedora-web
ssh -t root@$HOST docker exec -it iedora-web-postgres psql -U postgres
ssh root@$HOST docker ps
```

## Comandos (root `package.json`)

| Comando | O que faz |
|---|---|
| `bun install` | Instala/refresca dependências de todos os workspaces (instala git hooks via `postinstall`). |
| `bun run dev` | `next dev` em `:3000` com env de `dev/local.env`. |
| `bun run dev:up` | Boot Postgres + s3mock (`docker compose up -d`). |
| `bun run dev:down` | Pára containers (mantém volumes). |
| `bun run dev:logs` | Tail dos logs do compose stack. |
| `bun run dev:reset` | Pára + apaga volumes (**perde dados locais**). |
| `bun run dev:migrate` | Aplica Drizzle migrations em sequência: `core-auth` → `menu` → `imopush`. |
| `bun run typecheck` | TS check paralelo em todos os workspaces. |
| `bun run lint` | ESLint paralelo em todos os workspaces. |
| `bun run test` | Vitest em todos os workspaces. |
| `bun run setup:mac` | Auto-setup macOS: PAT no Gitea + keychain + remote HTTPS (`scripts/setup-laptop-mac.sh`). |
| `bun run homelab:up` | Boot do homelab-core-infra (OpenObserve etc., `./homelab-core-infra/up.sh`). |
| `bun run homelab:down` | Pára homelab-core-infra. |
| `bun run homelab:logs` | Tail dos logs do homelab-core-infra. |

## Comandos (`apps/web`)

| Comando | O que faz |
|---|---|
| `bun run dev` | `next dev` (Turbopack). Normalmente chamado via root `bun run dev`. |
| `bun run build` | `next build` (standalone output para o Dockerfile). |
| `bun run start` | `next start` no output standalone. |
| `bun run typecheck` | `tsgo --build`. |
| `bun run lint` | ESLint com cache. |
| `bun run build:test` | Build de produção com env `dev/test.env` (para E2E). |
| `bun run test:e2e` | Playwright suite contra a build de teste. |
| `bun run test:e2e:ui` | Playwright em modo interactivo. |
| `bun run test:e2e:debug` | Playwright com `PWDEBUG=1`. |
| `bun run db:migrate:test` | Aplica migrations nas DBs `*_test` (chama `scripts/migrate-test.mjs`). |

## Comandos (`products/menu`, `products/imopush`, `packages/core-auth`)

| Comando | O que faz |
|---|---|
| `bun run db:generate` | Gera nova migration Drizzle a partir do schema (`drizzle-kit generate`). |
| `bun run db:migrate` | Aplica migrations pendentes contra a DB do produto. |
| `bun run db:studio` | Drizzle Studio (UI para inspeccionar a DB). |
| `bun run db:push` | (`menu` apenas) Push do schema directo, sem migration — só dev. |

## Day 0 (homelab novo)

```bash
export BWS_ACCESS_TOKEN='...' HOMELAB_HOST='ssh://root@<ip>'
./home-infra/scripts/bootstrap.sh                       # install-kamal + boot services
./home-infra/my-services/iedora/scripts/bootstrap.sh    # cf-tunnel + r2 + setup-repo
kamal setup -d production                               # primeiro boot
```
