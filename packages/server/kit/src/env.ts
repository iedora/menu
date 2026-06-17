import { readFileSync } from "node:fs";

// Ports the Go config._FILE convention (internal/config/config.go
// expandFileSecrets): for every `<NAME>_FILE` env var pointing at a path, read
// the file and set `<NAME>` to its trimmed contents — so the deploy can inject
// secrets as mounted files (Docker/Kamal secrets) without putting values in the
// process env. An explicit non-empty `<NAME>` always wins.
export function expandFileSecrets(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of Object.keys(env)) {
    if (!key.endsWith("_FILE")) continue;
    const base = key.slice(0, -"_FILE".length);
    if (!base) continue;
    const path = env[key];
    if (!path) continue;
    if (env[base]) continue; // explicit value wins
    env[base] = readFileSync(path, "utf8").trim();
    delete env[key];
  }
}

/** Required env var; throws a clear error if unset/empty. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`config: ${name} is required`);
  return v;
}

/** Optional env var with a fallback default. */
export function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/** True for a production-like deployment (mirrors Go config.OTel.IsProd). */
export function isProd(): boolean {
  const e = process.env.DEPLOYMENT_ENV;
  return e === "production" || e === "prod";
}
