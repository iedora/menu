import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrollHint } from "./scroll-hint";

describe("ScrollHint", () => {
  it("renders aria-hidden by default with the legacy 'Scroll to enter' copy", () => {
    const html = renderToStaticMarkup(<ScrollHint />);
    expect(html).toContain('class="ds-scroll-hint"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Scroll to enter");
    expect(html).toContain('class="ds-scroll-hint__nub"');
  });

  it("accepts custom children", () => {
    const html = renderToStaticMarkup(<ScrollHint>Roll the screen</ScrollHint>);
    expect(html).toContain("Roll the screen");
  });
});
