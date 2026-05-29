import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BrowserIcon, OsIcon } from "./client-icons";

describe("BrowserIcon", () => {
  it("resolves Chrome by name", () => {
    const html = renderToStaticMarkup(<BrowserIcon name="Chrome" className="h-3 w-3" />);
    expect(html).toContain('class="h-3 w-3"');
    expect(html).toContain("#EA4335"); // Chrome red wedge
  });

  it("resolves Safari, Firefox, Edge, Opera by case-insensitive substring", () => {
    expect(renderToStaticMarkup(<BrowserIcon name="safari" />)).toContain("ds-safari");
    expect(renderToStaticMarkup(<BrowserIcon name="Firefox 122" />)).toContain("ds-firefox-globe");
    expect(renderToStaticMarkup(<BrowserIcon name="MS Edge" />)).toContain("ds-edge");
    expect(renderToStaticMarkup(<BrowserIcon name="Opera GX" />)).toContain("ds-opera");
  });

  it("falls back to a generic globe", () => {
    const html = renderToStaticMarkup(<BrowserIcon name="Lynx" />);
    expect(html).toContain("ds-generic-browser");
  });
});

describe("OsIcon", () => {
  it("returns the Apple mark for macOS and iOS", () => {
    expect(renderToStaticMarkup(<OsIcon name="macOS" />)).toContain("ds-apple");
    expect(renderToStaticMarkup(<OsIcon name="iOS" />)).toContain("ds-apple");
  });

  it("resolves Windows, Linux, Android by name", () => {
    expect(renderToStaticMarkup(<OsIcon name="Windows 11" />)).toContain("#00ADEF");
    expect(renderToStaticMarkup(<OsIcon name="Linux x86_64" />)).toContain("ds-tux-beak");
    expect(renderToStaticMarkup(<OsIcon name="Android 14" />)).toContain("#3DDC84");
  });

  it("falls back to a generic device", () => {
    const html = renderToStaticMarkup(<OsIcon name="BeOS" />);
    expect(html).toContain("ds-generic-device");
  });
});
