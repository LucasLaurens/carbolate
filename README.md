# Documentation Carbolate

Carbolate est une extension Chrome qui mesure et estime l'empreinte carbone de votre navigation web en analysant les requêtes réseau et le temps CPU des pages visitées.

## Index de la documentation

| Fichier | Description |
|---|---|
| [architecture.md](./docs/architecture.md) | Structure du projet, flux de données, patterns utilisés |
| [fonctionnel.md](./docs/fonctionnel.md) | Fonctionnalités, comportement attendu, flux utilisateur |
| [carbon-model.md](./docs/carbon-model.md) | Modèle de calcul CO₂, constantes, formules |
| [storage.md](./docs/storage.md) | Schéma des données persistées, types TypeScript |
| [roadmap.md](./docs/roadmap.md) | Phases implémentées et évolutions prévues |

## Vue d'ensemble rapide

```
Extension Chrome
├── Popup (React)         → Interface utilisateur (320px)
├── Background script     → Reset quotidien via chrome.alarms
├── Content script        → Collecte des Performance Entries sur chaque page
└── Chrome Storage        → Persistance locale des sessions et préférences
```

## Stack technique

- **UI** : React 18 (class components), Tailwind CSS v4, chart.js
- **Langage** : TypeScript strict
- **Build** : Vite + @vitejs/plugin-react
- **Tests** : Vitest
- **Qualité** : ESLint, Prettier, Husky (pre-commit)
