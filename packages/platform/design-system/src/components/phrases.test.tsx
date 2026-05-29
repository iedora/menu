import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Phrase, Phrases } from "./phrases";

describe("Phrases", () => {
  it("renders a wrapper with the data-phrases attribute and children", () => {
    const html = renderToStaticMarkup(
      <Phrases>
        <Phrase>one</Phrase>
        <Phrase>two</Phrase>
      </Phrases>,
    );
    expect(html).toContain('class="ds-phrases"');
    expect(html).toContain("data-phrases");
    expect(html).toContain('<p class="ds-phrase">one</p>');
    expect(html).toContain('<p class="ds-phrase">two</p>');
  });

  it("applies the center modifier when asked", () => {
    const html = renderToStaticMarkup(
      <Phrases center>
        <Phrase>x</Phrase>
      </Phrases>,
    );
    expect(html).toContain('class="ds-phrases ds-phrases--center"');
  });
});
