# @iedora/design-system

Editorial design system for Iedora products. Extracted from the house brand site (`products/house/site/index.html`) so every product can speak the same visual language.

## The language

Paper, ink, cinnabar. Fraunces for type, JetBrains Mono for labels. Hairlines, generous breathing room, and a single warm accent for any moment that needs heat.

- **Palette** — `--ds-paper` (#EFE8DA), `--ds-ink` (#1A1815) with semi-transparent variants down to `--ds-ink-08`, and `--ds-cinnabar` (#B83A26) reserved for the dot in the wordmark, focused inputs, the hover state of the primary action.
- **Typography** — `--ds-serif` is Fraunces with optical sizing dialled to 144 for display, 300 weight for body. `--ds-mono` is JetBrains Mono, uppercase, generous letter-spacing, used for labels and meta strips.
- **Motion** — three named easings (`--ds-ease`, `--ds-ease-open`, `--ds-ease-close`) so any product that animates moves in the same physical voice.
- **Forms** — no boxes. Fields share a hairline-rule grid (`PaneGrid` → `Pane`s). The bottom border of an input is what fills with cinnabar on focus.

## Files

```
src/
  tokens.css         CSS custom properties only — safe everywhere
  fonts.css          Optional Google Fonts import (skip if using next/font)
  styles.css         tokens + component classes (.ds-*)
  components/        React primitives (RSC-safe, no 'use client')
  index.ts           barrel
```

## Consume from a Next.js app

```ts
// app/layout.tsx
import "@iedora/design-system/styles.css";
// Optional — only if you aren't loading the fonts yourself
import "@iedora/design-system/fonts.css";
```

Use next/font for production:

```ts
import { Fraunces, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const jbMono   = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

// Then in a CSS file or inline <style>:
// :root { --ds-serif: var(--font-fraunces), serif;
//         --ds-mono:  var(--font-jbmono), monospace; }
```

Then in a page:

```tsx
import {
  Wordmark, MetaStrip, Statement, Lintel,
  PaneGrid, Pane, PaneLabel, EditorialInput, EditorialTextarea, SendButton,
} from "@iedora/design-system";

export default function Page() {
  return (
    <div className="ds-root ds-root--washed">
      <MetaStrip left={<><span>MMXXVI</span><span>Oporto · Lisboa</span></>}
                 right={<a href="#contact">Contact</a>} />
      <Wordmark />
      <Statement>A quiet house for <em>digital craftsmanship</em>.</Statement>
    </div>
  );
}
```

## Consume from plain HTML

```html
<link rel="stylesheet" href="https://unpkg.com/@iedora/design-system/src/fonts.css" />
<link rel="stylesheet" href="https://unpkg.com/@iedora/design-system/src/styles.css" />

<div class="ds-root">
  <span class="ds-wordmark ds-wordmark--display">
    <span>i</span><span>e</span><span class="ds-wordmark__d">d</span>
    <span>o</span><span>r</span><span>a</span>
    <span class="ds-wordmark__dot">.</span>
  </span>
</div>
```

The package isn't published; consumers must point at the local path or set up a private registry.

## Components

| Name                 | Purpose                                                     |
|----------------------|-------------------------------------------------------------|
| `Wordmark`           | The "iedora." letterform. `variant="display" \| "inline"`.  |
| `MetaStrip`          | Three-column mono caps strip with a hairline rule beneath.  |
| `Statement`          | Italic Fraunces tagline. Wrap a word in `<em>` to upright it.|
| `Lintel`             | Top bar for forms — inline wordmark, rule, end slot.        |
| `PaneGrid` / `Pane`  | Two-column hairline-rule form grid + each field cell.       |
| `PaneLabel`          | Mono caps label, optional italic hint.                      |
| `EditorialInput`     | Underline-only text input, cinnabar focus.                  |
| `EditorialTextarea`  | Same, multi-line.                                           |
| `SendButton`         | Ink primary action with hover-cinnabar and arrow nudge.     |

## Adding to the system

Two rules:

1. **Stay editorial.** Hairlines over borders. Italic Fraunces over bold sans. One accent only.
2. **Stay framework-agnostic.** Components own a class on the root element and forward all other props; the *real* design lives in `styles.css` so anyone consuming the CSS by itself gets the same look.

Browse `/showcase` in the menu app for a live preview.
