import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Shoji, ShojiReceipt } from "./shoji";

describe("Shoji", () => {
  it("renders the form + receipt wrapped in ds-shoji with aria-live", () => {
    const html = renderToStaticMarkup(
      <Shoji form={<form>F</form>} receipt={<ShojiReceipt />} />,
    );
    expect(html).toContain('class="ds-shoji"');
    expect(html).toContain('class="ds-shoji__inner"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("<form>F</form>");
  });

  it("applies the sent modifier when sent is true", () => {
    const html = renderToStaticMarkup(
      <Shoji sent form={<form />} receipt={<ShojiReceipt />} />,
    );
    expect(html).toContain('class="ds-shoji ds-shoji--sent"');
  });
});

describe("ShojiReceipt", () => {
  it("renders the cinnabar seal, italic title, and copy", () => {
    const html = renderToStaticMarkup(<ShojiReceipt />);
    expect(html).toContain('class="ds-shoji__receipt-inner"');
    expect(html).toContain('class="ds-shoji__seal"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="ds-shoji__title"');
    expect(html).toContain("Received, gently.");
    expect(html).toContain("Your message is inside the house.");
  });

  it("accepts custom title and body", () => {
    const html = renderToStaticMarkup(
      <ShojiReceipt title="Thanks." seal="✓">
        We are reading it now.
      </ShojiReceipt>,
    );
    expect(html).toContain("Thanks.");
    expect(html).toContain("We are reading it now.");
    expect(html).toContain("✓");
  });
});
