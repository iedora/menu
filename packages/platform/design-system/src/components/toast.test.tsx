import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Toast, ToastStack } from "./toast";

describe("Toast", () => {
  it("renders with role=status and the base class", () => {
    const html = renderToStaticMarkup(
      <Toast title="Note">A draft is waiting.</Toast>,
    );
    expect(html).toMatch(/^<div[^>]*role="status"[^>]*class="ds-toast"[^>]*>/);
    expect(html).toContain('class="ds-toast__title"');
    expect(html).toContain('class="ds-toast__msg"');
    expect(html).toContain("Note");
    expect(html).toContain("A draft is waiting.");
  });

  it("applies the ok variant", () => {
    const html = renderToStaticMarkup(
      <Toast variant="ok" title="Saved">
        The work was kept.
      </Toast>,
    );
    expect(html).toContain('class="ds-toast ds-toast--ok"');
  });

  it("applies the warn variant", () => {
    const html = renderToStaticMarkup(
      <Toast variant="warn" title="Stop">
        This room is currently being tended.
      </Toast>,
    );
    expect(html).toContain('class="ds-toast ds-toast--warn"');
  });
});

describe("ToastStack", () => {
  it("renders a polite live region with the stack class", () => {
    const html = renderToStaticMarkup(
      <ToastStack>
        <Toast title="x">y</Toast>
      </ToastStack>,
    );
    expect(html).toMatch(/^<div[^>]*aria-live="polite"[^>]*class="ds-toast-stack"[^>]*>/);
    expect(html).toContain("ds-toast");
  });
});
