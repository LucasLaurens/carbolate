import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
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
