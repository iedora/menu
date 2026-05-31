#!/usr/bin/env bun
// Mostra TODAS as env vars que vão para o container em prod, em formato .env,
// agrupadas pela ORIGEM de onde vêm. Cobre web role + accessories.
//
//   Origens:
//     • deploy.yml env.clear  → config plaintext, committed no repo
//     • SOPS                  → secrets estáticos encriptados (editas com `sops <file>`)
//     • tofu outputs          → gerados por `tofu apply` (CF tunnel + R2 creds)
//     • gh CLI                → KAMAL_REGISTRY_PASSWORD = $(gh auth token)
//     • derivado              → composto em .kamal/secrets (ex: CORE_DATABASE_URL)
//
// Valores mascarados por defeito. Passa `--reveal` para plaintext.

import { resolve } from "node:path";
import { existsSync } from "node:fs";

const REPO_ROOT = resolve(import.meta.dir, "..");
const KAMAL_YML = `${REPO_ROOT}/infra/live/kamal/deploy.yml`;
const SECRETS_SH = `${REPO_ROOT}/.kamal/secrets`;
const SOPS_FILE = `${process.env.HOME}/.config/iedora/secrets.sops.yaml`;
const TOFU_DIR = `${REPO_ROOT}/infra/live/tofu`;
const REVEAL = process.argv.includes("--reveal");

const tty = process.stdout.isTTY;
const c = {
  bold: tty ? "\x1b[1m" : "",
  dim: tty ? "\x1b[2m" : "",
  red: tty ? "\x1b[31m" : "",
  grn: tty ? "\x1b[32m" : "",
  yel: tty ? "\x1b[33m" : "",
  cya: tty ? "\x1b[36m" : "",
  mag: tty ? "\x1b[35m" : "",
  rst: tty ? "\x1b[0m" : "",
};

function mask(v: string): string {
  if (REVEAL) return v;
  const n = v.length;
  if (n <= 8) return "•".repeat(n);
  return `${v.slice(0, 4)}${"•".repeat(Math.min(n - 8, 40))}${v.slice(-4)}`;
}

// 1. Parse deploy.yml (env.clear + declared secrets across roles & accessories)
const yaml = Bun.YAML.parse(await Bun.file(KAMAL_YML).text()) as any;
const clearEnv: Record<string, string> = yaml.env?.clear ?? {};
const declared = new Set<string>([
  ...(yaml.env?.secret ?? []),
  ...Object.values(yaml.accessories ?? {}).flatMap((a: any) => a?.env?.secret ?? []),
  "KAMAL_REGISTRY_PASSWORD", // implícito (registry auth)
]);

// 2. Resolve .kamal/secrets numa subshell mínima (isola valores que ele exporta)
const cleanEnv: Record<string, string> = {};
for (const k of ["HOME", "PATH", "USER"]) if (process.env[k]) cleanEnv[k] = process.env[k]!;
const spawnEnv = async (script: string): Promise<Map<string, string>> => {
  const p = Bun.spawn(["bash", "-c", script], { env: cleanEnv, stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  await p.exited;
  const m = new Map<string, string>();
  for (const line of out.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) m.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return m;
};
const beforeEnv = await spawnEnv("env");
const afterEnv = await spawnEnv(`set -a; source "${SECRETS_SH}"; set +a; env`);
const resolved: Record<string, string> = {};
for (const [k, v] of afterEnv) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
  if (beforeEnv.get(k) === v) continue;
  if (k === "SOPS_AGE_KEY_FILE" || k === "SOPS_FILE") continue;
  resolved[k] = v;
}

// 3. Classifica por origem
const sopsKeys = new Set<string>();
{
  const p = Bun.spawn(["sops", "-d", "--output-type", "dotenv", SOPS_FILE], {
    env: { ...cleanEnv, SOPS_AGE_KEY_FILE: `${process.env.HOME}/.config/sops/age/keys.txt` },
    stdout: "pipe",
  });
  const out = await new Response(p.stdout).text();
  await p.exited;
  for (const line of out.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) sopsKeys.add(line.slice(0, eq));
  }
}

const tofuMap: Record<string, string> = {};
const tofuFiles: Array<[string, string]> = [
  [`${TOFU_DIR}/.tunnel-token`, "TUNNEL_TOKEN"],
  [`${TOFU_DIR}/.s3-access-key`, "S3_ACCESS_KEY"],
  [`${TOFU_DIR}/.s3-secret-key`, "S3_SECRET_KEY"],
];
for (const [path, key] of tofuFiles) {
  if (existsSync(path)) tofuMap[key] = (await Bun.file(path).text()).trim();
}

type Source = "yaml.clear" | "sops" | "tofu" | "gh" | "derived" | "unknown";
const classify = (k: string): Source => {
  if (k in clearEnv) return "yaml.clear";
  if (sopsKeys.has(k)) return "sops";
  if (k in tofuMap) return "tofu";
  if (k === "KAMAL_REGISTRY_PASSWORD") return "gh";
  if (k in resolved) return "derived";
  return "unknown";
};

// 4. Composição final: todas as keys (clear + resolved), agrupadas por origem
const ALL_KEYS = new Set<string>([...Object.keys(clearEnv), ...Object.keys(resolved)]);
const groups: Record<Source, string[]> = {
  "yaml.clear": [], sops: [], tofu: [], gh: [], derived: [], unknown: [],
};
for (const k of ALL_KEYS) groups[classify(k)].push(k);
for (const k of Object.keys(groups) as Source[]) groups[k].sort();

const SOURCE_META: Record<Source, { color: string; label: string; hint: string }> = {
  "yaml.clear": { color: c.cya, label: "deploy.yml > env.clear", hint: "committed, plaintext — edita o yaml" },
  sops:        { color: c.grn, label: "SOPS",                    hint: `editar: sops ${SOPS_FILE.replace(process.env.HOME!, "~")}` },
  tofu:        { color: c.mag, label: "tofu outputs",            hint: "gerados — não editas; vêm de `tofu apply`" },
  gh:          { color: c.yel, label: "gh CLI",                  hint: "$(gh auth token) — rotaciona com `gh auth refresh`" },
  derived:     { color: c.dim, label: "derivado em .kamal/secrets", hint: "composto a partir de outros (ex: DATABASE_URLs)" },
  unknown:     { color: c.red, label: "??? (não classificado)",  hint: "investigar" },
};

// 5. Print
const declaredMark = (k: string) => declared.has(k) || k in clearEnv ? "" : `  ${c.dim}(orphan — não declarado em deploy.yml)${c.rst}`;
const valueOf = (k: string) => k in clearEnv ? String(clearEnv[k]) : (resolved[k] ?? "");
const isSecretSrc = (s: Source) => s !== "yaml.clear";

for (const src of ["yaml.clear", "sops", "tofu", "gh", "derived", "unknown"] as Source[]) {
  const keys = groups[src];
  if (!keys.length) continue;
  const meta = SOURCE_META[src];
  console.log(`\n${c.bold}# ${meta.color}${meta.label}${c.rst}${c.bold}  ${c.dim}— ${meta.hint}${c.rst}`);
  for (const k of keys) {
    const v = valueOf(k);
    const display = isSecretSrc(src) ? mask(v) : v;
    const lenHint = isSecretSrc(src) && !REVEAL && v.length > 8 ? ` ${c.dim}(${v.length} chars)${c.rst}` : "";
    console.log(`${k}=${display}${lenHint}${declaredMark(k)}`);
  }
}

if (!REVEAL) {
  console.log(`\n${c.dim}Tip:${c.rst} ${c.bold}bun run secrets:show --reveal${c.rst} para plaintext.`);
}
