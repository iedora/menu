import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SendButton } from "./send-button";

describe("SendButton", () => {
  it("renders as a <button> with the editorial class and a default 'Send' label", () => {
    const html = renderToStaticMarkup(<SendButton />);
    expect(html).toMatch(/^<button[^>]*class="ds-send-btn"[^>]*>/);
    expect(html).toContain("<span>Send</span>");
  });

  it("appends a decorative arrow span after the label", () => {
    const html = renderToStaticMarkup(<SendButton />);
    expect(html).toContain(
      '<span class="ds-send-btn__arrow" aria-hidden="true">→</span>',
    );
  });

  it("defaults to type='submit' for form usage", () => {
    const html = renderToStaticMarkup(<SendButton />);
    expect(html).toContain('type="submit"');
  });

  it("allows overriding the type prop (e.g. for non-form buttons)", () => {
    const html = renderToStaticMarkup(<SendButton type="button" />);
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });

  it("renders custom children in place of the default label", () => {
    const html = renderToStaticMarkup(<SendButton>Continue</SendButton>);
    expect(html).toContain("<span>Continue</span>");
    expect(html).not.toContain("<span>Send</span>");
  });

  it("forwards arbitrary html attributes including disabled and aria-label", () => {
    const html = renderToStaticMarkup(
      <SendButton disabled aria-label="Submit form" />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="Submit form"');
  });

  it("appends a custom className alongside the base class", () => {
    const html = renderToStaticMarkup(<SendButton className="my-cta" />);
    expect(html).toContain('class="ds-send-btn my-cta"');
  });
});
