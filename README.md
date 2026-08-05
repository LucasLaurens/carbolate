# Carbolate

Carbolate is a browser extension that measures and estimates the carbon footprint of your web browsing, from the bytes that crossed the network and the time each page took to load. Its perimeter is usage only: the figure is a floor, not a total.

Supported: **Chrome, Edge, Opera, Brave, Vivaldi** (Chromium MV3 build) and **Firefox** (Gecko MV3 build).

## Documentation index

| File                                      | Description                                                       |
| ----------------------------------------- | ----------------------------------------------------------------- |
| [glossary.md](./docs/glossary.md)         | Shared vocabulary (EN/FR) — the single home for what a term means |
| [architecture.md](./docs/architecture.md) | Project structure, data flow, design patterns                     |
| [features.md](./docs/features.md)         | Features, expected behavior, user flows                           |
| [carbon-model.md](./docs/carbon-model.md) | CO₂ calculation model, constants, formulas                        |
| [storage.md](./docs/storage.md)           | Persisted data schema, TypeScript types                           |
| [decisions/](./docs/decisions/)           | ADRs — one decision per file                                      |

## Quick overview

```
Browser Extension (MV3)
├── Panel (React)         → User interface (320px) — side panel / sidebar
├── Background script     → Daily reset via chrome.alarms
├── Content script        → Collects Performance Entries on each page
└── Local storage         → chrome.storage.local for sessions and preferences
```

## Build & package

```bash
npm run build             # Chromium build → dist/
npm run build:firefox     # Firefox build → dist/
npm run package:all       # Store-ready zips (Chromium, Firefox, sources)
```

`dist/manifest.json` is generated per target by `scripts/build.mjs` — see [architecture.md](./docs/architecture.md#cross-browser-build).

Load unpacked: `chrome://extensions` → _Load unpacked_ → `dist/`, or `about:debugging` → _Load Temporary Add-on_ → `dist/manifest.json`.

## Tech stack

- **UI**: React 18 (class components), Tailwind CSS v4, chart.js
- **Language**: TypeScript strict
- **Build**: Vite + @vitejs/plugin-react
- **Tests**: Vitest
- **Quality**: ESLint, Prettier, Husky (pre-commit)
