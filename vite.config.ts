import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Build options live in scripts/build.mjs: each browser target needs a different
// manifest and the extension scripts must be emitted as standalone iife bundles.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Vite's modulepreload polyfill ships a `fetch()` that walks the document's
    // preload links. Those hrefs are local extension files, so it was never
    // egress — but a `fetch` in the bundle contradicts a privacy policy that
    // promises the code holds no request API, and every browser this extension
    // supports preloads natively. Dropping it costs nothing and lets
    // `bundle-egress` assert zero occurrences rather than allow one.
    modulePreload: { polyfill: false },
  },
});
