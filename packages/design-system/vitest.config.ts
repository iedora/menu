import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    // Pure RSC primitives — no DOM, no async — keep it tight.
    testTimeout: 5_000,
  },
});
