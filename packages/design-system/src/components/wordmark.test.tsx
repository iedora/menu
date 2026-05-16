import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
  it("renders the default 'iedora.' letter-by-letter with the cinnabar dot", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    // each glyph is its own <span>
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>i<\/span>/);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>e<\/span>/);
    expect(html).toMatch(/<span class="ds-wordmark__d"[^>]*>d<\/span>/);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>o<\/span>/);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>r<\/span>/);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>a<\/span>/);
    // the dot carries its own class so it can be coloured cinnabar
    expect(html).toContain(
      '<span class="ds-wordmark__dot" aria-hidden="true">.</span>',
    );
  });

  it("applies the display variant by default", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toContain("ds-wordmark--display");
    expect(html).not.toContain("ds-wordmark--inline");
  });

  it("applies the inline variant when asked", () => {
    const html = renderToStaticMarkup(<Wordmark variant="inline" />);
    expect(html).toContain("ds-wordmark--inline");
    expect(html).not.toContain("ds-wordmark--display");
  });

  it("respects a custom word and only bolds the 'd' glyph", () => {
    const html = renderToStaticMarkup(<Wordmark word="ab" />);
    expect(html).toMatch(/<span[^>]*>a<\/span>/);
    expect(html).toMatch(/<span[^>]*>b<\/span>/);
    // No letter span carries the bold-d class (the dot span uses
    // ds-wordmark__dot, which is a separate class — match exactly).
    expect(html).not.toMatch(/class="ds-wordmark__d"/);
  });

  it("derives an aria-label from the word, including the dot", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toContain('aria-label="iedora."');
  });

  it("honours an explicit aria-label", () => {
    const html = renderToStaticMarkup(<Wordmark ariaLabel="Iedora studio" />);
    expect(html).toContain('aria-label="Iedora studio"');
  });

  it("appends a custom className alongside the base class", () => {
    const html = renderToStaticMarkup(<Wordmark className="my-extra" />);
    expect(html).toMatch(/class="ds-wordmark ds-wordmark--display my-extra"/);
  });

  it("declares the root role as img so screen readers announce it once", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toContain('role="img"');
  });
});
