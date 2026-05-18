/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
) as { version: string };

// The `test` block below is consumed by Vitest. The triple-slash reference
// at the top of this file (`vitest/config`) widens the UserConfig type so
// `test` is recognised by tsc — without it `tsc -b` fails the GitHub Pages
// deploy with TS2769.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Inject the package.json version as a build-time constant so the
  // topbar can display the running release tag without a runtime fetch.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 ships with rolldown, whose `manualChunks` is a function
        // (the object-shorthand form is rollup-classic). Returning a
        // chunk name routes the module into a dedicated chunk.
        manualChunks: (id: string) => {
          if (id.includes("node_modules/maplibre-gl") || id.includes("node_modules/pmtiles")) {
            return "vendor-map";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
  },
});
