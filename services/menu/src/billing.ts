// Client for the billing service's plan lookups. The menu service authenticates
// with a service token it mints via auth's client-credentials grant (/auth/token),
// caches it until shortly before expiry, and presents it as a Bearer to billing.
// Ports the Go serviceauth.Transport + menu.BillingClient.

export interface PlanSource {
  // planCode resolves a tenant's active menu plan code; "" means unsubscribed.
  planCode(tenantId: string): Promise<string>;
}

// ServiceTokenSource mints + caches a client-credentials service token.
export class ServiceTokenSource {
  private cached = "";
  private expiresAtMs = 0;

  constructor(
    private readonly authBaseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async token(): Promise<string> {
    // Refresh a minute before expiry to absorb clock skew + request latency.
    if (this.cached && Date.now() < this.expiresAtMs - 60_000) return this.cached;
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(`${this.authBaseUrl}/auth/token`, {
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

// BillingClient reads the tenant's menu subscription from the billing service.
export class BillingClient implements PlanSource {
  constructor(
    private readonly base: string,
    private readonly tokens: ServiceTokenSource,
  ) {}

  async planCode(tenantId: string): Promise<string> {
    const token = await this.tokens.token();
    const res = await fetch(
      `${this.base}/billing/subscriptions?tenant=${encodeURIComponent(tenantId)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`billing: subscriptions returned ${res.status}`);
    const out = (await res.json()) as {
      subscriptions: { product: string; planCode: string; status: string }[];
    };
    const active = out.subscriptions.find((s) => s.product === "menu" && s.status === "active");
    return active?.planCode ?? "";
  }
}
