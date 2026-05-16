import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Lintel } from "./lintel";

describe("Lintel", () => {
  it("renders an inline wordmark + rule + empty end slot by default", () => {
    const html = renderToStaticMarkup(<Lintel />);
    expect(html).toMatch(/^<div class="ds-lintel">/);
    // inline wordmark
    expect(html).toContain("ds-wordmark--inline");
    // hairline rule between wordmark and end slot
    expect(html).toContain(
      '<span class="ds-lintel__rule" aria-hidden="true">',
    );
    // empty placeholder on the right
    expect(html).toMatch(/<span aria-hidden="true"><\/span>/);
  });

  it("places the `end` slot on the right when provided", () => {
    const html = renderToStaticMarkup(
      <Lintel end={<button type="button">Back</button>} />,
    );
    expect(html).toContain("ds-wordmark--inline");
    expect(html).toContain('<button type="button">Back</button>');
    // no empty placeholder when end is provided
    expect(html).not.toMatch(/<span aria-hidden="true"><\/span>/);
  });

  it("renders only the children when children is provided (skips the default layout)", () => {
    const html = renderToStaticMarkup(
      <Lintel>
        <span data-testid="custom">custom content</span>
      </Lintel>,
    );
    expect(html).toContain("custom content");
    // default layout pieces are not rendered
    expect(html).not.toContain("ds-wordmark");
    expect(html).not.toContain("ds-lintel__rule");
  });

  it("appends a custom className to the root div", () => {
    const html = renderToStaticMarkup(<Lintel className="my-bar" />);
    expect(html).toMatch(/^<div class="ds-lintel my-bar">/);
  });
});
