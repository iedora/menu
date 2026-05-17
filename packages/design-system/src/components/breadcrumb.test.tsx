import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Breadcrumb,
  BreadcrumbHere,
  BreadcrumbLink,
} from "./breadcrumb";

describe("Breadcrumb", () => {
  it("renders a <nav> with aria-label=Breadcrumb by default", () => {
    const html = renderToStaticMarkup(
      <Breadcrumb>
        <BreadcrumbLink href="/">Studio</BreadcrumbLink>
        <BreadcrumbHere>metamenu</BreadcrumbHere>
      </Breadcrumb>,
    );
    expect(html).toMatch(/^<nav[^>]*aria-label="Breadcrumb"[^>]*class="ds-breadcrumb"[^>]*>/);
  });

  it("inserts a forward-slash separator between siblings, never before the first", () => {
    const html = renderToStaticMarkup(
      <Breadcrumb>
        <BreadcrumbLink href="/">Studio</BreadcrumbLink>
        <BreadcrumbLink href="/works">Works</BreadcrumbLink>
        <BreadcrumbHere>metamenu</BreadcrumbHere>
      </Breadcrumb>,
    );
    // exactly two separators for three items
    expect(html.match(/ds-breadcrumb__sep/g)?.length).toBe(2);
    expect(html).toContain('aria-hidden="true">/</span>');
  });

  it("the leading item has no separator before it", () => {
    const html = renderToStaticMarkup(
      <Breadcrumb>
        <BreadcrumbLink href="/">Studio</BreadcrumbLink>
      </Breadcrumb>,
    );
    expect(html).not.toContain("ds-breadcrumb__sep");
  });
});

describe("BreadcrumbLink", () => {
  it("renders an <a> with the supplied href", () => {
    const html = renderToStaticMarkup(
      <BreadcrumbLink href="/works">Works</BreadcrumbLink>,
    );
    expect(html).toMatch(/^<a[^>]*href="\/works"[^>]*>Works<\/a>$/);
  });
});

describe("BreadcrumbHere", () => {
  it("marks the current page with aria-current and the here class", () => {
    const html = renderToStaticMarkup(<BreadcrumbHere>metamenu</BreadcrumbHere>);
    expect(html).toMatch(
      /^<span[^>]*aria-current="page"[^>]*class="ds-breadcrumb__here"[^>]*>metamenu<\/span>$/,
    );
  });
});
