# Testing

Two suites, one config. Pick the right one for the primitive you're writing.

## Dual environment

```
src/components/foo.test.tsx      → node env, renderToStaticMarkup checks
src/components/foo.dom.test.tsx  → jsdom env, full DOM + userEvent
```

`vitest.config.ts` routes by filename pattern:

```ts
environmentMatchGlobs: [
  ["src/**/*.dom.test.tsx", "jsdom"],
  ["src/**/*.test.{ts,tsx}", "node"],
],
setupFiles: ["./src/test/jsdom-setup.ts"],
```

The setup file runs in both environments but its shims are guarded by `typeof window !== "undefined"`, so they're no-ops in node and active in jsdom. No need to import or annotate setup at the top of test files.

## When to use which

- **Node + `renderToStaticMarkup`** — components whose entire behaviour is the rendered HTML. Wordmark, MetaStrip, Statement, Button, Badge, Field, Card, EditorialList rows. ~30× faster than jsdom; no module imports of `@testing-library/react`.
- **jsdom + RTL + userEvent** — anything that has state, focus traps, portals, keyboard shortcuts, or runs on `data-state` transitions. Dialog, and any Radix-backed primitive you add next.

Don't reach for jsdom unless you actually need it. Most iedora primitives are static.

## Static test pattern

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
  it("renders each letter as its own span for letter-by-letter reveal", () => {
    const html = renderToStaticMarkup(<Wordmark word="iedora" />);
    expect(html).toContain('class="ds-wordmark__letter"');
    expect(html.match(/ds-wordmark__letter/g)?.length).toBeGreaterThan(6);
  });
});
```

Rules:
- Assert on class names and DOM structure — that's the public contract.
- Don't snapshot. Snapshots rot.
- Don't test inline styles unless the style *is* the prop (e.g. `--ds-wordmark-letter-i` ordering).

## Interactive test pattern

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "./dialog";

afterEach(() => {
  cleanup();
  // Radix sets pointer-events:none on body while a dialog is open. If a
  // test races the cleanup, the next test can't click. Hard-reset.
  document.body.style.pointerEvents = "";
});

const u = () => userEvent.setup({ pointerEventsCheck: 0 });

describe("Dialog", () => {
  it("opens when the trigger is clicked", async () => {
    const user = u();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent showClose={false}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
```

Three things to copy verbatim:
1. **`// @vitest-environment jsdom`** at line 1 — opts this file into jsdom.
2. **`afterEach` hard-reset** of `document.body.style.pointerEvents` — survives Radix cleanup races.
3. **`pointerEventsCheck: 0`** on `userEvent.setup()` — bypasses the default check that fails when an element inherits `pointer-events: none`.

## jsdom shims

`src/test/jsdom-setup.ts` installs the four browser APIs Radix relies on but jsdom omits:

| API | Why Radix needs it |
|---|---|
| `PointerEvent` | All pointer interactions bind to pointer events, not mouse. Without it, `userEvent.click` fires but Radix doesn't react. |
| `ResizeObserver` | The `useSize` hook used by Popover positioning, Select content sizing, ScrollArea, etc. |
| `HTMLElement.scrollIntoView` | Select scrolls the highlighted item into view on keyboard nav. |
| `hasPointerCapture` / `setPointerCapture` / `releasePointerCapture` | Focus-trap and pointer-down-outside detection. |

If you hit a new error like `TypeError: el.foo is not a function` in a jsdom test, the fix is almost always "shim that method in jsdom-setup.ts." Don't change the component to avoid the call.

## Common pitfalls

**Tests pass alone, fail in the suite.** Almost always Radix's body manipulation leaking between tests. The `afterEach` reset above fixes it.

**`Unable to perform pointer interaction as the element has pointer-events: none`.** Radix sets that on the body when a dialog is open. Either (a) close the dialog first, (b) use `pointerEventsCheck: 0`, or (c) verify the previous test really did clean up.

**`findByRole("dialog")` times out.** The portal content might still be animating. `findBy*` polls for ~1s by default — usually plenty, but if the animation is configured with `--d-3` (360ms) plus a slow shim, you may need to increase the timeout: `findByRole("dialog", {}, { timeout: 2000 })`. Prefer to make the test wait for the right state, not to slow the test runner.

**Stale console errors about `act()`.** RTL 16+ wraps interactions in `act` automatically. If you see this, you're probably calling React APIs (`useState` setters from a custom hook) outside an `act()` block in a test helper. Wrap the helper in `act`.

**Multiple roots in `document.body`.** RTL appends each `render()` to body but `cleanup()` removes them. If you see leftover nodes, you forgot `afterEach(cleanup)` or you're using `vi.useFakeTimers()` without restoring them.

## Running

```bash
bun run test         # one-shot
bun run test:watch   # watch mode
bun run test src/components/dialog.dom.test.tsx   # single file
bun run typecheck    # tsc --noEmit (run alongside tests in CI)
```

The full suite finishes in well under 2 seconds locally even with both environments active. If you write a test that takes over a few hundred ms by itself, mock the slow thing — don't extend `testTimeout`.
