import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HouseSvg } from "./house-svg";

describe("HouseSvg", () => {
  it("renders an aria-hidden svg with the ds-house-svg class", () => {
    const html = renderToStaticMarkup(<HouseSvg />);
    expect(html).toMatch(/^<svg class="ds-house-svg" viewBox="0 0 320 280" aria-hidden="true">/);
  });

  it("includes all 10 drawn segments + 2 faded elements with data-* attrs", () => {
    const html = renderToStaticMarkup(<HouseSvg />);
    // 6 <line> + 4 <polyline> all draw; circle + text both fade (no data-len)
    expect((html.match(/data-len=/g) ?? []).length).toBe(10);
    expect((html.match(/data-start=/g) ?? []).length).toBe(12);
    expect((html.match(/data-end=/g) ?? []).length).toBe(12);
  });

  it("renders the cinnabar door knob with the accent class", () => {
    const html = renderToStaticMarkup(<HouseSvg />);
    expect(html).toContain("ds-house-svg__accent");
  });

  it("renders the IEDORA · MMXXVI stamp", () => {
    const html = renderToStaticMarkup(<HouseSvg />);
    expect(html).toContain("IEDORA · MMXXVI");
  });
});
