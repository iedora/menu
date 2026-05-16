import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EditorialInput,
  EditorialTextarea,
  Pane,
  PaneGrid,
  PaneLabel,
} from "./pane";

describe("PaneGrid", () => {
  it("renders a div with the grid class and wraps children", () => {
    const html = renderToStaticMarkup(
      <PaneGrid>
        <span data-testid="child">child</span>
      </PaneGrid>,
    );
    expect(html).toMatch(/^<div class="ds-pane-grid">/);
    expect(html).toContain("<span");
    expect(html).toContain("child");
  });

  it("appends a custom className", () => {
    const html = renderToStaticMarkup(
      <PaneGrid className="extra">{null}</PaneGrid>,
    );
    expect(html).toContain('class="ds-pane-grid extra"');
  });

  it("forwards arbitrary html attributes", () => {
    const html = renderToStaticMarkup(
      <PaneGrid id="contact-grid" role="group">
        {null}
      </PaneGrid>,
    );
    expect(html).toContain('id="contact-grid"');
    expect(html).toContain('role="group"');
  });
});

describe("Pane", () => {
  it("renders as a <label> with the pane class", () => {
    const html = renderToStaticMarkup(<Pane>field</Pane>);
    expect(html).toMatch(/^<label class="ds-pane">/);
  });

  it("adds the full modifier when full is true", () => {
    const html = renderToStaticMarkup(<Pane full>field</Pane>);
    expect(html).toContain("ds-pane ds-pane--full");
  });

  it("omits the full modifier when full is false / unset", () => {
    const html = renderToStaticMarkup(<Pane>field</Pane>);
    expect(html).not.toContain("ds-pane--full");
  });

  it("forwards htmlFor and other label attributes", () => {
    const html = renderToStaticMarkup(<Pane htmlFor="email">field</Pane>);
    expect(html).toContain('for="email"');
  });
});

describe("PaneLabel", () => {
  it("renders mono caps label without a hint span when no hint is provided", () => {
    const html = renderToStaticMarkup(<PaneLabel>Name</PaneLabel>);
    expect(html).toContain('class="ds-pane__label"');
    expect(html).toContain("<span>Name</span>");
    expect(html).not.toContain("ds-pane__label-hint");
  });

  it("renders the hint span when hint is provided", () => {
    const html = renderToStaticMarkup(
      <PaneLabel hint="signed">From</PaneLabel>,
    );
    expect(html).toContain('<span class="ds-pane__label-hint">signed</span>');
    expect(html).toContain("<span>From</span>");
  });

  it("accepts a ReactNode for hint", () => {
    const html = renderToStaticMarkup(
      <PaneLabel hint={<em>italic hint</em>}>From</PaneLabel>,
    );
    expect(html).toContain(
      '<span class="ds-pane__label-hint"><em>italic hint</em></span>',
    );
  });
});

describe("EditorialInput", () => {
  it("renders an <input> with the editorial class", () => {
    const html = renderToStaticMarkup(<EditorialInput type="email" name="x" />);
    expect(html).toMatch(/<input[^>]*class="ds-input"[^>]*\/>/);
  });

  it("forwards type, name, and placeholder", () => {
    const html = renderToStaticMarkup(
      <EditorialInput type="email" name="email" placeholder="you@—" />,
    );
    expect(html).toContain('type="email"');
    expect(html).toContain('name="email"');
    expect(html).toContain('placeholder="you@—"');
  });

  it("merges a custom className", () => {
    const html = renderToStaticMarkup(<EditorialInput className="wide" />);
    expect(html).toContain('class="ds-input wide"');
  });
});

describe("EditorialTextarea", () => {
  it("renders a <textarea> with the editorial class and default rows=3", () => {
    const html = renderToStaticMarkup(<EditorialTextarea name="message" />);
    expect(html).toMatch(/<textarea[^>]*class="ds-textarea"[^>]*>/);
    expect(html).toContain('rows="3"');
  });

  it("respects a custom rows value", () => {
    const html = renderToStaticMarkup(
      <EditorialTextarea name="message" rows={6} />,
    );
    expect(html).toContain('rows="6"');
  });

  it("forwards placeholder and other attributes", () => {
    const html = renderToStaticMarkup(
      <EditorialTextarea name="message" placeholder="Take your time." />,
    );
    expect(html).toContain('placeholder="Take your time."');
  });
});
