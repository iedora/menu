import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders trigger children", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog title="Delete?" onConfirm={vi.fn()}>
        <button type="button">Open</button>
      </ConfirmDialog>,
    );
    expect(html).toContain("Open");
  });

  it("forwards aria-label to trigger child", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog title="Delete?" onConfirm={vi.fn()}>
        <button type="button" aria-label="Delete item">
          x
        </button>
      </ConfirmDialog>,
    );
    expect(html).toContain('aria-label="Delete item"');
  });
});
