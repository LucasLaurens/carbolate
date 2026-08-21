# Roadmap V2

## Vue d'ensemble

La V2 étend Carbolate sur deux axes :

- **Configuration** — contrôle du cycle de rétention et de l'export
- **Historique** — visualisation de la progression carbone dans le temps

---

## 1. Paramétrage de la rétention des données — **livré**

**Objectif** : laisser l'utilisateur choisir la fenêtre d'historique conservée.

### Comportement livré

| Choix               | `retentionDays` | Alarme de reset (dérivée)                             |
| ------------------- | --------------- | ----------------------------------------------------- |
| **1 jour** (défaut) | `1`             | toutes les 24h                                        |
| **7 jours**         | `7`             | tous les 7 jours                                      |
| **Tout**            | `-1`            | toutes les 24h, mais `clearPastDays` ne supprime rien |

`30` reste représentable sans nouveau type — c'est ce que la suppression de
`ResetPeriod` a débloqué. Il n'est pas exposé tant que la comparaison mensuelle
(section 3) n'existe pas : une option qui ne sert rien est une option à maintenir.

Le contrôle est une rangée de trois boutons dans `SettingsView`, à côté de la langue,
avec l'interrupteur `autoExportBeforeReset` qui n'avait lui non plus aucune UI.
`RETENTION_OPTIONS` dans `src/config/retention.ts` est le domicile unique de la liste,
et `Translations.settings.retention.options` est indexé par ces valeurs — une option
ne peut pas être ajoutée sans son libellé dans les deux langues.

### Reprogrammation de l'alarme

Le panneau écrit les préférences, le background possède l'alarme, et les deux sont
des contextes JavaScript séparés sans mémoire commune. Un `chrome.storage.onChanged`
côté background rappelle `scheduleReset()` — sans lui le réglage n'aurait pris effet
qu'au prochain démarrage du navigateur.

### Réduire la fenêtre détruit des jours

C'est la seule action du produit qui supprime des données enregistrées. Elle est
immédiate — « garde 1 jour » doit vouloir dire _maintenant_ — et précédée d'une
confirmation native annonçant le nombre exact de journées perdues.
Voir [l'ADR rétention configurable](decisions/2026-08-21-retention-configurable.md).

---

## 2. Export CSV conditionnel et structuré

**Objectif** : l'export reflète fidèlement la fenêtre de données active (1 jour ou 7 jours) et produit un fichier lisible par un humain et un tableur.

### Comportement attendu

- Mode **quotidien** → exporte uniquement aujourd'hui (1 section, 1 date)
- Mode **hebdomadaire** → exporte les 7 derniers jours (1 section par date)
- Le bouton "Export CSV" pourrait n'être actif que si `getAllDays()` retourne au moins un enregistrement non vide — aujourd'hui il est toujours actif et produit un fichier réduit à son en-tête, ce qui est une réponse honnête

### Structure CSV cible

```
# Carbolate export — 2026-05-04 — rétention: 7 jours

date,domain,url,requestCount,totalResourceSize_MB,pageLoadDuration_s,cachedPageWeight_MB,networkCo2_g,deviceCo2_g,totalCo2_g,avoidedCo2_g,visitTimestamp

## 2026-05-04
2026-05-04,github.com,https://github.com/...,42,3.2,1.8,1.1,0.567,0.0025,0.570,0.194,...
...
TOTAL,,,156,12.4,8.2,4.3,2.190,0.011,2.201,0.760,

## 2026-05-03
...
TOTAL,...
```

### Ce qui existe déjà

- `toCSV(records)` (pur) + `exportToCSV(records, clock)` dans `src/utils/csv.ts` — fonctionnels, format plat
- Bouton **Export CSV** dans `DayView` — rendu et limité par `RateLimiter`
- Permission `"downloads"` — présente dans le manifest généré

### Ce qui manque

- Refactor `toCSV` : en-tête de métadonnées, sections par date, lignes `TOTAL` par jour
- Tronquer les URLs longues à 120 caractères dans le CSV pour la lisibilité

### Contrat technique

Pas de paramètre de mode : `clearPastDays` garantit déjà que le storage ne contient
que la fenêtre configurée, donc exporter `getAllDays()` exporte exactement cette
fenêtre. La signature `exportToCSV(records, mode: ResetPeriod)` qu'une version
précédente de cette roadmap proposait est caduque — le type n'existe plus.

```ts
// src/utils/csv.ts — la signature actuelle suffit
export function toCSV(records: readonly DailyRecord[]): string;
export function exportToCSV(records: readonly DailyRecord[], clock: Clock): void;
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

Pour la comparaison mensuelle, il faut conserver **au moins 60 jours** de données —
c'est-à-dire `retentionDays: 60`. Aucun changement de type n'est nécessaire : c'est
précisément ce que la suppression de `ResetPeriod` a débloqué. Un troisième cas
d'enum aurait été requis autrement.

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

- Barre colorée selon le niveau de sobriété du jour (vert/jaune/orange/rouge)
- Barre du jour actuel mise en évidence (bordure ou opacité différente)
- Tooltip au survol : `"Lundi 28 avril — 87g CO₂"`
- Libellé du jour en court (`L M M J V S D` / `M T W T F S S`)

### Architecture

```ts
// src/history/weeklyBarData.ts

type DayBarData = {
  label: string; // "L" / "M" etc.
  date: string; // "2026-04-28"
  co2: number; // totalCo2 du jour, 0 si pas de données
  isToday: boolean;
  color: StatColor; // réutilise getCarbonLevel() — donc sobrietyLevel()
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
