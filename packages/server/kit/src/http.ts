import { type Env, Hono } from "hono";
import { HTTPException } from "hono/http-exception";

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
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(JSON.stringify({ level: "error", msg: "unhandled error", err: String(err) }));
    return c.json({ error: "internal error" }, 500);
  });
  return app;
}
