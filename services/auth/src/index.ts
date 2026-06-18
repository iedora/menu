import {
  Database,
  JwtIssuer,
  OutboxRelay,
  OutboxWriter,
  expandFileSecrets,
  parseEd25519Seed,
  serve,
} from "@iedora/server-kit";

import { buildApp } from "./app";
import { loadConfig } from "./config";
import type { AuthDB } from "./schema";

expandFileSecrets();
const cfg = loadConfig();

const db = new Database<AuthDB>(cfg.authDatabaseUrl);
const auditDb = new Database(cfg.auditDatabaseUrl);

const issuer = new JwtIssuer({
  keys: parseEd25519Seed(cfg.jwtSeed),
  kid: cfg.jwtKeyId,
  issuer: cfg.jwtIssuer,
  audience: cfg.jwtAudience,
  accessTtl: cfg.accessTtl,
});
const auditor = new OutboxWriter(db, "auth");

// Drain this service's audit outbox into the audit DB in the background.
const relay = new OutboxRelay(db, auditDb.root);
relay.start();

serve(buildApp({ db, issuer, auditor, cfg }), {
  name: "iedora-auth",
  port: cfg.port,
  onShutdown: async () => {
    await relay.stop();
    await db.close();
    await auditDb.close();
  },
});
