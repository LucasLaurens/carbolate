import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Build options live in scripts/build.mjs: each browser target needs a different
// manifest and the extension scripts must be emitted as standalone iife bundles.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
