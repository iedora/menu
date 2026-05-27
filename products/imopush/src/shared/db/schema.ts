import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * imopush owns its own postgres database (`imopush`) and a single
 * pg-schema (`imopush.*`) inside that database. Migrations track
 * separately from menu's (see ../../drizzle.config.ts).
 *
 * Tables land in follow-up commits. Add them as
 * `imopush.table('name', { ... })` so namespace stays consistent.
 */
export const imopush = pgSchema('imopush')
