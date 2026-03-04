# Architecture technique

## Structure des fichiers

```
src/
├── main.tsx                        # Point d'entrée React
├── App.tsx                         # Composant racine → <Popup />
├── global.d.ts                     # Déclaration module *.css
│
├── config/
│   └── preferences.ts              # Source unique de vérité : Preferences, ResetPeriod, DEFAULT_PREFERENCES
│
├── background/
│   └── index.ts                    # Background service worker Chrome — alarme reset
│
├── content/
│   └── index.ts                    # Content script (injecté sur chaque page)
│
├── components/
│   └── popup/
│       ├── Popup.tsx               # Composant principal, gestion de l'état global
│       ├── DayView.tsx             # Vue "Aujourd'hui" + chart domaines
│       └── PreferencesView.tsx     # Vue "Préférences"
│
├── carbon/
│   ├── CarbonCalculator.ts         # Moteur de calcul CO₂ (accepte ICarbonSource[])
│   ├── ICarbonSource.ts            # Interface OCP pour sources d'émission
│   ├── constants.ts                # Constantes de calibration
│   ├── types.ts                    # CarbonInput, CarbonEstimate, Carbon<I,O>
│   └── sources/
│       ├── NetworkCarbonSource.ts  # Émissions réseau (implémente ICarbonSource)
│       └── CpuCarbonSource.ts      # Émissions CPU (implémente ICarbonSource)
│
├── session/
│   ├── store.ts                    # metricsStore — CRUD DailyRecord + cache in-memory
│   ├── TabCollector.ts             # Collecte Chrome isolée du Popup (SRP)
│   ├── aggregator.ts               # sumMetrics, sumCarbonEstimates
│   └── types.ts                    # Metrics, MetricTab, DailyRecord, SessionsStore, MetricsStore
│
├── storage/
│   └── ChromeStorage.ts            # Abstraction chrome.storage.local (implémente IStorage)
│
├── performance/
│   ├── StrategyContext.ts          # Contexte Strategy (pattern)
│   ├── ResourceStrategy.ts         # Stratégie analyse ressources réseau
│   ├── EntriesValidator.ts         # Validation que les entrées "resource" existent
│   ├── contracts/                  # Interfaces Resource, Strategy<I,O>
│   └── enums/                      # EntriesEnum, ResourceInitiatorTypeEnum
│
└── utils/
    ├── date.ts                     # getDailyDate (timezone-safe), isToday, isThisWeek (lundi=début)
    ├── url.ts                      # parseDomain — wrapper sécurisé autour de new URL()
    └── csv.ts                      # exportToCSV
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
│  Retourne null pour les types inconnus                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ callback response
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    TabCollector.collect(tabId)               │
│                                                             │
│  1. EntriesValidator → valide que "resource" n'est pas vide │
│  2. StrategyContext(ResourceStrategy)                       │
│     → { resourceCount, totalTransferSize }                  │
│  3. Construit Metrics { requestCount, totalResourceSize,    │
│     cpuTimeToLoad }                                         │
│  Retourne Metrics | null                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Popup / handleTabMetrics()                │
│                                                             │
│  isLoading = true (désactive le bouton Actualiser)         │
│  parseDomain(url) → hostname sécurisé                      │
│  hasExistingTabById ?                                       │
│    ├─ Non → metricsStore.addTab(...)                        │
│    └─ Oui → metricsStore.updateTabMetrics(...)              │
│  metricsStore.findDailyRecord() → setState({ record })      │
│  isLoading = false                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    metricsStore (session/store.ts)           │
│                                                             │
│  Cache in-memory (DailyRecord + date) :                    │
│    → Lecture : retourne le cache si date = aujourd'hui     │
│    → Écriture : invalide le cache                          │
│                                                             │
│  addTab / updateTabMetrics                                  │
│    → CarbonCalculator.calculate([CarbonInput])              │
│      → [NetworkCarbonSource, CpuCarbonSource]               │
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
│  Clé "preferences"  → Preferences (source : config/preferences.ts)│
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

### Open/Closed — ICarbonSource
`CarbonCalculator` accepte un tableau de sources d'émission. Ajouter une nouvelle source (ex: GPU, streaming) ne nécessite pas de modifier `CarbonCalculator` :

```typescript
// Ajout d'une source sans toucher au calculateur
class GpuCarbonSource implements ICarbonSource {
  calculate(inputs: CarbonInput[]): number { ... }
}
const calc = new CarbonCalculator([
  new NetworkCarbonSource(),
  new CpuCarbonSource(),
  new GpuCarbonSource(), // ← ajout ici seulement
]);
```

### Store Pattern + cache in-memory
`metricsStore` expose une API haut niveau pour gérer les `DailyRecord`. Les lectures répétées dans une même session (popup ouvert) utilisent un cache in-memory invalidé à chaque écriture — évite les I/O redondants vers `chrome.storage.local`.

### SRP — TabCollector vs Popup
La logique de collecte Chrome (sendMessage, validation, strategy) est isolée dans `TabCollector`. `Popup.tsx` ne fait qu'appeler `collect()` et réagit au résultat.

### Séparation Background / Popup / Content
- Le **Background script** tourne en arrière-plan en permanence → gère les alarmes et le reset périodique
- Le **Popup** se monte/démonte à chaque ouverture → collecte les données via `TabCollector`
- Le **Content script** est injecté sur chaque page → répond passivement aux messages

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
