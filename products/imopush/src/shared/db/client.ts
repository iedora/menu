import 'server-only'
import { createDb } from '@iedora/db'
import { env } from '../env'
import * as schema from './schema'

/**
 * imopush's Postgres client. Connects to the `imopush` database (its
 * own DB; not the menu DB). Drizzle types scoped to `./schema` — no
 * leak of menu tables.
 *
 * Shared drizzle + postgres-js wiring lives in `@iedora/db`. This file
 * just binds it to imopush's env + schema. cacheKey is unique
 * per-product so HMR-safe singletons don't collide across products in
 * the same Next.js process.
 */
const handle = createDb(env.IMOPUSH_DATABASE_URL, schema, { cacheKey: 'iedora/imopush' })

export const db = handle.db
export type DB = typeof db
export const pingDb = handle.ping
export const closeDb = handle.close
