import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Field,
  FieldHint,
  FieldInput,
  FieldLabel,
  FieldTextarea,
} from "./field";

describe("Field", () => {
  it("renders a <div> with the base class", () => {
    const html = renderToStaticMarkup(<Field>x</Field>);
    expect(html).toMatch(/^<div class="ds-field">x<\/div>$/);
  });

  it("adds the error modifier when error=true", () => {
    const html = renderToStaticMarkup(<Field error>x</Field>);
    expect(html).toContain('class="ds-field ds-field--error"');
  });

  it("omits the error modifier by default", () => {
    const html = renderToStaticMarkup(<Field>x</Field>);
    expect(html).not.toContain("ds-field--error");
  });

  it("forwards arbitrary html attributes", () => {
    const html = renderToStaticMarkup(
      <Field id="email-field" data-testid="f">
        x
      </Field>,
    );
    expect(html).toContain('id="email-field"');
    expect(html).toContain('data-testid="f"');
  });
});

describe("FieldLabel", () => {
  it("renders a <label> with the label class", () => {
    const html = renderToStaticMarkup(<FieldLabel>Email</FieldLabel>);
    expect(html).toMatch(/^<label class="ds-field__label">Email<\/label>$/);
  });

  it("forwards htmlFor", () => {
    const html = renderToStaticMarkup(
      <FieldLabel htmlFor="email">Email</FieldLabel>,
    );
    expect(html).toContain('for="email"');
  });
});

describe("FieldHint", () => {
  it("renders a <span> with the hint class", () => {
    const html = renderToStaticMarkup(<FieldHint>We write back slowly.</FieldHint>);
    expect(html).toMatch(
      /^<span class="ds-field__hint">We write back slowly\.<\/span>$/,
    );
  });
});

describe("FieldInput", () => {
  it("renders a bare <input> — styling comes from the parent .ds-field rule", () => {
    const html = renderToStaticMarkup(
      <FieldInput type="email" name="email" placeholder="name@iedora.com" />,
    );
    expect(html).toMatch(/<input[^>]*type="email"[^>]*\/>/);
    expect(html).toContain('placeholder="name@iedora.com"');
  });
});

describe("FieldTextarea", () => {
  it("renders a bare <textarea>", () => {
    const html = renderToStaticMarkup(
      <FieldTextarea name="message" placeholder="—" />,
    );
    expect(html).toMatch(/<textarea[^>]*name="message"[^>]*>/);
    expect(html).toContain('placeholder="—"');
  });
});
