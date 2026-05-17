import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScreenLabel } from "./screen-label";

describe("ScreenLabel", () => {
  it("renders aria-hidden corner mark, hidden by default", () => {
    const html = renderToStaticMarkup(<ScreenLabel>01 House</ScreenLabel>);
    expect(html).toContain('class="ds-screen-label"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("01 House");
    expect(html).not.toContain("ds-screen-label--on");
  });

  it("applies the on modifier when on is true", () => {
    const html = renderToStaticMarkup(<ScreenLabel on>01 House</ScreenLabel>);
    expect(html).toContain("ds-screen-label ds-screen-label--on");
  });

  it("appends a custom className", () => {
    const html = renderToStaticMarkup(
      <ScreenLabel className="extra">x</ScreenLabel>,
    );
    expect(html).toContain('class="ds-screen-label extra"');
  });
});
