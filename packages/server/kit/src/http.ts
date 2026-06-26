import { type Env, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

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
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(JSON.stringify({ level: "error", msg: "unhandled error", err: String(err) }));
    return c.json({ error: "internal error" }, 500);
  });
  return app;
}
