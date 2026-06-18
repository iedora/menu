import { sql } from "kysely";

// Shared raw-SQL value builders. Bun's SQL binding does not encode a JS array as
// a Postgres array via the `sql` tag, so build ARRAY[...] from bound params
// (injection-safe — each element is a parameter, never interpolated text).

export function textArray(values: string[]) {
  if (values.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}`))}]::text[]`;
}

export function uuidArray(values: string[]) {
  if (values.length === 0) return sql`ARRAY[]::uuid[]`;
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}`))}]::uuid[]`;
}

// jsonb column value: NULL when null, else the JS value bound directly and cast
// to jsonb. The driver encodes a JS object/array as a jsonb object/array; a
// pre-stringified value would instead be stored as a jsonb *string scalar*
// (which then breaks server-side `-`/`||` operators, e.g. the language rotation).
export function jsonbOrNull(v: unknown) {
  return v == null ? sql`NULL` : sql`${v as never}::jsonb`;
}
