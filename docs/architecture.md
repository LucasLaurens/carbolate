# Architecture technique

## Structure des fichiers

```
src/
├── main.tsx                        # Point d'entrée React
├── App.tsx                         # Composant racine → <Popup />
├── global.d.ts                     # Déclaration module *.css
│
├── background/
│   └── index.ts                    # Background service worker Chrome
│
├── content/
│   └── index.ts                    # Content script (injecté sur chaque page)
│
├── components/
│   └── popup/
│       ├── Popup.tsx               # Composant principal, gestion de l'état global
│       ├── DayView.tsx             # Vue "Aujourd'hui" + chart domaines (feat/phase-4)
│       └── PreferencesView.tsx     # Vue "Préférences" (feat/phase-4)
│
├── carbon/
│   ├── CarbonCalculator.ts         # Moteur de calcul CO₂
│   ├── constants.ts                # Constantes de calibration
│   └── types.ts                    # CarbonInput, CarbonEstimate
│
├── session/
│   ├── store.ts                    # metricsStore — CRUD DailyRecord
│   ├── aggregator.ts               # sumMetrics, sumCarbonEstimates
│   └── types.ts                    # Metrics, MetricTab, DailyRecord, SessionsStore
│
├── storage/
│   └── ChromeStorage.ts            # Abstraction chrome.storage.local
│
├── performance/
│   ├── StrategyContext.ts          # Contexte Strategy (pattern)
│   ├── ResourceStrategy.ts         # Stratégie analyse ressources réseau
│   ├── EntriesValidator.ts         # Validation des PerformanceEntry[]
│   ├── contracts/                  # Interfaces Resource, Strategy<I,O>
│   └── enums/                      # EntriesEnum, ResourceInitiatorTypeEnum
│
└── utils/
    ├── date.ts                     # getDailyDate, isToday, isThisWeek
    └── csv.ts                      # exportToCSV (feat/phase-3)
```

---

## Flux de données complet

```
┌─────────────────────────────────────────────────────────────┐
│                      Page web (onglet actif)                 │
│  performance.getEntriesByType("resource")   → réseau        │
│  performance.getEntriesByType("navigation") → CPU/timing    │
└──────────────────────┬──────────────────────────────────────┘
                       │ chrome.tabs.sendMessage({ type: "entries" })
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Content Script                            │
│  Écoute les messages "entries"                              │
│  Répond avec { resource: [...], navigation: [...] }         │
└──────────────────────┬──────────────────────────────────────┘
                       │ callback response
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Popup / handleTabMetrics()                │
│                                                             │
│  1. EntriesValidator → valide que des données existent      │
│  2. StrategyContext(ResourceStrategy)                       │
│     → { resourceCount, totalTransferSize }                  │
│  3. Construit Metrics { requestCount, totalResourceSize,    │
│     cpuTimeToLoad }                                         │
│  4. hasExistingTabById ?                                    │
│     ├─ Non → metricsStore.addTab(...)                       │
│     └─ Oui → metricsStore.updateTabMetrics(...)             │
│  5. metricsStore.findDailyRecord() → setState({ record })   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    metricsStore (session/store.ts)           │
│                                                             │
│  addTab / updateTabMetrics                                  │
│    → CarbonCalculator.calculate([CarbonInput])              │
│    → { networkCo2, cpuCo2, totalCo2 }                       │
│    → sumMetrics(tabs) + sumCarbonEstimates(tabs)            │
│    → DailyRecord { date, tabs[], totalMetrics, totalCarbon }│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               ChromeStorage (chrome.storage.local)          │
│                                                             │
│  Clé "sessions"     → SessionsStore (Record<date, DailyRecord>)│
│  Clé "preferences"  → Preferences                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Patterns architecturaux

### Strategy Pattern
`StrategyContext<Input, Output>` permet de brancher différentes stratégies d'analyse de performance. Actuellement : `ResourceStrategy` qui calcule `resourceCount` et `totalTransferSize`.

```typescript
const ctx = new StrategyContext(new ResourceStrategy());
const result = ctx.execute(resourceEntries); // { resourceCount, totalTransferSize }
```

Extensible : on pourra ajouter des stratégies pour PAINT, LONGTASK, etc.

### Store Pattern (métriques)
`metricsStore` est un objet singleton qui expose une API haut niveau pour gérer les `DailyRecord`. Il encapsule toute la logique de lecture/écriture vers `ChromeStorage` et le calcul carbone.

### Séparation Background / Popup
- Le **Background script** tourne en arrière-plan en permanence → gère les alarmes et le reset périodique
- Le **Popup** se monte/démonte à chaque ouverture de l'extension → collecte les données à chaque `componentDidMount`
- Le **Content script** est injecté sur chaque page → répond passivement aux messages du popup

---

## Manifest requis (permissions)

Pour fonctionner, l'extension nécessite les permissions suivantes dans `manifest.json` :

```json
{
  "permissions": [
    "storage",
    "alarms",
    "downloads",
    "tabs",
    "activeTab"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```
