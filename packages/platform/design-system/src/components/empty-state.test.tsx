import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the dashed-border shell with mark, label, note", () => {
    const html = renderToStaticMarkup(
      <EmptyState label="Forthcoming" note="No work to show in this room yet." />,
    );
    expect(html).toMatch(/^<div class="ds-empty">/);
    expect(html).toContain('class="ds-empty__mark"');
    expect(html).toContain('class="ds-empty__label"');
    expect(html).toContain('class="ds-empty__note"');
    expect(html).toContain("Forthcoming");
    expect(html).toContain("No work to show in this room yet.");
  });

  it("defaults the mark to the middle dot · and hides it from assistive tech", () => {
    const html = renderToStaticMarkup(<EmptyState label="Empty" />);
    expect(html).toMatch(
      /<div class="ds-empty__mark" aria-hidden="true">·<\/div>/,
    );
  });

  it("accepts a custom mark", () => {
    const html = renderToStaticMarkup(<EmptyState label="x" mark="i." />);
    expect(html).toContain('<div class="ds-empty__mark" aria-hidden="true">i.</div>');
  });

  it("omits the note when not provided", () => {
    const html = renderToStaticMarkup(<EmptyState label="x" />);
    expect(html).not.toContain("ds-empty__note");
  });
});
