import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Separator } from "./separator";

describe("Separator", () => {
  it("renders horizontal by default with the editorial class", () => {
    const html = renderToStaticMarkup(<Separator />);
    expect(html).toContain('class="ds-separator"');
    expect(html).toContain('data-orientation="horizontal"');
    // Decorative separators carry role="none"
    expect(html).toContain('role="none"');
  });

  it("renders vertical with the modifier class when orientation='vertical'", () => {
    const html = renderToStaticMarkup(<Separator orientation="vertical" />);
    expect(html).toContain("ds-separator--vertical");
    expect(html).toContain('data-orientation="vertical"');
  });

  it("renders as a real separator (role=separator) when not decorative", () => {
    const html = renderToStaticMarkup(<Separator decorative={false} />);
    expect(html).toContain('role="separator"');
  });

  it("appends custom className alongside the base class", () => {
    const html = renderToStaticMarkup(<Separator className="my-rule" />);
    expect(html).toContain("ds-separator my-rule");
  });
});
