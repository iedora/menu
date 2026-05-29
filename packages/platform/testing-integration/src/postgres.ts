// testcontainers-node reads TESTCONTAINERS_REUSE_ENABLE at the time
// `.start()` runs. Default it ON locally so consumers get warm-boot
// reuse for free; CI gets fresh state.
if (!process.env.CI) {
  process.env.TESTCONTAINERS_REUSE_ENABLE ??= 'true'
}

import postgres from 'postgres'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'

/**
 * Boots an ephemeral Postgres container.
 *
 * Reuse is on locally (`!process.env.CI`) — the second boot reuses the
 * warm container in ~1s. Reuse key is hard-coded so every consumer in
 * a `bun run` sweep shares the same instance; pass `reuseKey` to
 * isolate (e.g. a slice that wants a clean server every test).
 */

export type PostgresHandle = {
  uri: string
  host: string
  port: number
  user: string
  password: string
  /** Idempotent — CREATE DATABASE IF NOT EXISTS semantics. */
  createDatabase(name: string): Promise<string>
  stop(): Promise<void>
}

export type PostgresOptions = {
  image?: string
  reuse?: boolean
  reuseKey?: string
}

export async function bootPostgres(
  opts: PostgresOptions = {},
): Promise<PostgresHandle> {
  const image = opts.image ?? 'postgres:18.4-alpine'
  const reuse = opts.reuse ?? !process.env.CI

  const builder = new PostgreSqlContainer(image)
    .withUsername('postgres')
    .withPassword('postgres')
    .withDatabase('postgres')
  if (reuse) {
    builder.withReuse()
    if (opts.reuseKey) builder.withLabels({ 'iedora.reuse-key': opts.reuseKey })
  }
  const container: StartedPostgreSqlContainer = await builder.start()

  return {
    uri: container.getConnectionUri(),
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: 'postgres',
    password: 'postgres',
    async createDatabase(name: string) {
      const root = postgres(container.getConnectionUri(), { max: 1 })
      try {
        const exists = await root<{ exists: boolean }[]>`
          SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${name}) AS exists
        `
        if (!exists[0]?.exists) {
          await root.unsafe(`CREATE DATABASE "${name}"`)
        }
      } finally {
        await root.end({ timeout: 5 })
      }
      const u = new URL(container.getConnectionUri())
      u.pathname = `/${name}`
      return u.toString()
    },
    stop: async () => {
      // Reused containers must stay running between runs — Ryuk cleans
      // them up eventually. Stopping here defeats reuse.
      if (reuse) return
      await container.stop()
    },
  }
}
