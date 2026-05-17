import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VisuallyHidden } from "./visually-hidden";

describe("VisuallyHidden", () => {
  it("renders a span with the ds-sr-only class by default", () => {
    const html = renderToStaticMarkup(<VisuallyHidden>House philosophy</VisuallyHidden>);
    expect(html).toMatch(/^<span class="ds-sr-only">House philosophy<\/span>$/);
  });

  it("supports rendering as a div", () => {
    const html = renderToStaticMarkup(<VisuallyHidden as="div">x</VisuallyHidden>);
    expect(html).toMatch(/^<div class="ds-sr-only">x<\/div>$/);
  });

  it("appends a custom className", () => {
    const html = renderToStaticMarkup(<VisuallyHidden className="extra">x</VisuallyHidden>);
    expect(html).toContain('class="ds-sr-only extra"');
  });
});
