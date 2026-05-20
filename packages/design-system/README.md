# @iedora/design-system

Editorial design system for Iedora products. Paper, ink, cinnabar; Fraunces and JetBrains Mono; hairline rules; one warm accent used sparingly. Every product in the monorepo (house, menu) renders out of this one package.

## Quickstart

```ts
// app/layout.tsx (Next.js)
import "@iedora/design-system/styles.css";
```

```tsx
import { Wordmark, Button, Field, FieldInput, FieldLabel } from "@iedora/design-system";

export default function Page() {
  return (
    <main className="ds-root">
      <Wordmark className="ds-wordmark--reveal" />
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <FieldInput id="email" name="email" type="email" />
      </Field>
      <Button variant="solid" arrow>Send</Button>
    </main>
  );
}
```

For Next.js, prefer `next/font` over the bundled `fonts.css` (no Google Fonts roundtrip in production):

```tsx
import { Fraunces, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"] });
const jbMono   = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

<html
  className={`${fraunces.variable} ${jbMono.variable}`}
  style={{
    ['--serif' as string]: "var(--font-fraunces), 'Times New Roman', serif",
    ['--mono'  as string]: "var(--font-jbmono), ui-monospace, monospace",
  }}
>
```

## The language

| Layer | Tokens |
|---|---|
| **Palette** | `--paper` `--paper-2` `--paper-3` · `--ink` + opacity ladder `--ink-04 / 08 / 14 / 22 / 40 / 55 / 70 / 85` · `--cinnabar` `--cinnabar-deep` `--cinnabar-08` |
| **Typography** | `--serif` (Fraunces, opsz 9–144) · `--mono` (JetBrains Mono) |
| **Type scale** | `--t-2xs` (10.5px) → `--t-display` (`clamp(120px, 18vw, 232px)`) |
| **Leading** | `--lh-tight` (0.94) · `--lh-snug` · `--lh-body` · `--lh-prose` |
| **Spacing** | 13-step ladder `--s-0` (0) → `--s-12` (160px), on a 4-pixel baseline |
| **Layout** | `--gutter` (24px) · `--margin` (56px) · `--container` (1320px) · `--measure` (56ch) |
| **Stroke** | `--hairline` (1px) · `--rule-line` (1.5px) · `--thick` (2px) |
| **Motion** | `--ease` `--ease-soft` `--ease-open` `--ease-close` · `--d-1` (120ms) → `--d-6` (1400ms) |

Two principles thread through every primitive:
1. **Hairlines, not boxes.** Sections divide by 1px `--ink-14` rules. Card edges are seams, not containers.
2. **Italics carry emphasis.** Wrap a word in `<em>` inside a headline to mark it; close statements with a cinnabar `.` (the wordmark dot pattern).

## What's in the package

```
src/
  tokens.css         CSS custom properties only — safe in any HTML/CSS context
  fonts.css          Google Fonts import (fall back option if not using next/font)
  styles.css         tokens + every .ds-* class
  components/        React primitives (most are RSC-safe; Dialog is 'use client')
  test/jsdom-setup.ts  Radix browser-API shims for interactive tests
  index.ts           the public barrel
```

29 components grouped into three buckets — full reference in [`docs/components.md`](docs/components.md).

| Bucket | Examples |
|---|---|
| **Editorial chrome** | `Wordmark`, `MetaStrip`, `Statement`, `Lintel`, `Shoji`, `PageProgress`, `ScreenLabel`, `ScrollPinned`, `Phrases`, `Wave`, `Timeline`, `RoomsGrid`, `HouseSvg` |
| **Manual § VI primitives** | `Button`, `Badge`, `Card*`, `Field*`, `Checkbox`, `Toggle`, `Table*`, `Dialog*` (Radix), `Toast*`, `EmptyState`, `Tabs*`, `Breadcrumb*`, `Separator` (Radix) |
| **Editorial forms (legacy)** | `Pane`, `PaneGrid`, `PaneLabel`, `EditorialInput`, `EditorialTextarea` (kept for hairline-grid layouts that pre-date `<Field>`) |

## Working on the design system

Three guides, each focused on one workflow:

- **[`docs/adding-components.md`](docs/adding-components.md)** — checklist for adding a new primitive, with the Dialog port as a worked example.
- **[`docs/testing.md`](docs/testing.md)** — the dual-environment vitest setup (node for static, jsdom for Radix), browser-API shims, common pitfalls.
- **[`docs/components.md`](docs/components.md)** — every component, with its public props, a minimal usage example, and notes.

## Maintaining

- Tests must pass on every change: `bun run test`. The suite enforces both static markup (`renderToStaticMarkup` in node) and interactive behaviour (Radix-backed primitives, real DOM in jsdom).
- Typecheck must pass: `bun run typecheck`.
- The barrel (`src/index.ts`) is the contract. Don't break it without bumping the package version (currently `0.1.0`, private). When a primitive is replaced or removed, leave a one-line `@deprecated` alias for one release so consumers can migrate without churn.
- The Manual is the canonical reference for naming. If a token disagrees with the Manual, the Manual wins.
- The `--ds-*` prefix is transitional — new code uses unprefixed names (`--paper`, `--ink`, `--cinnabar`, `--serif`, etc.). The aliases stay until every consumer has migrated.

## See also

- [`/products/menu/src/app/showcase`](../../products/menu/src/app/showcase) — live preview of every primitive in the running Next app.
- [`/products/house/src/pages/index.astro`](../../products/house/src/pages/index.astro) — the canonical editorial composition of the chrome primitives (Wordmark + MetaStrip + Statement + ScrollPinned + Shoji form).
