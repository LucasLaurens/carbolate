# Schéma de données et persistance

## Stockage

Toutes les données sont persistées dans **`chrome.storage.local`** via `src/storage/ChromeStorage.ts`.

Deux clés sont utilisées :

| Clé | Type | Description |
|---|---|---|
| `"sessions"` | `SessionsStore` | Historique des sessions par jour |
| `"preferences"` | `Preferences` | Configuration utilisateur |

---

## Types TypeScript

### `Metrics` — métriques brutes d'un onglet

```typescript
type Metrics = {
  requestCount:      number; // Nombre de requêtes HTTP/HTTPS
  totalResourceSize: number; // Taille totale transférée (MB)
  cpuTimeToLoad:     number; // Durée navigation (secondes)
};
```

### `MetricTab` — un onglet tracké

```typescript
type MetricTab = {
  id:      number;  // chrome.tabs.Tab.id
  url:     string;  // URL complète
  domain:  string;  // hostname (ex: "github.com")
  metrics: Metrics;
  meta: {
    status: number; // Status HTTP (ex: 200)
    date:   number; // Timestamp Unix (ms) de la dernière collecte
  };
  carbon: CarbonEstimate;
};
```

### `CarbonEstimate` — résultat du calcul CO₂

```typescript
type CarbonEstimate = {
  networkCo2: number; // gCO₂e émis par le réseau
  cpuCo2:     number; // gCO₂e émis par le CPU
  totalCo2:   number; // networkCo2 + cpuCo2
};
```

### `DailyRecord` — toutes les données d'un jour

```typescript
type DailyRecord = {
  date:         string;        // "YYYY-MM-DD" (ISO)
  tabs:         MetricTab[];   // Onglets trackés dans la journée
  totalMetrics: Metrics;       // Somme des metrics de tous les tabs
  totalCarbon:  CarbonEstimate;// Somme des carbons de tous les tabs
};
```

### `SessionsStore` — dictionnaire de jours

```typescript
type SessionsStore = Record<string, DailyRecord>;
// Exemple : { "2026-03-04": DailyRecord, "2026-03-03": DailyRecord }
```

### `Preferences` — configuration utilisateur

```typescript
type Preferences = {
  retentionDays:        number;  // 1 = today only | 7 = 1 semaine | -1 = tout
  autoExportBeforeReset: boolean; // Exporter CSV avant nettoyage
  resetPeriod:          "daily" | "weekly"; // Affiché dans l'UI
};

const DEFAULT_PREFERENCES: Preferences = {
  retentionDays: 1,
  autoExportBeforeReset: false,
  resetPeriod: "daily",
};
```

---

## Exemple de payload complet

```json
{
  "sessions": {
    "2026-03-04": {
      "date": "2026-03-04",
      "tabs": [
        {
          "id": 42,
          "url": "https://github.com/anthropics/claude-code",
          "domain": "github.com",
          "metrics": {
            "requestCount": 87,
            "totalResourceSize": 3.42,
            "cpuTimeToLoad": 1.8
          },
          "meta": {
            "status": 200,
            "date": 1741046400000
          },
          "carbon": {
            "networkCo2": 1,
            "cpuCo2": 0,
            "totalCo2": 1
          }
        }
      ],
      "totalMetrics": {
        "requestCount": 87,
        "totalResourceSize": 3.42,
        "cpuTimeToLoad": 1.8
      },
      "totalCarbon": {
        "networkCo2": 1,
        "cpuCo2": 0,
        "totalCo2": 1
      }
    }
  },
  "preferences": {
    "retentionDays": 1,
    "autoExportBeforeReset": false,
    "resetPeriod": "daily"
  }
}
```

---

## API ChromeStorage

```typescript
// Lecture des sessions
ChromeStorage.getSessions(): Promise<SessionsStore>

// Écriture complète (full replace)
ChromeStorage.setSessions(sessions: SessionsStore): Promise<void>

// Lecture des préférences (avec merge des defaults)
ChromeStorage.getPreferences(): Promise<Preferences>

// Écriture des préférences
ChromeStorage.setPreferences(preferences: Preferences): Promise<void>
```

> **Important** : `setSessions` effectue un **remplacement complet** — toujours lire avant d'écrire pour ne pas perdre les autres jours.

---

## API metricsStore

```typescript
// Lecture
metricsStore.findDailyRecord()         → DailyRecord | null   (jour courant)
metricsStore.findOrCreateDailyRecord() → DailyRecord          (crée si absent)
metricsStore.getAllDays()              → DailyRecord[]         (tous les jours, triés)
metricsStore.getTabs()                 → MetricTab[]           (onglets du jour)
metricsStore.getTotalMetrics()         → Metrics               (totaux du jour)
metricsStore.getTotalCarbon()          → CarbonEstimate        (CO₂ du jour)
metricsStore.hasExistingTabById(id)    → boolean

// Écriture
metricsStore.addTab(tab)                               → void  (nouveau tab)
metricsStore.updateTabMetrics(id, metrics, meta?)      → void  (màj tab existant)
metricsStore.clearPastDays(retentionDays)              → void  (nettoyage)
```
