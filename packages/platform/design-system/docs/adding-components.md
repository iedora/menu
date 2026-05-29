# Adding a new component

The system is small on purpose. Before you add something, check whether the existing primitives compose into what you need.

## Decision tree

```
Is this a one-off layout? -----------------> Compose existing primitives at the call site.
Is this a thin styling shorthand? ----------> Add a .ds-* class to styles.css, no component.
Is it a real new primitive with an API? ----> Follow the checklist below.
```

If the new thing needs interactive behaviour (focus trap, keyboard navigation, portal, dismissable layer, controlled/uncontrolled state) — it's a **Radix-backed** primitive. Wrap a Radix part, don't write the behaviour from scratch.

If it's purely structural / typographic — it's a **static** primitive. Just JSX + className.

## Checklist

For a new primitive `Foo`:

1. **`src/components/foo.tsx`** — the React component. RSC-safe by default; add `"use client"` only if the component uses hooks, ref forwarding for portals, or Radix.
2. **`src/styles.css`** — append `.ds-foo` (and any modifiers like `.ds-foo--accent`) under the right Manual section header. Use tokens, never hex.
3. **`src/index.ts`** — re-export the component (and any helper types). The barrel is the contract; if you forget this, downstream code can't import it.
4. **Test file** — one of:
   - `src/components/foo.test.tsx` for static primitives — `renderToStaticMarkup`, node env, no DOM.
   - `src/components/foo.dom.test.tsx` for Radix-backed / interactive primitives — `@testing-library/react` + `userEvent`, jsdom env (declared via `// @vitest-environment jsdom` at the top of the file).
5. **`docs/components.md`** — add a row under the right bucket with the public props and a minimal example.

After you've written everything: `bun run typecheck && bun run test`. Both must pass.

## Conventions

### Naming

- Component file: kebab-case (`scroll-pinned.tsx`).
- Exported component: PascalCase (`ScrollPinned`).
- CSS class: `ds-<component>[__part][--modifier]` BEM-ish. The `__part` is for sub-elements (e.g. `.ds-dialog__title`); the `--modifier` is for variants (e.g. `.ds-btn--solid`).
- React sub-components: `<Component><ComponentTitle>...</ComponentTitle></Component>`. Don't invent slot props when a sub-component reads cleaner.

### Props

- Spread the underlying element's HTML attributes (`ComponentPropsWithoutRef<"div">`). Editorial overrides go through `className`, never through unprefixed style props.
- `variant` for visual options (`"solid" | "ghost" | "accent"`).
- No `size` prop. Iedora primitives are one size; context provides the rhythm. The two exceptions are `Wordmark` (`display | inline`) and `Statement` (heading level via `as`).
- For interactive primitives, follow Radix's compositional naming: `Foo`, `FooTrigger`, `FooContent`, `FooClose`, `FooItem`, etc. Accept `asChild` where Radix accepts it — never re-implement Radix's `Slot`.

### CSS

- All values are tokens. If you reach for a hex, double-check it isn't already in `tokens.css`.
- Hairline rules use `1px solid var(--ink-14)`. The two heavier weights (`--rule-line` 1.5px, `--thick` 2px) are reserved for emphasis.
- Animations are driven by `data-state="open|closed"` (for Radix) or by a `--reveal` modifier class. Always provide a `@media (prefers-reduced-motion: reduce)` fallback.
- Token names beat hex in comments too — write `var(--cinnabar)`, not `#B83A26`.

### Composition with Radix

```tsx
import { Dialog as RadixDialog } from "radix-ui";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export function DialogContent({ className, ...rest }: ComponentPropsWithoutRef<typeof RadixDialog.Content>) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="ds-dialog__scrim" />
      <RadixDialog.Content {...rest} className={cn("ds-dialog", className)} />
    </RadixDialog.Portal>
  );
}
```

Two patterns to copy:

1. **Re-export the Radix Root and Trigger directly.** They have no editorial styling; the styling sits on Content. Don't wrap parts that don't need wrapping — it costs a layer of types for nothing.
2. **Bundle Portal + Overlay + Content into one ergonomic Content component.** Callers should never have to write `<DialogPortal><DialogOverlay /><DialogContent>...</DialogContent></DialogPortal>`. That ladder is the same every time; we collapse it.

## Worked example — porting Dialog to Radix

Starting point: a static `<Dialog>` with `scrim` + `eyebrow` + `onClose` props, no portal, no focus trap, no Escape dismiss. Manual § VI.6 wants real modal behaviour.

**Steps applied:**

1. Added `radix-ui` as a peer-ish dep. The unified Feb-2026 package — one install, all primitives behind `import { Dialog } from "radix-ui"`.
2. Rewrote `src/components/dialog.tsx`:
   - `Dialog`, `DialogTrigger`, `DialogClose`, `DialogPortal` are re-exports of Radix parts.
   - `DialogContent` wraps `Portal + Overlay + Content`, accepts an `eyebrow` and a `showClose` prop, renders the iedora `.ds-dialog__top` row with a cinnabar close affordance.
   - `DialogHeader` / `DialogFooter` are CSS-only structural wrappers — no logic, just consistent spacing.
   - `DialogBody`/`DialogActions` kept as deprecated aliases for one release so menu code doesn't break mid-migration.
3. Added `data-state` animations to `styles.css`:
   ```css
   .ds-dialog[data-state="open"]  { animation: ds-dialog-pop-in  var(--d-3) var(--ease-open); }
   .ds-dialog[data-state="closed"]{ animation: ds-dialog-pop-out var(--d-2) var(--ease-close); }
   @media (prefers-reduced-motion: reduce) {
     .ds-dialog, .ds-dialog__scrim { animation: none !important; }
   }
   ```
4. Updated `src/index.ts` to export the new parts.
5. Deleted `dialog.test.tsx` (the static tests no longer applied — `<Dialog>` is now `Radix.Dialog.Root`, which renders nothing until the trigger is clicked).
6. Added `dialog.dom.test.tsx`:
   - `// @vitest-environment jsdom` directive.
   - 8 tests covering: trigger gating, content render, Escape dismiss, click-Cancel dismiss, controlled `open` prop, `showClose={false}`, `asChild` trigger composition.
   - `afterEach(cleanup)` + a `document.body.style.pointerEvents = ""` hard-reset (Radix sets `pointer-events: none` on the body while open; if a test races the cleanup, the next test can't click).
   - `userEvent.setup({ pointerEventsCheck: 0 })` to bypass that check entirely.
7. `bun run test` → 163 passing (155 existing + 8 new).

That's the template. Any new interactive primitive (DropdownMenu, Popover, Select, Tooltip) follows the same six moves.
