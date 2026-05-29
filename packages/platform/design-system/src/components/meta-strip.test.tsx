import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaStrip } from "./meta-strip";

describe("MetaStrip", () => {
  it("renders a <nav> with the editorial class and default aria-label='Meta'", () => {
    const html = renderToStaticMarkup(<MetaStrip />);
    expect(html).toMatch(/^<nav class="ds-meta-strip" aria-label="Meta">/);
  });

  it("honours a custom aria-label", () => {
    const html = renderToStaticMarkup(
      <MetaStrip ariaLabel="House meta" />,
    );
    expect(html).toContain('aria-label="House meta"');
  });

  it("renders all three column divs even when slots are empty", () => {
    const html = renderToStaticMarkup(<MetaStrip />);
    // alignment depends on the three cells always existing
    expect(html).toContain('class="ds-meta-strip__left"');
    expect(html).toContain('class="ds-meta-strip__center"');
    expect(html).toContain('class="ds-meta-strip__right"');
  });

  it("places left, center, and right content in the matching column", () => {
    const html = renderToStaticMarkup(
      <MetaStrip
        left={<span>MMXXVI</span>}
        center={<span>Showcase</span>}
        right={<a href="/back">Back</a>}
      />,
    );
    expect(html).toMatch(
      /<div class="ds-meta-strip__left"><span>MMXXVI<\/span><\/div>/,
    );
    expect(html).toMatch(
      /<div class="ds-meta-strip__center"><span>Showcase<\/span><\/div>/,
    );
    expect(html).toMatch(
      /<div class="ds-meta-strip__right"><a href="\/back">Back<\/a><\/div>/,
    );
  });

  it("appends a custom className to the nav", () => {
    const html = renderToStaticMarkup(<MetaStrip className="top" />);
    expect(html).toMatch(/^<nav class="ds-meta-strip top"/);
  });
});
