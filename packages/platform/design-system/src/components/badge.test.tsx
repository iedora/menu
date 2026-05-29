import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders as a <span> with the base class by default", () => {
    const html = renderToStaticMarkup(<Badge>In study</Badge>);
    expect(html).toMatch(/^<span class="ds-badge">In study<\/span>$/);
  });

  it("applies the live variant", () => {
    const html = renderToStaticMarkup(<Badge variant="live">In service</Badge>);
    expect(html).toContain('class="ds-badge ds-badge--live"');
  });

  it("applies the ink variant", () => {
    const html = renderToStaticMarkup(<Badge variant="ink">Reserved</Badge>);
    expect(html).toContain('class="ds-badge ds-badge--ink"');
  });

  it("applies the accent variant", () => {
    const html = renderToStaticMarkup(<Badge variant="accent">New</Badge>);
    expect(html).toContain('class="ds-badge ds-badge--accent"');
  });

  it("applies the ghost variant", () => {
    const html = renderToStaticMarkup(<Badge variant="ghost">Concept</Badge>);
    expect(html).toContain('class="ds-badge ds-badge--ghost"');
  });

  it("appends a custom className", () => {
    const html = renderToStaticMarkup(<Badge className="bump">x</Badge>);
    expect(html).toContain('class="ds-badge bump"');
  });

  it("forwards aria-label and other html attributes", () => {
    const html = renderToStaticMarkup(
      <Badge aria-label="status" data-testid="b">
        x
      </Badge>,
    );
    expect(html).toContain('aria-label="status"');
    expect(html).toContain('data-testid="b"');
  });
});
