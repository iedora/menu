import type { Auditor, Database, JwtIssuer } from "@iedora/server-kit";

import type { AuthConfig } from "./config";
import type { AuthDB } from "./schema";

// Dependencies wired once at boot and handed to each auth slice. Password
// hashing uses server-kit's functions directly; the relay is started in index.ts.
export interface AuthDeps {
  db: Database<AuthDB>;
  issuer: JwtIssuer;
  auditor: Auditor; // OutboxWriter — records into the auth DB's outbox
  cfg: AuthConfig;
}
