import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Timeline } from "./timeline";

const marks = [
  { label: "Begin", left: 0.05, at: 0.08 },
  { label: "Build", left: 0.27, at: 0.28 },
  { label: "Tend",  left: 0.50, at: 0.52 },
  { label: "Refine", left: 0.73, at: 0.75 },
  { label: "Keep",  left: 0.95, at: 0.94 },
];

describe("Timeline", () => {
  it("renders the line + grow + head shell", () => {
    const html = renderToStaticMarkup(<Timeline marks={marks} />);
    expect(html).toContain('class="ds-timeline"');
    expect(html).toContain('class="ds-timeline__line"');
    expect(html).toContain('class="ds-timeline__grow"');
    expect(html).toContain('class="ds-timeline__head"');
  });

  it("renders one mark per entry with data-at and the left position", () => {
    const html = renderToStaticMarkup(<Timeline marks={marks} />);
    expect((html.match(/class="ds-timeline__mark"/g) ?? []).length).toBe(5);
    expect(html).toContain('data-at="0.08"');
    expect(html).toContain("left:5.00%");
    expect(html).toContain("Begin");
    expect(html).toContain("Keep");
  });
});
