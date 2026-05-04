# Roadmap V2

## Vue d'ensemble

La V2 étend Carbolate sur deux axes :
- **Configuration** — contrôle du cycle de rétention et de l'export
- **Historique** — visualisation de la progression carbone dans le temps

---

## 1. Paramétrage de la rétention des données

**Objectif** : laisser l'utilisateur choisir si les données sont conservées jour par jour ou semaine par semaine.

### Comportement attendu

| Mode | Rétention | Alarme de reset |
|---|---|---|
| **Quotidien** (défaut actuel) | 1 jour — seul aujourd'hui persiste | Toutes les 24h |
| **Hebdomadaire** | 7 jours glissants | Tous les 7 jours |

### Ce qui existe déjà

- `Preferences.resetPeriod` (`"daily" \| "weekly"`) — type défini, valeur stockée
- Logique d'alarme dans `background/index.ts` — branchée mais non exposée en UI
- `metricsStore.clearPastDays(retentionDays)` — fonctionnel

### Ce qui manque

- UI dans `SettingsView.tsx` : toggle ou select `Daily / Weekly`
- Sauvegarde immédiate via `ChromeStorage.setPreferences()`
- Reconfiguration de l'alarme Chrome au changement (sans attendre le redémarrage du navigateur)
- Traduction i18n : clé `settings.resetPeriod` + labels `daily` / `weekly`

### Contrat technique

```ts
// Aucun changement de type nécessaire — Preferences est déjà prêt
type ResetPeriod = "daily" | "weekly";

// À ajouter dans background/index.ts
function reconfigureAlarm(period: ResetPeriod): void {
  chrome.alarms.clear("reset");
  chrome.alarms.create("reset", {
    periodInMinutes: period === "weekly" ? 7 * 24 * 60 : 24 * 60,
  });
}
```

---

## 2. Export CSV conditionnel et structuré

**Objectif** : l'export reflète fidèlement la fenêtre de données active (1 jour ou 7 jours) et produit un fichier lisible par un humain et un tableur.

### Comportement attendu

- Mode **quotidien** → exporte uniquement aujourd'hui (1 section, 1 date)
- Mode **hebdomadaire** → exporte les 7 derniers jours (1 section par date)
- Le bouton "Export CSV" n'est visible que si `getAllDays()` retourne au moins un enregistrement non vide

### Structure CSV cible

```
# Carbolate export — 2026-05-04 — mode: weekly

date,domain,url,requestCount,totalResourceSize_MB,cpuTimeToLoad_s,networkCo2_g,cpuCo2_g,renderingCo2_g,totalCo2_g,visitTimestamp

## 2026-05-04
2026-05-04,github.com,https://github.com/...,42,3.2,1.8,0.567,0.002,0.001,0.570,...
...
TOTAL,,,156,12.4,8.2,2.190,0.008,0.003,2.201,

## 2026-05-03
...
TOTAL,...
```

### Ce qui existe déjà

- `exportToCSV(records: DailyRecord[])` dans `src/utils/csv.ts` — fonctionnel mais format plat
- Bouton Export dans le popup — présent

### Ce qui manque

- Refactor `exportToCSV` : ajout d'un en-tête de métadonnées, sections par date, lignes `TOTAL` par jour
- Passer le `resetPeriod` actif à `exportToCSV` pour filtrer correctement les records
- Tronquer les URLs longues à 120 caractères dans le CSV pour la lisibilité
- Permission `"downloads"` manquante dans `manifest.json` — **bloquant actuel**

### Contrat technique

```ts
// src/utils/csv.ts
export function exportToCSV(records: DailyRecord[], mode: ResetPeriod): void;

// Filtre selon le mode
const toExport = mode === "daily"
  ? records.filter((r) => isToday(r.date))
  : records; // clearPastDays garantit déjà la fenêtre glissante
```

---

## 3. Comparaison de progression : semaine et mois précédents

**Objectif** : afficher dans le popup si l'empreinte carbone s'améliore ou se dégrade par rapport aux périodes précédentes.

### Comportement attendu

```
Cette semaine   : 542g  ▼ −18% vs. semaine précédente
Ce mois         : 2.1kg ▲ +7%  vs. mois précédent
```

- Flèche verte (▼) si progression positive (moins de CO₂)
- Flèche rouge (▲) si régression (plus de CO₂)
- Affiché dans un nouvel onglet "Historique" ou comme section supplémentaire dans DayView

### Prérequis

- Activer la rétention hebdomadaire (feature 1) pour avoir des données sur 7+ jours
- Stocker les agrégats hebdomadaires/mensuels **ou** calculer à la volée depuis `getAllDays()`

### Architecture proposée

Calcul à la volée (pas de nouveau stockage) :

```ts
// src/history/progressionCalculator.ts

type WeeklyProgress = {
  currentWeekCo2: number;
  previousWeekCo2: number | null;
  deltaPercent: number | null; // null si pas de données semaine précédente
};

type MonthlyProgress = {
  currentMonthCo2: number;
  previousMonthCo2: number | null;
  deltaPercent: number | null;
};

export function computeWeeklyProgress(days: DailyRecord[]): WeeklyProgress;
export function computeMonthlyProgress(days: DailyRecord[]): MonthlyProgress;
```

- `deltaPercent` négatif = amélioration, positif = régression
- Composant `ProgressBadge` dans `DayView/` : affiche flèche + pourcentage + label

### Rétention requise

Pour la comparaison mensuelle, il faut conserver **au moins 60 jours** de données. Un troisième mode `"monthly"` dans `ResetPeriod` serait nécessaire, ou une rétention fixe de 60 jours indépendante du mode.

---

## 4. Graphique en barres : CO₂ par jour sur 7 jours

**Objectif** : visualiser d'un coup d'œil l'évolution quotidienne du footprint carbone sur la dernière semaine.

### Comportement attendu

```
g CO₂
 120 ┤              ██
 100 ┤         ██   ██
  80 ┤    ██   ██   ██   ██
  60 ┤    ██   ██   ██   ██   ██
  40 ┤    ██   ██   ██   ██   ██
  20 ┤ ██ ██   ██   ██   ██   ██   ██
      L   M    M    J    V    S    D
```

- Barre colorée selon le niveau carbone du jour (vert/jaune/orange/rouge)
- Barre du jour actuel mise en évidence (bordure ou opacité différente)
- Tooltip au survol : `"Lundi 28 avril — 87g CO₂"`
- Libellé du jour en court (`L M M J V S D` / `M T W T F S S`)

### Architecture

```ts
// src/history/weeklyBarData.ts

type DayBarData = {
  label: string;       // "L" / "M" etc.
  date: string;        // "2026-04-28"
  co2: number;         // totalCo2 du jour, 0 si pas de données
  isToday: boolean;
  color: StatColor;    // réutilise getCarbonLevel()
};

export function buildWeeklyBarData(days: DailyRecord[], today: string): DayBarData[];
```

- Bibliothèque : **Chart.js** (déjà présent) — type `bar`
- Composant : `WeeklyBarChart.tsx` dans `DayView/` ou dans un nouveau `HistoryView/`
- Données : `getAllDays()` filtré sur les 7 derniers jours, jours manquants complétés à `co2: 0`

### Placement dans l'UI

Option A — sous le graphique doughnut existant dans DayView (si popup assez haute)  
Option B — nouvel onglet `"Historique"` dans la nav (`nav.history`)  

**Recommandation** : Option B — DayView reste focalisé sur aujourd'hui, l'historique a sa propre vue.

---

## Dépendances entre features

```
Feature 1 (rétention)
  └─→ Feature 2 (export conditionnel)
  └─→ Feature 3 (comparaison progression)  ← nécessite données multi-jours
  └─→ Feature 4 (bar chart 7j)             ← nécessite données multi-jours
```

Features 3 et 4 sont techniquement indépendantes l'une de l'autre mais supposent toutes deux que la rétention hebdomadaire (feature 1) est activée ou que suffisamment de données historiques existent.

---

## Ordre d'implémentation recommandé

1. **Feature 1** — débloquer la rétention hebdomadaire (UI + alarme dynamique) + fix permission `"downloads"` (prérequis feature 2)
2. **Feature 2** — export CSV structuré par date avec totaux par jour
3. **Feature 4** — bar chart 7 jours (feedback visuel immédiat, peu de logique métier)
4. **Feature 3** — comparaison semaine/mois (plus de logique, nécessite données historiques)
