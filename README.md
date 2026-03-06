# Carbolate

Carbolate is a Chrome extension that measures and estimates the carbon footprint of your web browsing by analyzing network requests and CPU time of visited pages.

## Documentation index

| File | Description |
|---|---|
| [architecture.md](./docs/architecture.md) | Project structure, data flow, design patterns |
| [features.md](./docs/features.md) | Features, expected behavior, user flows |
| [carbon-model.md](./docs/carbon-model.md) | CO₂ calculation model, constants, formulas |
| [storage.md](./docs/storage.md) | Persisted data schema, TypeScript types |

## Quick overview

```
Chrome Extension
├── Popup (React)         → User interface (320px)
├── Background script     → Daily reset via chrome.alarms
├── Content script        → Collects Performance Entries on each page
└── Chrome Storage        → Local persistence for sessions and preferences
```

## Tech stack

- **UI**: React 18 (class components), Tailwind CSS v4, chart.js
- **Language**: TypeScript strict
- **Build**: Vite + @vitejs/plugin-react
- **Tests**: Vitest
- **Quality**: ESLint, Prettier, Husky (pre-commit)
