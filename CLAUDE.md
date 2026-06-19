# iedora-frontend — working rules for Claude

> Architecture, slice pattern, auth, and commands live in **[`AGENTS.md`](./AGENTS.md)** — read it.
> This file adds the **design workflow** and the **design-system knowledge** that AGENTS.md doesn't cover.

---

## 🟧 RULE 0 — Design in Pencil FIRST, then code

**Every UI / design change is designed in the Pencil files before it is written in code.** No exceptions.

- The design source of truth is **`iedora.pen`** (all product screens) and **`iedora.lib.pen`** (the shared UI Kit / design system), at the repo root. They are `.pen` files (encrypted) — edit them **only** through the **Pencil MCP** tools (`mcp__pencil__*`), never with Read/Grep/Edit.
- Workflow for any visual change:
  1. **Design it in Pencil first** — add/modify the screen or component in `iedora.pen` (or the kit in `iedora.lib.pen`). Verify with `get_screenshot` / `snapshot_layout`.
  2. **Then implement in code** — translate that exact design (same labels, spacing, icons, radius, colors) into React using the existing design system.
  3. **Verify** — `bun run typecheck`, run `bun run dev`, confirm it matches the Pencil design.
- **Do NOT invent UI directly in code.** If a screen/component isn't in Pencil yet, design it there first. If asked to "build screen X", and X isn't in `iedora.pen`, design it in Pencil before coding.
- The Pencil MCP edits **the currently-open `.pen` editor**, ignoring `filePath`. To edit the library, the user must open `iedora.lib.pen`; to edit screens, `iedora.pen`. Library components appear `J:`-prefixed inside `iedora.pen`.
- Canvas is organized: screens in left-aligned labeled rows (APP / GUEST / ADMIN / ONBOARDING …, desktop step 1560px, mobile 450px, 200px between rows); components on the **Components** board / **iedora UI Kit** board grouped atomically (ATOMS / FORM CONTROLS / COMPOSITES / APP SHELL / GUEST). Keep it that way — new screens slot into the matching row.

---

## The design language — "warm-light, appetizing" (Pencil redesign)

The app is mid-migration **from** an editorial look (paper/ink/cinnabar, Playfair, square corners) **to** the Pencil warm-light look. Branch: `redesign/pencil-look`. The aesthetic:

| Token | Value | Use |
|---|---|---|
| `--paper` / `--background` | `#FFFDFA` | page surface |
| `--card` | `#FFFFFF` | cards |
| `--paper-2` / `--muted` | `#F6F1EA` | muted surface |
| `--ink` / `--foreground` | `#1F1A16` | text |
| `--ink-2` | `#3A322B` | ink-soft |
| `--muted` (text) / `--muted-foreground` | `#80756B` | secondary text |
| `--rule` / `--border` | `#ECE4DA` | hairline borders |
| `--cinnabar` / `--primary` | **`#EF5430`** | **coral — the primary CTA / brand accent** |
| `--cinnabar-soft` | `#FCEAE2` | coral tint (eyebrows, icon tiles) |
| `--green` | `#1E8A52` | success / "live" |
| `--green-soft` | `#E3F2E9` | green tint |
| `--danger` | `#D92D20` | destructive, errors |
| `--radius-s/m/l/pill` | 10 / 18 / 28 / 999px | rounded chrome |

- **Fonts:** `--display` = **Plus Jakarta Sans** (headings, wordmark, weight 700/800), `--sans` / `--serif` = **Inter** (UI + body), `--mono` = Geist Mono. Loaded via `next/font` in `apps/web/src/app/layout.tsx`. Headings (`h1–h4`) default to Plus Jakarta 700.
- **Buttons** are filled & rounded; `variant="primary"` = coral on white text. **Inputs** are boxed + rounded (not underline). **Labels** are sans, sentence-case (not mono-uppercase).

### Where the design system lives
- **`packages/platform/design-system/`** — `@iedora/design-system`. CSS-variable tokens + BEM-scoped `.ds-*` React primitives (Button, Card, Field/Input, Dialog, Table, Toggle, Checkbox, SegmentedControl, Combobox, EmptyState, Stat, …). No shadcn, no clsx — a simple `cn()` helper.
  - `src/tokens.css` — the raw palette + fonts (change values here to re-skin everything; **no hardcoded hex in `styles.css`**, all read from vars).
  - `src/styles.css` — `.ds-*` rules. **A trailing `PENCIL REDESIGN` block** overrides the editorial vocabulary (filled rounded buttons, boxed inputs, sans labels, rounded surfaces). Revert by deleting that one block.
- **`apps/web/src/app/globals.css`** — Tailwind v4 `@theme inline` maps tokens → utilities (`bg-primary`, `text-muted-foreground`, `rounded-2xl`, …) + `:root` semantic mappings (`--primary` → coral, radii, headings).

### Building UI
- **Compose from `@iedora/design-system`** primitives first (`Button`, `Field`, `Card`, `Dialog`, `Table`…). Use the re-skinned components; don't hand-roll buttons/inputs.
- Layout with Tailwind v4 utilities reading the tokens (`bg-background`, `bg-card`, `border-border`, `text-primary`, `bg-[var(--cinnabar-soft)]`, `rounded-2xl`, `font-[family-name:var(--display)]`). Never hardcode hex.
- Icons: **`lucide-react`** (in `apps/web`).
- Match the Pencil design exactly: same text, icon, spacing, radius, color.

---

## Redesign status (keep current)

- ✅ **Stage 1 (root re-skin):** tokens + fonts + radius + core `.ds-*` overrides → the whole `.ds-*` system renders in the warm-light coral/rounded look. Files: `design-system/src/tokens.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `design-system/src/styles.css`.
- ✅ **Landing** (`apps/web/src/app/menu/_components/landing/landing-page.tsx`) rebuilt to the Pencil marketing design (Hero → Features → How-it-works → Showcase → Pricing → Testimonial → CTA → Footer), as an async server component. **Fully i18n'd** under the `Landing` namespace (EN + pt-PT in `products/menu/src/i18n/messages/{en,pt}.json`); the nav EN/PT switch (`landing/lang-switch.tsx`) reuses `setUserLocale` to set the `NEXT_LOCALE` cookie. Hero/showcase/avatar use `next/image` (Unsplash `remotePatterns` in `next.config.ts`).
- ⏳ **Pending Stage 2:** admin "control all restaurants + create/bind/print QR"; **50+-friendly onboarding** (no jargon, big targets, plain words — AI/JSON import is **admin-only**, never owner-facing); the **"Need help? Call us"** Support Line; self-host the landing photos; per-screen polish (selects/segmented). Design each in Pencil first.

### Two audiences, opposite UIs (design accordingly)
- **Admin (staff)** — power tools: tables, bulk actions, AI/JSON menu import, density.
- **Restaurant owner (50+, non-technical)** — the opposite: no jargon (never "JSON/import/tenant"), big text + tap targets, plain friendly language, few steps, a real phone number to call. Admin onboards restaurants (incl. menu import); owners only maintain (edit price, mark sold out).

---

## Quick reference
- Stack/auth/slices/commands → **`AGENTS.md`**. App shell rules → **`apps/web/CLAUDE.md`**.
- Data shapes → `packages/platform/contracts/src/*` (zod: `publicMenu` / `publicItem` / `publicCategory`, billing invoices, etc.).
- Run: `bun install` → `bun run dev:up` (Go backend) → `bun run dev` (`:3000`). Verify: `bun run typecheck`.
- Tests: co-located Vitest (`renderToStaticMarkup`, assert on `data-test-id`), one slice per file.
