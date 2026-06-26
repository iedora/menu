import {
  context,
  IEDORA_RESTAURANT_ID,
  IEDORA_TENANT_ID,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  tracer,
} from "@iedora/observability";
import { type Env, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

// Reads W3C trace headers off the incoming Request so a span continues the
// caller's trace instead of starting a detached one.
const headerGetter = {
  get: (h: Headers, k: string) => h.get(k) ?? undefined,
  keys: (h: Headers) => Array.from(h.keys()),
};

// The originating client IP behind Cloudflare + kamal-proxy. PII — only ever
// goes on the SERVER span (never a metric label or db statement).
function clientAddress(h: Headers): string | undefined {
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return h.get("x-real-ip") ?? undefined;
}

// One SERVER span per request. Bun.serve/Hono aren't auto-instrumented, so this
// is where backend HTTP tracing comes from: continue any propagated trace, name
// the span by the matched route (low cardinality), and stamp status + tenant.
// All of OTel no-ops until registerIedoraOtelNode runs with an OTLP endpoint, so
// this is free when observability is off.
export function otelHttp<E extends Env>() {
  return createMiddleware<E>(async (c, next) => {
    const method = c.req.method;
    const route = c.req.routePath || c.req.path;
    const parent = propagation.extract(context.active(), c.req.raw.headers, headerGetter);
    await context.with(parent, () =>
      tracer.startActiveSpan(`${method} ${route}`, { kind: SpanKind.SERVER }, async (span) => {
        span.setAttribute("http.request.method", method);
        span.setAttribute("url.path", c.req.path);
        if (route) span.setAttribute("http.route", route);
        const ip = clientAddress(c.req.raw.headers);
        if (ip) span.setAttribute("client.address", ip);
        try {
          await next();
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
          throw err;
        } finally {
          const status = c.res.status;
          span.setAttribute("http.response.status_code", status);
          if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          // Tenant attribution — set by userAuth / the scoped middleware inside
          // next(), so it's available here. Read loosely: not every Env carries
          // these vars.
          const vars = c as unknown as { get: (k: string) => unknown };
          const user = vars.get("user") as { tenantId?: string } | undefined;
          if (user?.tenantId) span.setAttribute(IEDORA_TENANT_ID, user.tenantId);
          const rest = vars.get("restaurant") as { id?: string } | undefined;
          if (rest?.id) span.setAttribute(IEDORA_RESTAURANT_ID, rest.id);
          span.end();
        }
      }),
    );
  });
}

// Shared bearer-token gate behind both userAuth and serviceAuth: parse the
// `Authorization: Bearer …` header, 401 on missing, run `verify`, set the
// resolved principal under `setKey`, 401 on a verify throw. One body so the two
// security gates can never drift in their 401 handling.
export function bearerAuth<
  E extends Env,
  K extends keyof E["Variables"] & string = keyof E["Variables"] & string,
>(opts: {
  verify: (token: string) => Promise<E["Variables"][K]>;
  setKey: K;
  invalidMsg: string;
}) {
  return createMiddleware<E>(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return c.json({ error: "missing bearer token" }, 401);
    try {
      c.set(opts.setKey, await opts.verify(token));
    } catch {
      return c.json({ error: opts.invalidMsg }, 401);
    }
    await next();
  });
}

// ServiceEnv is the Hono environment for internal (service-token) services:
// serviceAuth sets `clientId`. Declared once and reused by the middleware and
// every slice so the Variables type isn't redeclared per file (the Hono factory
// best practice — set the Env in one place).
export interface ServiceEnv {
  Variables: { clientId: string };
}

// createServiceApp returns a Hono app with one consistent global error handler:
// an HTTPException renders its own response; anything else is logged and becomes
// a 500 JSON body. Generic over the Env so non-service apps (auth, menu — which
// carry user/tenant variables) can supply their own while reusing onError.
export function createServiceApp<E extends Env = ServiceEnv>(): Hono<E> {
  const app = new Hono<E>();
  app.use(otelHttp<E>()); // request tracing; no-op until OTel is configured
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    // Correlate the error log with its trace so a log line is a jump-off point
    // into the full span tree (this is why per-layer breadcrumb logging isn't
    // needed). Empty trace ids when OTel is off.
    const sc = trace.getActiveSpan()?.spanContext();
    console.error(
      JSON.stringify({
        level: "error",
        msg: "unhandled error",
        err: String(err),
        ...(sc ? { trace_id: sc.traceId, span_id: sc.spanId } : {}),
      }),
    );
    return c.json({ error: "internal error" }, 500);
  });
  return app;
}
