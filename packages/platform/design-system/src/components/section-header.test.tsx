import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionHeader } from "./section-header";

describe("SectionHeader", () => {
  it("renders as a <header> with correct base structure and default h2 title", () => {
    const html = renderToStaticMarkup(<SectionHeader title="Overview" />);
    expect(html).toContain('<header class="ds-section-header">');
    expect(html).toContain('<h2 class="ds-section-header__title">Overview</h2>');
  });

  it("renders hint when provided", () => {
    const html = renderToStaticMarkup(
      <SectionHeader title="Overview" hint="snapshot @ 10:00" />,
    );
    expect(html).toContain('<span class="ds-section-header__hint">snapshot @ 10:00</span>');
  });

  it("customizes the title tag using the 'as' prop", () => {
    const html = renderToStaticMarkup(
      <SectionHeader title="Overview" as="h3" />,
    );
    expect(html).toContain('<h3 class="ds-section-header__title">Overview</h3>');
  });

  it("appends custom className to the wrapper", () => {
    const html = renderToStaticMarkup(
      <SectionHeader title="Overview" className="custom-style" />,
    );
    expect(html).toContain('class="ds-section-header custom-style"');
  });

  it("forwards extra HTML attributes", () => {
    const html = renderToStaticMarkup(
      <SectionHeader title="Overview" data-testid="sh-1" aria-label="sh-label" />,
    );
    expect(html).toContain('data-testid="sh-1"');
    expect(html).toContain('aria-label="sh-label"');
  });
});
