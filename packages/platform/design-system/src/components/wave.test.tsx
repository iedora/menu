import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Wave } from "./wave";

describe("Wave", () => {
  it("renders an aria-hidden wrap with 96 bars", () => {
    const html = renderToStaticMarkup(<Wave />);
    expect(html).toContain('class="ds-wave"');
    expect(html).toContain('aria-hidden="true"');
    const bars = html.match(/class="ds-wave__bar/g) ?? [];
    expect(bars.length).toBe(96);
  });

  it("marks every 13th bar as accent (0, 13, 26, 39, 52, 65, 78, 91)", () => {
    const html = renderToStaticMarkup(<Wave />);
    const accents = html.match(/ds-wave__bar ds-wave__bar--accent/g) ?? [];
    expect(accents.length).toBe(8);
  });

  it("writes a stable --h custom property on every bar", () => {
    const html = renderToStaticMarkup(<Wave />);
    // each bar carries `--h:` as an inline style
    expect((html.match(/--h:/g) ?? []).length).toBe(96);
  });

  it("is byte-stable across calls (SSR safe — no Math.random)", () => {
    const a = renderToStaticMarkup(<Wave />);
    const b = renderToStaticMarkup(<Wave />);
    expect(a).toBe(b);
  });
});
