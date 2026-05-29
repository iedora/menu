import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageProgress } from "./page-progress";

describe("PageProgress", () => {
  it("renders an aria-hidden rail with an inner fill", () => {
    const html = renderToStaticMarkup(<PageProgress />);
    expect(html).toContain('class="ds-pageprog"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="ds-pageprog__fill"');
  });

  it("appends a custom className alongside the base class", () => {
    const html = renderToStaticMarkup(<PageProgress className="extra" />);
    expect(html).toContain('class="ds-pageprog extra"');
  });
});
