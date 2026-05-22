import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Histogram, Stat, StatsPanel } from "./admin-stats";

describe("Stat", () => {
  it("renders the label, value and optional hint", () => {
    const html = renderToStaticMarkup(
      <Stat label="Sessions" value="42" hint="since last seen" />,
    );
    expect(html).toContain('class="ds-stat"');
    expect(html).toContain(">Sessions<");
    expect(html).toContain(">42<");
    expect(html).toContain(">since last seen<");
  });

  it("applies the warn modifier when tone=warn and value is non-zero", () => {
    const warn = renderToStaticMarkup(<Stat label="Stale" value="3" tone="warn" />);
    expect(warn).toContain("ds-stat--warn");

    // …but stays neutral when the value is 0 (nothing to flag).
    const calm = renderToStaticMarkup(<Stat label="Stale" value="0" tone="warn" />);
    expect(calm).not.toContain("ds-stat--warn");
  });
});

describe("Histogram", () => {
  it("renders bars normalised against the total", () => {
    const html = renderToStaticMarkup(
      <Histogram
        label="Browsers"
        entries={[
          { name: "Chrome", count: 3 },
          { name: "Safari", count: 1 },
        ]}
      />,
    );
    expect(html).toContain(">Browsers<");
    expect(html).toContain(">Chrome<");
    expect(html).toContain("width:75%");
    expect(html).toContain("width:25%");
  });

  it("renders an empty placeholder when there are no entries", () => {
    const html = renderToStaticMarkup(<Histogram label="Browsers" entries={[]} />);
    expect(html).toContain("No data.");
  });

  it("invokes renderIcon for every row", () => {
    const html = renderToStaticMarkup(
      <Histogram
        label="OS"
        entries={[{ name: "macOS", count: 2 }]}
        renderIcon={(name) => <span data-test-id={`icon-${name}`}>•</span>}
      />,
    );
    expect(html).toContain('data-test-id="icon-macOS"');
  });
});

describe("StatsPanel", () => {
  it("wraps stats + histograms in a panel section", () => {
    const html = renderToStaticMarkup(
      <StatsPanel
        title="Overview"
        snapshotAt="2026-05-22T12:00:00Z"
        stats={[<Stat key="a" label="Sessions" value="1" />]}
        histograms={[<Histogram key="b" label="Browsers" entries={[]} />]}
      />,
    );
    expect(html).toContain('class="ds-stats-panel"');
    expect(html).toContain(">Overview<");
    expect(html).toContain("snapshot @ 12:00:00Z");
    expect(html).toContain("ds-stats-panel__grid");
    expect(html).toContain("ds-stats-panel__histograms");
  });

  it("skips the histograms row when none are passed", () => {
    const html = renderToStaticMarkup(
      <StatsPanel
        title="Overview"
        stats={[<Stat key="a" label="X" value="1" />]}
      />,
    );
    expect(html).not.toContain("ds-stats-panel__histograms");
  });
});
