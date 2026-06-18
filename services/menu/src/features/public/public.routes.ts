import type { PublicPayload } from "@iedora/contracts";
import { type Context, Hono } from "hono";
import { getConnInfo } from "hono/bun";
import { getCookie, setCookie } from "hono/cookie";

import { resolveQRCode } from "../../data/qr";
import { snapshotBySlug } from "../../data/tree";
import { recordView } from "../../data/views";
import type { MenuDeps } from "../../deps";
import { notFound } from "../../errors";
import { localize, pick, pickLanguage } from "../../i18n";

// Public surface: unauthenticated, slug-addressed, read-only (plus the
// fire-and-forget view beacon). The React app renders straight from these.
// Ports Go internal/menu/httpapi/public.go.

// A 1x1 transparent GIF; the beacon always answers with it (and 200) so a guest
// page never sees tracking errors.
const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const VISITOR_COOKIE = "mm_v";
const YEAR_SECONDS = 365 * 24 * 60 * 60;

// Crude UA deny-list — fail-open by design; the per-hour visitor dedup absorbs
// what slips through.
const BOT_MARKERS = ["bot", "crawl", "spider", "preview", "headless", "curl", "wget"];
function isBot(ua: string): boolean {
  const l = ua.toLowerCase();
  return BOT_MARKERS.some((m) => l.includes(m));
}

// clientIP identifies the caller for the beacon rate limiter. In production the
// service sits behind a Cloudflare tunnel that sets CF-Connecting-IP (and
// overwrites any client value); otherwise we key on the socket peer. We
// deliberately do NOT trust a raw X-Forwarded-For (a direct client could rotate
// it to mint unlimited buckets).
function clientIP(c: Context): string {
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return cf;
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown"; // no socket peer (e.g. in-process app.request)
  }
}

export function publicRoutes(deps: MenuDeps) {
  return new Hono()
    // publicMenu renders one restaurant's active menus in the negotiated language.
    .get("/r/:slug", async (c) => {
      const snap = await snapshotBySlug(deps.db.db, c.req.param("slug"), true);
      if (!snap) throw notFound();
      const rest = snap.restaurant;
      const lang = pickLanguage(
        c.req.query("lang") ?? "",
        c.req.header("accept-language") ?? "",
        rest.supportedLanguages,
        rest.defaultLanguage,
      );
      const payload: PublicPayload = {
        restaurant: {
          name: rest.name,
          slug: rest.slug,
          description: pick(rest.description, rest.descriptionI18n, lang) || undefined,
          logoUrl: rest.logoUrl || undefined,
          bannerUrl: rest.bannerUrl || undefined,
          theme: rest.theme ?? undefined,
        },
        menus: localize(snap.menus, lang),
        defaultLanguage: rest.defaultLanguage,
        supportedLanguages: rest.supportedLanguages,
        currentLanguage: lang,
      };
      return c.json(payload);
    })
    // resolveQR maps a sticker code to its restaurant slug — the scan hot path.
    .get("/qr/:code", async (c) => {
      const slug = await resolveQRCode(deps.db.db, c.req.param("code"));
      if (slug === undefined) throw notFound();
      return c.json({ slug });
    })
    // trackView counts one public menu view: bot filter → IP rate limit →
    // visitor cookie → dedup + counter. Every failure path still returns the
    // pixel (and 200) so a guest page never sees tracking errors.
    .get("/track/:slug", async (c) => {
      const servePixel = () => {
        c.header("Content-Type", "image/gif");
        c.header("Cache-Control", "no-store");
        return c.body(PIXEL);
      };

      if (isBot(c.req.header("user-agent") ?? "")) return servePixel();
      try {
        await deps.limiter.allow("beacon", `ip:${clientIP(c)}`);
        const rest = await snapshotBySlug(deps.db.db, c.req.param("slug"), true).then((s) => s?.restaurant);
        if (!rest) return servePixel();
        // Bound inflation per restaurant — defeats IP/cookie rotation.
        await deps.limiter.allow("beacon_rest", `rest:${rest.id}`);

        let visitor = getCookie(c, VISITOR_COOKIE) ?? "";
        if (!visitor) {
          visitor = crypto.randomUUID();
          setCookie(c, VISITOR_COOKIE, visitor, {
            path: "/",
            maxAge: YEAR_SECONDS,
            httpOnly: true,
            sameSite: "Lax",
          });
        }
        const lang = pickLanguage(
          c.req.query("lang") ?? "",
          c.req.header("accept-language") ?? "",
          rest.supportedLanguages,
          rest.defaultLanguage,
        );
        await recordView(deps.db.db, rest, visitor, lang, new Date());
      } catch {
        // fire-and-forget: any rate-limit/db error still serves the pixel
      }
      return servePixel();
    });
}
