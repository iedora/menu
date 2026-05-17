import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ScrollPinned,
  ScrollPinnedFoot,
  ScrollPinnedHead,
  ScrollPinnedStage,
} from "./scroll-pinned";

describe("ScrollPinned", () => {
  it("renders the v-track + v-pin wrapper around children", () => {
    const html = renderToStaticMarkup(
      <ScrollPinned data-value="0">
        <p>inside</p>
      </ScrollPinned>,
    );
    expect(html).toMatch(/class="ds-value"/);
    expect(html).toContain('class="ds-v-track"');
    expect(html).toContain('class="ds-v-pin"');
    expect(html).toContain("inside");
    expect(html).toContain('data-value="0"');
  });

  it("applies the variant class when provided", () => {
    const html = renderToStaticMarkup(
      <ScrollPinned variant="ds-value--mission">x</ScrollPinned>,
    );
    expect(html).toContain('class="ds-value ds-value--mission"');
  });
});

describe("ScrollPinnedHead", () => {
  it("renders num, name, rule, and right label", () => {
    const html = renderToStaticMarkup(
      <ScrollPinnedHead num="/ 01" name="Mission" right="The roof, first." />,
    );
    expect(html).toContain('class="ds-v-head"');
    expect(html).toContain('class="ds-v-head__num">/ 01<');
    expect(html).toContain('class="ds-v-head__name">Mission<');
    expect(html).toContain('class="ds-v-head__rule"');
    expect(html).toContain("The roof, first.");
  });

  it("renders the live dot when live is true", () => {
    const html = renderToStaticMarkup(
      <ScrollPinnedHead num="/ 01" name="Works" right="In service" live />,
    );
    expect(html).toContain("ds-v-head__live-dot");
  });

  it("omits the live dot by default", () => {
    const html = renderToStaticMarkup(
      <ScrollPinnedHead num="/ 01" name="x" />,
    );
    expect(html).not.toContain("ds-v-head__live-dot");
  });
});

describe("ScrollPinnedStage", () => {
  it("wraps children with ds-v-stage", () => {
    const html = renderToStaticMarkup(
      <ScrollPinnedStage>
        <span>inside</span>
      </ScrollPinnedStage>,
    );
    expect(html).toContain('class="ds-v-stage"');
    expect(html).toContain("inside");
  });
});

describe("ScrollPinnedFoot", () => {
  it("renders left/right labels and the progress bar with fill + pin", () => {
    const html = renderToStaticMarkup(
      <ScrollPinnedFoot leftLabel="Drawing" rightLabel="01 / 04" />,
    );
    expect(html).toContain('class="ds-v-foot"');
    expect(html).toContain("Drawing");
    expect(html).toContain("01 / 04");
    expect(html).toContain('class="ds-v-foot__bar"');
    expect(html).toContain('class="ds-v-foot__bar-fill"');
    expect(html).toContain('class="ds-v-foot__bar-pin"');
  });
});
