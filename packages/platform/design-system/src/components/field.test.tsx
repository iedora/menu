import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Field,
  FieldError,
  FieldHint,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
  SelectField,
  TextField,
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

  it("adds ds-input--compact when compact is set", () => {
    const html = renderToStaticMarkup(<FieldInput compact />);
    expect(html).toContain("ds-input ds-input--compact");
  });

  it("omits ds-input--compact by default", () => {
    const html = renderToStaticMarkup(<FieldInput />);
    expect(html).not.toContain("ds-input--compact");
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

  it("adds ds-textarea--compact when compact is set", () => {
    const html = renderToStaticMarkup(<FieldTextarea compact />);
    expect(html).toContain("ds-textarea ds-textarea--compact");
  });
});

describe("FieldInput error state", () => {
  it("sets aria-invalid + the --error class when error", () => {
    const html = renderToStaticMarkup(<FieldInput error name="email" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("ds-input--error");
  });

  it("stays valid by default", () => {
    const html = renderToStaticMarkup(<FieldInput name="email" />);
    expect(html).not.toContain('aria-invalid="true"');
    expect(html).not.toContain("ds-input--error");
  });
});

describe("FieldError", () => {
  it('renders a role="alert" paragraph carrying the test id', () => {
    const html = renderToStaticMarkup(<FieldError id="email-msg">Required</FieldError>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-test-id="field-error"');
    expect(html).toContain('id="email-msg"');
    expect(html).toContain("Required");
  });
});

describe("FieldSelect", () => {
  it("renders a native <select> with options", () => {
    const html = renderToStaticMarkup(
      <FieldSelect name="lang">
        <option value="en">English</option>
      </FieldSelect>,
    );
    expect(html).toMatch(/<select[^>]*name="lang"/);
    expect(html).toContain("English");
  });

  it("marks aria-invalid when error", () => {
    const html = renderToStaticMarkup(
      <FieldSelect error name="lang">
        <option value="en">English</option>
      </FieldSelect>,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("ds-select--error");
  });
});

describe("TextField (composed)", () => {
  it("wires label htmlFor to the input id and shows a hint when valid", () => {
    const html = renderToStaticMarkup(
      <TextField label="Email" name="email" hint="We write back slowly." />,
    );
    // Label points at the input; both derive the id from `name`.
    expect(html).toContain('for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain("We write back slowly.");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("surfaces an error: aria-invalid + describedby + role=alert, hint suppressed", () => {
    const html = renderToStaticMarkup(
      <TextField label="Email" name="email" hint="ignored" error="Enter a valid email." />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-msg"');
    expect(html).toContain('id="email-msg"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Enter a valid email.");
    expect(html).not.toContain("ignored");
  });
});

describe("SelectField (composed)", () => {
  it("associates the error message with the select", () => {
    const html = renderToStaticMarkup(
      <SelectField label="Language" name="lang" error="Pick a language.">
        <option value="en">English</option>
      </SelectField>,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="lang-msg"');
    expect(html).toContain("Pick a language.");
  });
});
