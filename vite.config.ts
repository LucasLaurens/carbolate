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
        // ton popup React (UI)
        popup: resolve(__dirname, "src/popup.html"),
        // ton background script
        background: resolve(__dirname, "src/background.ts"),
        // ton content script
        content: resolve(__dirname, "src/content.ts")
      },
      output: {
        // génère des fichiers JS simples, pas de hash
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`
      }
    },
    outDir: "dist",       // le dossier de build
    emptyOutDir: true     // vide le dossier avant le build
  }
});
