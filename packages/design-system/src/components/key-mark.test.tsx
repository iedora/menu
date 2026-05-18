import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KeyMark } from "./key-mark";

describe("KeyMark", () => {
  it("renders an inline SVG with the editorial base class", () => {
    const html = renderToStaticMarkup(<KeyMark />);
    expect(html).toMatch(/^<svg class="ds-key-mark"/);
  });

  it("declares role=img with a default aria-label", () => {
    const html = renderToStaticMarkup(<KeyMark />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Key"');
  });

  it("honours an explicit aria-label", () => {
    const html = renderToStaticMarkup(<KeyMark ariaLabel="iedora identity" />);
    expect(html).toContain('aria-label="iedora identity"');
  });

  it("appends a custom className alongside the base class", () => {
    const html = renderToStaticMarkup(<KeyMark className="my-extra" />);
    expect(html).toMatch(/class="ds-key-mark my-extra"/);
  });

  it("uses currentColor for every stroke so it follows the parent ink", () => {
    const html = renderToStaticMarkup(<KeyMark />);
    // Every stroked primitive (bow circle + shaft + two teeth) must
    // inherit the parent color — pinning this keeps the glyph editorial
    // and lets consumers recolor it with a single CSS rule.
    const strokeMatches = html.match(/stroke="currentColor"/g) ?? [];
    expect(strokeMatches.length).toBeGreaterThanOrEqual(4);
  });

  it("draws a bow + shaft + two teeth (skeleton-key silhouette)", () => {
    const html = renderToStaticMarkup(<KeyMark />);
    // Bow on the left.
    expect(html).toMatch(/<circle [^>]*cx="5"[^>]*cy="6"[^>]*r="3.2"/);
    // Horizontal shaft from the bow to the right edge.
    expect(html).toMatch(/<line [^>]*x1="8.2"[^>]*y1="6"[^>]*x2="22"[^>]*y2="6"/);
    // Two teeth dropping below the shaft.
    expect(html).toMatch(/<line [^>]*x1="18"[^>]*y2="9.5"/);
    expect(html).toMatch(/<line [^>]*x1="21"[^>]*y2="9"/);
  });
});
