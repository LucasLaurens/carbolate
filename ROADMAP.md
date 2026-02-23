# Carbolate — Roadmap

## État actuel

- Architecture en domaines fonctionnels (`carbon/`, `performance/`, `session/`, `storage/`)
- Collecte de métriques par onglet (requêtes, taille des ressources, durée de navigation) via la `Performance API`
- Calcul carbone (CO₂ réseau + CPU) via `CarbonCalculator` — modèle SWD v4
- Tracking journalier : métriques et carbone stockés par jour (`DailyRecord`) dans `chrome.storage.local`
- Agrégation des totaux du jour dans le store (`getTotalMetrics`, `getTotalCarbon`)
- Affichage dans le popup (taille, nombre de requêtes, temps CPU) — interface basique
- La collecte ne se déclenche qu'au clic sur le popup (pas de collecte automatique)
- Suite de tests : 6 fichiers, 42 tests (unitaires + intégration + pipeline end-to-end)

---

## Phases

### ~~Phase 1 — Fondations carbone~~ ✅

- [x] `CarbonCalculator` + `src/carbon/constants.ts` (CARBON_PER_GB, NETWORK_RATIO, CPU_FACTOR)
- [x] Types `CarbonInput` / `CarbonEstimate` dans `src/carbon/types.ts`
- [x] Calcul carbone intégré au store (`addTab`, `updateTabMetrics`, totaux journaliers)

### ~~Phase 2 — Tracking journalier~~ ✅

- [x] `DailyRecord` + `SessionsStore` dans `src/session/types.ts`
- [x] Utilitaires date (`getTodayKey`, `isToday`, `isThisWeek`) dans `src/utils/date.ts`
- [x] Store réécrit avec indexation par jour (`src/session/store.ts`)
- [x] `url` et `domain` dans `MetricTab`

### ~~Refactoring architecture~~ ✅

- [x] Domaines fonctionnels : `carbon/`, `performance/`, `session/`, `storage/`
- [x] `sumMetrics` extrait dans `src/session/aggregator.ts`
- [x] Couche persistence isolée dans `src/storage/ChromeStorage.ts`
- [x] Enums et contrats déplacés dans `src/performance/`

### ~~Tests~~ ✅

- [x] Tests unitaires : `carbon-calculation`, `metrics-aggregation`, `entries-validation`, `resource-extraction`
- [x] Tests d'intégration store : `session-store.integration` (16 cas)
- [x] Tests pipeline end-to-end : `browsing-session-carbon.integration` (3 scénarios réalistes)

---

### Phase 3 — Collecte automatique

Actuellement la collecte ne se déclenche qu'au clic sur le popup.

- [ ] Listener `tabs.onUpdated` dans `background/index.ts` — collecter au chargement complet d'une page
- [ ] Listener `tabs.onActivated` — rafraîchir les métriques à chaque changement d'onglet
- [ ] Le background appelle directement le store, sans passer par le popup
- [ ] Supprimer le bouton "Refresh" du popup (devenu inutile)

```ts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // envoyer message au content script → stocker dans metricsStore
  }
});
```

---

### Phase 4 — Reset et nettoyage

- [ ] Alarm `dailyReset` dans `background/index.ts` (periodInMinutes: 1440)
- [ ] Ajouter `"alarms"` aux permissions `manifest.json`
- [ ] `pruneOldRecords(keepDays: number = 30)` dans le store — éviter de saturer le quota 10 MB
- [ ] Préférences utilisateur (`resetPolicy: "daily" | "weekly"`, `exportBeforeReset: boolean`) dans `chrome.storage.sync`

---

### Phase 5 — Export CSV

- [ ] Module `src/export/CsvExporter.ts`

```ts
class CsvExporter {
  fromDailyRecord(record: DailyRecord): string { ... }
  fromAllDays(records: DailyRecord[]): string { ... }
  download(filename: string, content: string): void { ... }
}
```

Format attendu :
```
Date,Domaine,Requêtes,Taille (MB),Temps CPU (s),CO₂ réseau (g),CO₂ CPU (g),CO₂ total (g)
2026-02-22,github.com,48,1.23,2.10,0.54,0.025,0.57
2026-02-22,youtube.com,112,18.40,5.30,8.12,0.064,8.18
TOTAL,,160,19.63,7.40,8.66,0.089,8.75
```

- [ ] Bouton "Exporter aujourd'hui" dans le popup
- [ ] Bouton "Exporter la semaine" dans le popup (section historique)

---

### Phase 6 — UI Popup

- [ ] Migrer `Popup.tsx` vers composant fonctionnel + hooks (remplacer `Component`)
- [ ] Vue jour courant : CO₂ estimé, données transférées, requêtes, onglets visités

```
┌─────────────────────────────────┐
│  🌿 Carbolate — Aujourd'hui     │
├─────────────────────────────────┤
│  CO₂ estimé      : 4.32 g       │
│  Données transf. : 38.2 MB      │
│  Requêtes        : 312           │
│  Onglets visités : 7             │
├─────────────────────────────────┤
│  Top domaines                   │
│  1. youtube.com   — 3.10 g      │
│  2. github.com    — 0.54 g      │
│  3. twitter.com   — 0.38 g      │
├─────────────────────────────────┤
│  [↓ Export CSV]                 │
└─────────────────────────────────┘
```

- [ ] Top domaines triés par CO₂ décroissant
- [ ] Vue historique semaine : graphique en barres par jour (SVG natif ou `chart.js`)
- [ ] Vue préférences : politique de reset, export automatique avant reset

---

## Dette technique restante

| Fichier | Action |
|---|---|
| `src/content/index.ts` | Réactiver les entrées `paint` et `longtask` (commentées) |
| `src/storage/ChromeStorage.ts` | Typer correctement le callback de `chrome.storage.local.get` |
| `src/components/popup/Popup.tsx` | Migrer vers composants fonctionnels + hooks (voir Phase 6) |
