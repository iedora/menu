/**
 * @iedora/testing-integration — shared infrastructure for INTEGRATION tests.
 *
 * Tier split (one package per tier; consumers pick what they need):
 *
 *   @iedora/testing-integration   testcontainers Postgres + MinIO + savepoint
 *                                 (this package — slow, hits real services)
 *   @iedora/testing-unit          PGLite + in-memory fakes (planned — fast,
 *                                 no Docker, runs on every save)
 *   @iedora/testing-e2e           browser/Playwright harness (planned — when
 *                                 a real E2E case shows up)
 *
 * Sub-modules inside this package so each container has independent
 * reuse + a consumer only pays for what it asks for:
 *
 *   @iedora/testing-integration/postgres     bootPostgres()
 *   @iedora/testing-integration/minio        bootMinio()
 *   @iedora/testing-integration/transaction  withTransaction()
 *   @iedora/testing-integration              setupIntegrationStack()
 *                                            (composes both, vitest globalSetup shape)
 *
 * Pattern recap (2026 best practice):
 *   - Container reuse ON locally (~1s warm boot), OFF in CI.
 *   - One DB per worker, savepoint per test (no TRUNCATE).
 *   - MinIO over s3mock — real S3 API, no `if(isS3Mock)` branches.
 */

import { bootPostgres, type PostgresHandle, type PostgresOptions } from './postgres'
import { bootMinio, type MinioHandle, type MinioOptions } from './minio'

export { bootPostgres, type PostgresHandle, type PostgresOptions } from './postgres'
export { bootMinio, type MinioHandle, type MinioOptions } from './minio'
export { withTransaction } from './transaction'

export type IntegrationStackOptions<DB extends string> = {
  databases: readonly DB[]
  minio?: boolean | MinioOptions
  postgres?: PostgresOptions
  migrate?: (ctx: {
    databases: Record<DB, string>
    minio: MinioHandle | null
  }) => Promise<void>
}

export type IntegrationStack<DB extends string> = {
  postgres: PostgresHandle
  databases: Record<DB, string>
  minio: MinioHandle | null
  stop(): Promise<void>
}

/**
 * Vitest-shaped boot: boots only what's asked for, creates per-product
 * databases on the shared Postgres, runs the consumer's migrate hook,
 * returns connection strings keyed by name.
 *
 *   import { setupIntegrationStack } from '@iedora/testing-integration'
 *
 *   export default async function () {
 *     const stack = await setupIntegrationStack({
 *       databases: ['menu'],
 *       minio: true,
 *       migrate: async ({ databases }) => {
 *         process.env.MENU_DATABASE_URL = databases.menu
 *         await runMenuMigrations()
 *       },
 *     })
 *     return () => stack.stop()
 *   }
 */
export async function setupIntegrationStack<DB extends string>(
  opts: IntegrationStackOptions<DB>,
): Promise<IntegrationStack<DB>> {
  const wantMinio = Boolean(opts.minio)
  const minioOpts: MinioOptions = typeof opts.minio === 'object' ? opts.minio : {}

  const [pg, minio] = await Promise.all([
    bootPostgres(opts.postgres),
    wantMinio ? bootMinio(minioOpts) : Promise.resolve(null),
  ])

  const dbEntries = await Promise.all(
    opts.databases.map(
      async (name) => [name, await pg.createDatabase(name)] as const,
    ),
  )
  const databases = Object.fromEntries(dbEntries) as Record<DB, string>

  if (opts.migrate) await opts.migrate({ databases, minio })

  return {
    postgres: pg,
    databases,
    minio,
    async stop() {
      await Promise.allSettled(
        [pg.stop(), minio?.stop()].filter(Boolean) as Promise<unknown>[],
      )
    },
  }
}
