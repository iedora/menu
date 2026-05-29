import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoomsGrid } from "./rooms-grid";

describe("RoomsGrid", () => {
  it("renders seven cells by default with sequential data-i values", () => {
    const html = renderToStaticMarkup(<RoomsGrid />);
    expect(html).toContain('class="ds-rooms"');
    expect(html).toContain('aria-hidden="true"');
    const cells = html.match(/class="ds-room(?: ds-room--roof)?"/g) ?? [];
    expect(cells.length).toBe(7);
    expect(html).toContain('data-i="0"');
    expect(html).toContain('data-i="6"');
  });

  it("marks the first cell as the roof", () => {
    const html = renderToStaticMarkup(<RoomsGrid />);
    expect(html).toContain('class="ds-room ds-room--roof"');
  });

  it("renders the legacy default labels (Roof, menu, II..VI)", () => {
    const html = renderToStaticMarkup(<RoomsGrid />);
    expect(html).toContain("Roof");
    expect(html).toContain("menu");
    expect(html).toContain("II");
    expect(html).toContain("VI");
  });

  it("accepts custom rooms", () => {
    const html = renderToStaticMarkup(
      <RoomsGrid rooms={[{ label: "α", roof: true }, { label: "β" }]} />,
    );
    const cells = html.match(/class="ds-room(?: ds-room--roof)?"/g) ?? [];
    expect(cells.length).toBe(2);
    expect(html).toContain("α");
    expect(html).toContain("β");
  });
});
