import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox, Toggle } from "./check-toggle";

describe("Checkbox", () => {
  it("renders a <label> wrapping a hidden input + visual box + the children", () => {
    const html = renderToStaticMarkup(
      <Checkbox name="opt">Keep this work in service</Checkbox>,
    );
    expect(html).toMatch(/^<label class="ds-check"[^>]*>/);
    expect(html).toContain('<span class="ds-check__box" aria-hidden="true">');
    expect(html).toContain('class="ds-check__tick"');
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*class="ds-check__input"[^>]*\/>/);
    expect(html).toContain("Keep this work in service");
  });

  it("adds the --on modifier when checked", () => {
    const html = renderToStaticMarkup(
      <Checkbox checked name="x">
        On
      </Checkbox>,
    );
    expect(html).toContain('class="ds-check ds-check--on"');
    expect(html).toContain("checked");
  });

  it("omits checked when not on", () => {
    const html = renderToStaticMarkup(<Checkbox name="x">x</Checkbox>);
    expect(html).not.toContain("ds-check--on");
  });

  it("forwards name + value through to the underlying input", () => {
    const html = renderToStaticMarkup(
      <Checkbox name="opt" value="yes">
        x
      </Checkbox>,
    );
    expect(html).toContain('name="opt"');
    expect(html).toContain('value="yes"');
  });
});

describe("Toggle", () => {
  it("renders a <label> with the toggle classes + role=switch input", () => {
    const html = renderToStaticMarkup(<Toggle name="analytics">Analytics</Toggle>);
    expect(html).toMatch(/^<label class="ds-toggle"[^>]*>/);
    expect(html).toContain('<span class="ds-toggle__track" aria-hidden="true">');
    expect(html).toContain('class="ds-toggle__knob"');
    expect(html).toContain('role="switch"');
    expect(html).toContain("Analytics");
  });

  it("adds the --on modifier when checked", () => {
    const html = renderToStaticMarkup(
      <Toggle checked name="x">
        On
      </Toggle>,
    );
    expect(html).toContain('class="ds-toggle ds-toggle--on"');
  });
});
