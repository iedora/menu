import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { setupIntegrationStack } from '@iedora/testing-integration'

/**
 * Vitest globalSetup for the menu integration suite. Boots one shared
 * Postgres + MinIO via testcontainers, runs core-auth + menu Drizzle
 * migrations against the `core` and `menu` databases, then exports the
 * connection strings into `process.env` so every test process inherits
 * them (Vitest spawns worker processes with the parent's env).
 *
 * Container reuse handled inside `@iedora/testing-integration` — on
 * locally, off in CI.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

const MIGRATORS = [
  { name: 'core', cwd: 'packages/business/auth' },
  { name: 'menu', cwd: 'products/menu' },
] as const

export default async function setup() {
  const stack = await setupIntegrationStack({
    databases: ['core', 'menu'],
    minio: true,
    migrate: async ({ databases, minio }) => {
      process.env.CORE_DATABASE_URL = databases.core
      process.env.MENU_DATABASE_URL = databases.menu
      if (minio) {
        process.env.S3_ENDPOINT = minio.endpoint
        process.env.S3_REGION = 'us-east-1'
        process.env.S3_ACCESS_KEY = minio.accessKey
        process.env.S3_SECRET_KEY = minio.secretKey
        process.env.S3_BUCKET = process.env.S3_BUCKET ?? 'iedora-test'
        process.env.S3_PUBLIC_URL = `${minio.endpoint}/${process.env.S3_BUCKET}`
        process.env.S3_FORCE_PATH_STYLE = 'true'
      }
      for (const { name, cwd } of MIGRATORS) {
        const r = spawnSync('bun', ['scripts/migrate.mjs'], {
          cwd: resolve(repoRoot, cwd),
          stdio: 'inherit',
          env: process.env,
        })
        if (r.status !== 0) {
          throw new Error(`migrate:${name} failed (exit ${r.status})`)
        }
      }
    },
  })

  // Stub env vars the menu module init pulls in. Migrations already
  // ran; runtime code now reads the live testcontainer URLs.
  process.env.CORE_SECRET ??= 'integration-iedora-auth-secret-32chars-min!!'
  process.env.CORE_BASE_URL ??= 'http://localhost:3000'
  process.env.NEXT_PUBLIC_CORE_URL ??= 'http://localhost:3000/core'
  process.env.NEXT_PUBLIC_MENU_URL ??= 'http://localhost:3000/menu'
  process.env.NEXT_PUBLIC_BRAND_URL ??= 'http://localhost:3000/house'

  return async () => {
    await stack.stop()
  }
}
