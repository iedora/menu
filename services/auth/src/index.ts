import {
  Database,
  JwtIssuer,
  OutboxRelay,
  OutboxWriter,
  ServiceTokenIssuer,
  expandFileSecrets,
  isProd,
  newUserVerifier,
  parseClients,
  parseEd25519Seed,
  serve,
} from "@iedora/server-kit";

import { buildApp } from "./app";
import { loadConfig } from "./config";
import { loggingResetMailer, noopResetMailer } from "./mailer";
import type { AuthDB } from "./schema";

expandFileSecrets();
const cfg = loadConfig();

const db = new Database<AuthDB>(cfg.authDatabaseUrl);
const auditDb = new Database(cfg.auditDatabaseUrl, { poolMax: 4 }); // relay is low-volume

const keys = parseEd25519Seed(cfg.jwtSeed);
const issuer = new JwtIssuer({
  keys,
  kid: cfg.jwtKeyId,
  issuer: cfg.jwtIssuer,
  audience: cfg.jwtAudience,
  accessTtl: cfg.accessTtl,
});
const userVerifier = newUserVerifier(keys.publicKey, cfg.jwtIssuer, cfg.jwtAudience);
const serviceIssuer = new ServiceTokenIssuer({
  privateKey: keys.privateKey,
  kid: cfg.jwtKeyId,
  issuer: cfg.jwtIssuer,
  audience: cfg.serviceAudience,
  ttl: cfg.serviceTokenTtl,
});
const auditor = new OutboxWriter(db, "auth");
// No email transport is wired yet: prod drops the message (the reset is still
// recorded as an audit event), dev logs the link so the flow is testable.
const resetMailer = isProd() ? noopResetMailer : loggingResetMailer;

// Drain this service's audit outbox into the audit DB in the background.
const relay = new OutboxRelay(db, auditDb.root);
relay.start();

serve(buildApp({ db, issuer, userVerifier, serviceIssuer, serviceClients: parseClients(cfg.serviceClients), auditor, resetMailer, cfg }), {
  name: "iedora-auth",
  port: cfg.port,
  onShutdown: async () => {
    await relay.stop();
    await db.close();
    await auditDb.close();
  },
});
