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
│   └── index.ts                    # Background service worker Chrome — alarme reset + réception métriques
│
├── content/
│   └── index.ts                    # Content script (injecté sur chaque page) — push métriques au background
│
├── components/
│   └── popup/
│       ├── Popup.tsx               # Composant principal, lecture du storage, gestion de l'état global
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
│                  Page web (nouvel onglet chargé)            │
│  performance.getEntriesByType("resource")   → réseau        │
│  performance.getEntriesByType("navigation") → CPU/timing    │
└──────────────────────┬──────────────────────────────────────┘
                       │ sérialisé en plain objects
                       │ chrome.runtime.sendMessage({ type: "page_metrics", ... })
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Content Script (content/index.ts)         │
│  Déclenché sur window.load (ou document.readyState=complete) │
│  Convertit PerformanceEntry → plain objects sérialisables    │
│    resource : [{ transferSize }]                             │
│    navigation : [{ duration }]                               │
│  Envoie chrome.runtime.sendMessage → Background              │
└──────────────────────┬──────────────────────────────────────┘
                       │ message "page_metrics" + sender.tab.{id, url}
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Background (background/index.ts)          │
│                                                             │
│  1. EntriesValidator → valide que "resource" n'est pas vide │
│  2. StrategyContext(ResourceStrategy)                       │
│     → { resourceCount, totalTransferSize }                  │
│  3. Construit Metrics { requestCount, totalResourceSize,    │
│     cpuTimeToLoad }                                         │
│  4. parseDomain(sender.tab.url) → hostname sécurisé         │
│  5. hasExistingTabById ?                                    │
│    ├─ Non → metricsStore.addTab(...)                        │
│    └─ Oui → metricsStore.updateTabMetrics(...)              │
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
└──────────────────────┬──────────────────────────────────────┘
                       │ lecture seule
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Popup (Popup.tsx)                         │
│                                                             │
│  componentDidMount → metricsStore.findDailyRecord()         │
│  Bouton "Actualiser" → metricsStore.findDailyRecord()       │
│  Affiche DayView avec le DailyRecord du jour                │
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

### Séparation Background / Popup / Content
- Le **Background script** tourne en arrière-plan en permanence → collecte les métriques envoyées par les content scripts, gère les alarmes et le reset périodique
- Le **Popup** se monte/démonte à chaque ouverture → lit le storage uniquement (lecture pure)
- Le **Content script** est injecté sur chaque page → collecte les données Performance API au chargement et les pousse au background

---

## Manifest requis (permissions)

Pour fonctionner, l'extension nécessite les permissions suivantes dans `manifest.json` :

```json
{
  "permissions": [
    "storage",
    "alarms",
    "tabs",
    "scripting",
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "sidePanel",
    "contextMenus"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

> **Note** : `"downloads"` est actuellement absent du manifest, ce qui empêche l'export CSV (`chrome.downloads.download` dans `utils/csv.ts`). À ajouter pour activer l'export.

### Pourquoi `"type": "module"` sur le background

Le bundle `background.js` généré par Vite/Rollup utilise des `import` ES module (chunks partagés dans `assets/`). Sans `"type": "module"`, Chrome exécute le service worker en mode script classique et lève une `SyntaxError`. Avec ce flag, le service worker est un ES module et peut importer ses dépendances normalement.

### Pourquoi `content.js` est différent

Chrome **ne supporte pas** les ES modules dans les content scripts. `content.js` est donc bundlé sans aucun `import` externe : toutes ses dépendances sont inlinées au moment du build Vite, produisant un script autonome.
