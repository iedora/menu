import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusChip } from "./status-chip";

describe("StatusChip", () => {
  it("renders a <span> with the ds-chip-nav__chip base class", () => {
    const html = renderToStaticMarkup(<StatusChip label="Idealista" />);
    expect(html).toMatch(/^<span[^>]*class="[^"]*ds-chip-nav__chip[^"]*"/);
  });

  it("renders the label text", () => {
    const html = renderToStaticMarkup(<StatusChip label="OLX" />);
    expect(html).toContain("OLX");
  });

  it("defaults to neutral variant — no data-active", () => {
    const html = renderToStaticMarkup(<StatusChip label="Custo Justo" />);
    expect(html).toContain('data-active="false"');
    expect(html).not.toContain("#fef2f2");
    expect(html).not.toContain("#ef4444");
  });

  it("success variant sets data-active=true", () => {
    const html = renderToStaticMarkup(
      <StatusChip label="Idealista" variant="success" />,
    );
    expect(html).toContain('data-active="true"');
  });

  it("danger variant applies red inline styles", () => {
    const html = renderToStaticMarkup(
      <StatusChip label="OLX" variant="danger" />,
    );
    expect(html).toContain("#fef2f2");
    expect(html).toContain("#ef4444");
    expect(html).toContain("#dc2626");
  });

  it("renders icon when provided", () => {
    const html = renderToStaticMarkup(
      <StatusChip label="Idealista" icon={<svg data-test-id="icon" />} />,
    );
    expect(html).toContain("<svg");
  });

  it("appends a custom className alongside the base class", () => {
    const html = renderToStaticMarkup(
      <StatusChip label="OLX" className="my-chip" />,
    );
    expect(html).toContain("ds-chip-nav__chip");
    expect(html).toContain("my-chip");
  });

  it("has role=status for accessibility", () => {
    const html = renderToStaticMarkup(<StatusChip label="Idealista" />);
    expect(html).toContain('role="status"');
  });
});
