import type { TokenSource } from "@iedora/server-kit";

// Client-credentials service-token source. A service with no signing key of its
// own (i.e. not auth) obtains a service token by presenting its client id +
// secret to auth's /auth/token grant, caches it until shortly before expiry, and
// hands it to a ServiceClient as the outbound Bearer. Generic infra: any service
// that calls a peer over HTTP wires one of these.
export class ServiceTokenSource implements TokenSource {
  private cached = "";
  private expiresAtMs = 0;
  private inflight: Promise<string> | null = null; // de-dupes concurrent cold-cache mints

  constructor(
    private readonly authBaseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tokenPath = "/auth/token",
  ) {}

  async token(): Promise<string> {
    // Refresh a minute before expiry to absorb clock skew + request latency.
    if (this.cached && Date.now() < this.expiresAtMs - 60_000) return this.cached;
    // Several calls may fire at once on a cold/expired cache; they'd otherwise
    // each mint a token. Share a single in-flight mint instead.
    this.inflight ??= this.mint().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async mint(): Promise<string> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(`${this.authBaseUrl}${this.tokenPath}`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}` },
    });
    if (!res.ok) throw new Error(`auth: token endpoint returned ${res.status}`);
    const body = (await res.json()) as { accessToken: string };
    this.cached = body.accessToken;
    this.expiresAtMs = jwtExpiryMs(body.accessToken) ?? Date.now() + 9 * 60_000;
    return this.cached;
  }
}

// jwtExpiryMs reads the `exp` claim (seconds) without verifying — we minted the
// token, this only schedules the refresh.
function jwtExpiryMs(token: string): number | undefined {
  const part = token.split(".")[1];
  if (!part) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
