import { type Env, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { type ServiceEnv } from "@iedora/server-kit";

import { otelHttp, traceIds } from "./otel";

// createServiceApp returns a Hono app with one consistent global error handler:
// an HTTPException renders its own response; anything else is logged and becomes
// a 500 JSON body. Generic over the Env so non-service apps (auth, menu — which
// carry user/tenant variables) can supply their own while reusing onError.
export function createServiceApp<E extends Env = ServiceEnv>(
  otelOpts?: { captureRequestHeaders?: string[]; captureResponseHeaders?: string[] },
): Hono<E> {
  const app = new Hono<E>();
  app.use(otelHttp<E>(otelOpts)); // request tracing; no-op until OTel is configured
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    // Correlate the error log with its trace so a log line is a jump-off point
    // into the full span tree (this is why per-layer breadcrumb logging isn't
    // needed). No ids when OTel is off.
    console.error(
      JSON.stringify({ level: "error", msg: "unhandled error", err: String(err), ...traceIds() }),
    );
    return c.json({ error: "internal error" }, 500);
  });
  return app;
}
