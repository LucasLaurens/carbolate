import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        side_panel: "index.html",
        background: "src/background/index.ts",
        content: "src/content/index.ts",
      },
      output: {
        entryFileNames: "[name].js",
        // format: "iife",
      }
    },
    outDir: "dist",
    emptyOutDir: true,
    target: "es2017",
  }
});
