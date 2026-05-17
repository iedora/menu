import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";

describe("Button", () => {
  it("renders as a <button> with the base class by default", () => {
    const html = renderToStaticMarkup(<Button>Begin</Button>);
    expect(html).toMatch(/^<button[^>]*class="ds-btn"[^>]*>/);
  });

  it("defaults to type='button' to avoid form-submit surprises", () => {
    const html = renderToStaticMarkup(<Button>Begin</Button>);
    expect(html).toContain('type="button"');
  });

  it("respects an explicit submit type", () => {
    const html = renderToStaticMarkup(<Button type="submit">Send</Button>);
    expect(html).toContain('type="submit"');
  });

  it("applies the solid variant", () => {
    const html = renderToStaticMarkup(<Button variant="solid">Send</Button>);
    expect(html).toContain('class="ds-btn ds-btn--solid"');
  });

  it("applies the ghost variant", () => {
    const html = renderToStaticMarkup(<Button variant="ghost">Quietly</Button>);
    expect(html).toContain('class="ds-btn ds-btn--ghost"');
  });

  it("applies the accent variant", () => {
    const html = renderToStaticMarkup(<Button variant="accent">Send</Button>);
    expect(html).toContain('class="ds-btn ds-btn--accent"');
  });

  it("renders a default cinnabar arrow when arrow=true", () => {
    const html = renderToStaticMarkup(<Button arrow>Begin</Button>);
    expect(html).toContain(
      '<span class="ds-btn__arrow" aria-hidden="true">↗</span>',
    );
  });

  it("renders a custom arrow node when arrow is a ReactNode", () => {
    const html = renderToStaticMarkup(<Button arrow={<>→</>}>Begin</Button>);
    expect(html).toContain(
      '<span class="ds-btn__arrow" aria-hidden="true">→</span>',
    );
  });

  it("omits the arrow when arrow is unset / falsy", () => {
    const html = renderToStaticMarkup(<Button>Begin</Button>);
    expect(html).not.toContain("ds-btn__arrow");
  });

  it("renders as <a> when href is provided", () => {
    const html = renderToStaticMarkup(
      <Button href="/works" variant="solid">
        Read the rooms
      </Button>,
    );
    expect(html).toMatch(/^<a[^>]*href="\/works"[^>]*>/);
    expect(html).toContain('class="ds-btn ds-btn--solid"');
    expect(html).not.toContain("<button");
  });

  it("forwards arbitrary html attributes including disabled and aria-label", () => {
    const html = renderToStaticMarkup(
      <Button disabled aria-label="Submit form">
        x
      </Button>,
    );
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="Submit form"');
  });

  it("appends a custom className alongside the base class", () => {
    const html = renderToStaticMarkup(<Button className="my-cta">x</Button>);
    expect(html).toContain('class="ds-btn my-cta"');
  });

  it("wraps children in a <span> so the arrow lays out next to them", () => {
    const html = renderToStaticMarkup(<Button>Begin a work</Button>);
    expect(html).toContain("<span>Begin a work</span>");
  });
});
