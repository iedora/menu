import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
  it("renders the default 'iedora.' letter-by-letter with the cinnabar dot", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    // each glyph is its own <span class="ds-wordmark__letter"> so the
    // reveal animation can stagger them
    expect(html).toMatch(/<span class="ds-wordmark__letter"[^>]*aria-hidden="true"[^>]*>i<\/span>/);
    expect(html).toMatch(/<span class="ds-wordmark__letter"[^>]*aria-hidden="true"[^>]*>e<\/span>/);
    expect(html).toMatch(/<span class="ds-wordmark__letter ds-wordmark__d"[^>]*>d<\/span>/);
    expect(html).toMatch(/<span class="ds-wordmark__letter"[^>]*aria-hidden="true"[^>]*>o<\/span>/);
    expect(html).toMatch(/<span class="ds-wordmark__letter"[^>]*aria-hidden="true"[^>]*>r<\/span>/);
    expect(html).toMatch(/<span class="ds-wordmark__letter"[^>]*aria-hidden="true"[^>]*>a<\/span>/);
    // the dot carries the cinnabar class on the same letter span so it
    // joins the reveal stagger like any other glyph
    expect(html).toMatch(
      /<span class="ds-wordmark__letter ds-wordmark__dot"[^>]*>\.<\/span>/,
    );
  });

  it("assigns sequential --ds-wordmark-letter-i indices for the reveal stagger", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    // i=0..5 for letters + i=6 for the dot
    expect(html).toContain("--ds-wordmark-letter-i:0");
    expect(html).toContain("--ds-wordmark-letter-i:5");
    expect(html).toContain("--ds-wordmark-letter-i:6");
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
    expect(html).toMatch(/<span class="ds-wordmark__letter"[^>]*>a<\/span>/);
    expect(html).toMatch(/<span class="ds-wordmark__letter"[^>]*>b<\/span>/);
    // No letter span carries the bold-d modifier (the dot span uses
    // ds-wordmark__dot — anchor on the closing quote to disambiguate).
    expect(html).not.toMatch(/ds-wordmark__letter ds-wordmark__d"/);
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
