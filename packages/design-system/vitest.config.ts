import { defineConfig } from "vitest/config";

/**
 * Two test surfaces, one config:
 *
 *   *.test.tsx          → node env, renderToStaticMarkup checks for static
 *                         primitives (Wordmark, MetaStrip, Lintel, …).
 *                         Fast: no DOM, no setup file.
 *
 *   *.dom.test.tsx      → jsdom env, React Testing Library + userEvent for
 *                         interactive Radix-backed primitives (Dialog,
 *                         DropdownMenu, …). Setup file shims the browser
 *                         APIs Radix expects but jsdom omits.
 *
 * The split keeps the static suite cheap (no jsdom boot per file) while
 * letting interactive tests exercise real keyboard + pointer behavior.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    testTimeout: 5_000,
    environmentMatchGlobs: [
      ["src/**/*.dom.test.tsx", "jsdom"],
      ["src/**/*.test.{ts,tsx}", "node"],
    ],
    setupFiles: ["./src/test/jsdom-setup.ts"],
  },
});
