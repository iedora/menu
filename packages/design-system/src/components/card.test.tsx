import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Card,
  CardDesc,
  CardFoot,
  CardIndex,
  CardTitle,
  CardVisual,
} from "./card";

describe("Card", () => {
  it("renders a <div> with the base class", () => {
    const html = renderToStaticMarkup(<Card>cell</Card>);
    expect(html).toMatch(/^<div class="ds-card">cell<\/div>$/);
  });

  it("forwards arbitrary html attributes", () => {
    const html = renderToStaticMarkup(
      <Card id="metamenu" role="article">
        x
      </Card>,
    );
    expect(html).toContain('id="metamenu"');
    expect(html).toContain('role="article"');
  });
});

describe("CardIndex", () => {
  it("renders the index strip class", () => {
    const html = renderToStaticMarkup(<CardIndex>Work № 01</CardIndex>);
    expect(html).toContain('class="ds-card__idx"');
    expect(html).toContain("Work № 01");
  });
});

describe("CardVisual", () => {
  it("renders the visual class", () => {
    const html = renderToStaticMarkup(<CardVisual />);
    expect(html).toContain('class="ds-card__visual"');
  });

  it("hides empty visuals from assistive tech via aria-hidden", () => {
    const html = renderToStaticMarkup(<CardVisual />);
    expect(html).toContain('aria-hidden="true"');
  });

  it("exposes the visual when it has content", () => {
    const html = renderToStaticMarkup(
      <CardVisual>
        <img alt="" src="x" />
      </CardVisual>,
    );
    expect(html).not.toContain('aria-hidden="true"');
  });
});

describe("CardTitle", () => {
  it("renders as h5 by default", () => {
    const html = renderToStaticMarkup(<CardTitle>metamenu</CardTitle>);
    expect(html).toMatch(/^<h5 class="ds-card__title">metamenu<\/h5>$/);
  });

  it("respects an explicit heading level", () => {
    const html = renderToStaticMarkup(<CardTitle as="h3">x</CardTitle>);
    expect(html).toMatch(/^<h3[^>]*>x<\/h3>$/);
  });
});

describe("CardDesc", () => {
  it("renders a <p> with the desc class", () => {
    const html = renderToStaticMarkup(<CardDesc>A QR menu system.</CardDesc>);
    expect(html).toMatch(/^<p class="ds-card__desc">A QR menu system\.<\/p>$/);
  });
});

describe("CardFoot", () => {
  it("renders the foot class with split children", () => {
    const html = renderToStaticMarkup(
      <CardFoot>
        <span>QR · Menu</span>
        <span>iedora.metamenu.com</span>
      </CardFoot>,
    );
    expect(html).toContain('class="ds-card__foot"');
    expect(html).toContain("QR · Menu");
    expect(html).toContain("iedora.metamenu.com");
  });
});
