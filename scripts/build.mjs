import { writeFileSync } from "node:fs";
import { build } from "vite";

import { manifestFor, TARGETS } from "./manifest.mjs";

const OUT_DIR = "dist";
const BUILD_TARGET = "es2017";

const SCRIPT_ENTRIES = [
  { name: "background", entry: "src/background/index.ts" },
  { name: "content", entry: "src/content/index.ts" },
];

const target = process.argv[2] ?? "chrome";
if (!TARGETS.includes(target)) {
  console.error(`Unknown browser target "${target}". Expected: ${TARGETS.join(", ")}`);
  process.exit(1);
}

// Panel UI — plugins and aliases come from vite.config.ts.
await build({
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    target: BUILD_TARGET,
    rollupOptions: {
      input: { side_panel: "index.html" },
      output: { entryFileNames: "[name].js" },
    },
  },
});

// Background and content scripts are built one at a time in library/iife mode so
// each file is self-contained: Firefox MV3 event pages and content scripts in
// every browser are classic scripts, an ESM `import` would kill them at startup.
for (const { name, entry } of SCRIPT_ENTRIES) {
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: OUT_DIR,
      emptyOutDir: false,
      target: BUILD_TARGET,
      lib: {
        entry,
        name: `carbolate_${name}`,
        formats: ["iife"],
        fileName: () => `${name}.js`,
      },
    },
  });
}

writeFileSync(`${OUT_DIR}/manifest.json`, `${JSON.stringify(manifestFor(target), null, 2)}\n`);

console.log(`\nBuilt ${OUT_DIR}/ for target "${target}".`);
