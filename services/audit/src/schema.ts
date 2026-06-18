// The audit database's Kysely types are generated from the live schema by
// kysely-codegen (`bun run db:codegen` against AUDIT_DATABASE_URL). Regenerate
// after a migration; don't hand-edit db.generated.ts. AuditDB is the alias the
// service code uses.
export type { DB as AuditDB } from "./db.generated";
