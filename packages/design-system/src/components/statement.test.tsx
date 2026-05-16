import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Statement } from "./statement";

describe("Statement", () => {
  it("renders a <p> with the editorial class and the children inside", () => {
    const html = renderToStaticMarkup(<Statement>Quiet house.</Statement>);
    expect(html).toMatch(/^<p class="ds-statement">Quiet house\.<\/p>$/);
  });

  it("preserves inline <em> children (used to upright a word)", () => {
    const html = renderToStaticMarkup(
      <Statement>
        A quiet house for <em>digital craftsmanship</em>.
      </Statement>,
    );
    expect(html).toContain("<em>digital craftsmanship</em>");
  });

  it("appends a custom className", () => {
    const html = renderToStaticMarkup(
      <Statement className="hero">x</Statement>,
    );
    expect(html).toContain('class="ds-statement hero"');
  });

  it("forwards arbitrary html attributes", () => {
    const html = renderToStaticMarkup(
      <Statement id="lede" lang="en">
        x
      </Statement>,
    );
    expect(html).toContain('id="lede"');
    expect(html).toContain('lang="en"');
  });
});
