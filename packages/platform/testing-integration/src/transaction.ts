import type { Sql, TransactionSql } from 'postgres'

/**
 * Runs `fn` inside a Postgres SAVEPOINT and rolls back at the end.
 * Use as `beforeEach`/`afterEach` glue so each test sees the same
 * baseline state without `TRUNCATE` dancing.
 *
 * Pattern: postgres-js `sql.begin(...)` commits on resolve and rolls
 * back on throw. We throw a sentinel to force rollback, then unwrap
 * the result outside.
 */
export async function withTransaction<T>(
  sql: Sql,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  try {
    await sql.begin(async (tx) => {
      const value = await fn(tx)
      throw new RollbackSentinel(value)
    })
  } catch (err) {
    if (err instanceof RollbackSentinel) return err.value as T
    throw err
  }
  throw new Error('withTransaction: unreachable')
}

class RollbackSentinel<T> extends Error {
  constructor(public value: T) {
    super('rollback')
    this.name = 'RollbackSentinel'
  }
}
