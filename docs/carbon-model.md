# Modèle de calcul CO₂

## Principe général

Carbolate estime l'empreinte carbone d'une visite web à partir de deux composantes :
1. **Émissions réseau** : liées aux données transférées (bytes téléchargés)
2. **Émissions CPU** : liées au temps de traitement de la page

Le résultat est exprimé en **grammes équivalent CO₂ (gCO₂e)**, arrondi à l'entier le plus proche.

---

## Constantes de calibration

Définies dans `src/carbon/constants.ts` :

| Constante | Valeur | Description |
|---|---|---|
| `CARBON_PER_GB` | `442` gCO₂e/Go | Intensité carbone du réseau par gigaoctet transféré |
| `NETWORK_RATIO` | `0.75` | Part du réseau vs appareil utilisateur (75% réseau, 25% device) |
| `CPU_FACTOR` | `0.012` gCO₂e/s | Intensité carbone par seconde de CPU actif |

> Ces valeurs sont issues de moyennes sectorielles (études IEA, Shift Project). Elles représentent une estimation raisonnable pour un mix énergétique mondial moyen.

---

## Formules

Implémentées dans `src/carbon/CarbonCalculator.ts` :

```
totalGB    = Σ(transferSize) / 1_000_000_000   [bytes → Go]
totalSec   = Σ(cpuTime) / 1000                 [ms → secondes]

networkCo2 = totalGB  × CARBON_PER_GB × NETWORK_RATIO
cpuCo2     = totalSec × CPU_FACTOR

totalCo2   = round(networkCo2) + round(cpuCo2)
```

### Exemple concret

Pour un onglet qui charge **2 MB** de ressources avec **1,5s** de CPU :

```
totalGB    = 2_000_000 / 1_000_000_000 = 0.002 Go
totalSec   = 1500 / 1000 = 1.5 s

networkCo2 = 0.002 × 442 × 0.75 = 0.663 → 1g
cpuCo2     = 1.5   × 0.012       = 0.018 → 0g

totalCo2   = 1g
```

---

## Sources des données d'entrée

Les données proviennent de l'API `Performance` native du navigateur, collectées par le content script :

| Champ CarbonInput | Source Performance API | Unité |
|---|---|---|
| `transferSize` | `PerformanceResourceTiming.transferSize` | bytes |
| `cpuTime` | `PerformanceNavigationTiming.duration` | ms |

`transferSize` représente la taille **compressée** réellement transférée sur le réseau (0 si cache). `duration` est le temps total de la navigation (DOMContentLoaded + sous-ressources).

---

## Conversion dans le store

Avant de passer au calculateur, les métriques sont converties depuis leur format de stockage interne (dans `src/session/store.ts`) :

```typescript
const carbonMetricsCallback = (m: Metrics): CarbonInput => ({
  transferSize: m.totalResourceSize * 1024 * 1024, // MiB → bytes
  cpuTime:      m.cpuTimeToLoad * 1000,            // s → ms
});
```

> Note : `totalResourceSize` est stocké en MB (mébibytes, 1024²) dans `Metrics` mais la formule utilise des Go décimaux (1000³). Cette légère imprécision (~7%) est négligeable pour une estimation d'ordre de grandeur.

---

## Agrégation par onglet et par jour

```typescript
// src/session/aggregator.ts
sumMetrics(tabs)         → { requestCount, totalResourceSize, cpuTimeToLoad }
sumCarbonEstimates(tabs) → { networkCo2, cpuCo2, totalCo2 }
```

Chaque `MetricTab` possède son propre `carbon`. Le `DailyRecord.totalCarbon` est la **somme** des carbones de tous les onglets du jour. Cela signifie que visiter le même domaine plusieurs fois **cumule** les émissions.
