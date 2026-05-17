import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Tab, Tabs } from "./tabs";

describe("Tabs", () => {
  it("renders as a role=tablist container", () => {
    const html = renderToStaticMarkup(
      <Tabs>
        <Tab active>Works</Tab>
        <Tab>About</Tab>
      </Tabs>,
    );
    expect(html).toMatch(/^<div[^>]*role="tablist"[^>]*class="ds-tabs"[^>]*>/);
  });
});

describe("Tab", () => {
  it("renders as a <button> with type='button' by default", () => {
    const html = renderToStaticMarkup(<Tab>About</Tab>);
    expect(html).toMatch(/^<button[^>]*type="button"[^>]*>/);
    expect(html).toContain('role="tab"');
  });

  it("marks the active tab with aria-selected and the --on modifier", () => {
    const html = renderToStaticMarkup(<Tab active>Works</Tab>);
    expect(html).toContain('class="ds-tabs__tab ds-tabs__tab--on"');
    expect(html).toContain('aria-selected="true"');
  });

  it("inactive tabs get aria-selected=false and no --on", () => {
    const html = renderToStaticMarkup(<Tab>Contact</Tab>);
    expect(html).toContain('aria-selected="false"');
    expect(html).not.toContain("ds-tabs__tab--on");
  });
});
