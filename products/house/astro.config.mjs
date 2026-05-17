import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// iedora.com — static editorial brand page.
// Output goes to ./dist; deployed by wrangler pages.
export default defineConfig({
  output: "static",
  outDir: "./dist",
  integrations: [react()],
  server: { port: 3002 },
  vite: {
    ssr: {
      // The design system ships source-only TS/TSX; let Vite transform it.
      noExternal: ["@iedora/design-system"],
    },
  },
});
