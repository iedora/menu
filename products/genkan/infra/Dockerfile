# syntax=docker/dockerfile:1.7
# Genkan — the identity entryway. Same Next.js 16 multi-stage build as menu:
# Bun installs deps, Node executes the build (Bun + next build is unstable per
# AGENTS.md), final image runs server.js on Node over the standalone output.

# ── Stage 1: dependências ─────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Make src/shared/env.ts return a build-time stub Proxy so Next can collect
# page data without real env. Runtime env is injected by Kamal and validated
# on first import then.
ENV SKIP_ENV_VALIDATION=1

# Better Auth reads process.env at module load (not via our env stub).
# Placeholders so `next build`'s page-data collection doesn't log noise.
ENV BETTER_AUTH_SECRET=build-placeholder-overridden-at-runtime-32chars
ENV BETTER_AUTH_URL=http://build.local

RUN node --run build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nextjs && \
    adduser -S -u 1001 -G nextjs nextjs

# Next standalone output — server.js + a minimal node_modules.
# `drizzle-orm/postgres/drizzle/scripts/migrate.mjs` come via
# outputFileTracingIncludes in next.config.ts.
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
# Genkan has no public/ directory — auth pages render entirely from the
# design system. Skip the copy that menu's Dockerfile does.

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
