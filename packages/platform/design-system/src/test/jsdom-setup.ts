/**
 * jsdom test setup — shims the browser APIs Radix primitives rely on but
 * jsdom doesn't implement. Loaded automatically by vitest for any test file
 * that opts into the jsdom environment via the `// @vitest-environment jsdom`
 * directive at the top of the file.
 *
 * Static primitives (Wordmark, MetaStrip, Statement, Lintel, etc.) stay in
 * the default node env and test via react-dom/server's renderToStaticMarkup
 * — fast, no DOM. Only interactive Radix-backed primitives need this file.
 *
 * Reference: Luis Ball, "Using React Testing Library with RadixUI Components"
 * (2026) — the canonical list of jsdom holes that break Radix tests.
 */

import "@testing-library/jest-dom/vitest";

// 1. PointerEvent — Radix binds pointer interactions; jsdom doesn't ship it.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEvent extends MouseEvent {
    public pointerType: string;
    public pointerId: number;
    public width: number;
    public height: number;
    public pressure: number;
    public tangentialPressure: number;
    public tiltX: number;
    public tiltY: number;
    public twist: number;
    public isPrimary: boolean;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "mouse";
      this.pointerId = init.pointerId ?? 0;
      this.width = init.width ?? 1;
      this.height = init.height ?? 1;
      this.pressure = init.pressure ?? 0;
      this.tangentialPressure = init.tangentialPressure ?? 0;
      this.tiltX = init.tiltX ?? 0;
      this.tiltY = init.tiltY ?? 0;
      this.twist = init.twist ?? 0;
      this.isPrimary = init.isPrimary ?? false;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).PointerEvent = PointerEvent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = PointerEvent;
}

// 2. ResizeObserver — Radix's useSize hook needs it; jsdom omits it.
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ResizeObserver = ResizeObserver;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = ResizeObserver;
}

// 3. Pointer-capture methods — Radix's focus-trap calls them on the element.
if (
  typeof window !== "undefined" &&
  !HTMLElement.prototype.hasPointerCapture
) {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
}

// 4. scrollIntoView — Radix Select scrolls the highlighted item into view.
if (
  typeof window !== "undefined" &&
  !HTMLElement.prototype.scrollIntoView
) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
