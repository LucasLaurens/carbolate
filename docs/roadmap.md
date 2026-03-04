# Roadmap

## Phases implémentées

### Phase 1 — Collecte automatique ✅
**Branche** : `feat/phase-1-auto-collect`

À chaque ouverture du popup, les métriques de l'onglet actif sont collectées automatiquement (`componentDidMount`). Le refresh met à jour non seulement les métriques réseau/CPU, mais aussi les métadonnées (status, date de la dernière visite).

Fichiers modifiés :
- `src/session/types.ts` — signature `updateTabMetrics` avec `meta?`
- `src/session/store.ts` — `updateTabInRecord` applique le meta
- `src/components/popup/Popup.tsx` — passage du meta au refresh

---

### Phase 2 — Reset et nettoyage quotidien ✅
**Branche** : `feat/phase-2-daily-reset`

Un `chrome.alarm` se déclenche automatiquement à minuit chaque jour. Il lit la préférence `retentionDays` et supprime les données trop anciennes. Configuré à l'installation de l'extension et au démarrage du navigateur.

Fichiers modifiés :
- `src/storage/ChromeStorage.ts` — type `Preferences`, `getPreferences()`, `setPreferences()`
- `src/session/types.ts` — méthode `clearPastDays` dans `MetricsStore`
- `src/session/store.ts` — implémentation de `clearPastDays`
- `src/background/index.ts` — `scheduleDailyReset()`, listeners `onInstalled`/`onStartup`, handler alarme

---

### Phase 3 — Export CSV ✅
**Branche** : `feat/phase-3-csv-export`

Export de tout l'historique en CSV via `chrome.downloads`. Bouton dédié dans le popup.

Fichiers créés / modifiés :
- `src/utils/csv.ts` — `escapeCSV()`, `exportToCSV(records)`
- `src/components/popup/Popup.tsx` — méthode `handleExport()`, bouton "📥 Exporter CSV"

Format CSV : `date, domain, url, requestCount, totalResourceSize_MB, cpuTimeToLoad_s, networkCo2_g, cpuCo2_g, totalCo2_g, visitTimestamp`

---

### Phase 4 — UI Popup ✅
**Branche** : `feat/phase-4-ui-popup`

Refonte complète du popup avec navigation par onglets.

Fichiers créés / modifiés :
- `src/components/popup/DayView.tsx` — dashboard 4 KPIs + chart top domaines
- `src/components/popup/PreferencesView.tsx` — toggles reset period + export auto
- `src/components/popup/Popup.tsx` — refonte totale avec state `view`
- `package.json` — ajout de `chart.js`

---

## Évolutions prévues

### V2 — Période hebdomadaire
La base est déjà en place (toggle "Hebdomadaire" dans les préférences, `retentionDays = 7`). Il reste à :
- Ajouter une vue "Semaine" dans le popup (graphique sur 7 jours)
- Adapter le `scheduleDailyReset` pour planifier un reset hebdomadaire (lundi ou dimanche)
- Ajouter `isThisWeek(dateStr)` déjà disponible dans `src/utils/date.ts`

### V2 — Vue semaine
- Graphique en barres : CO₂ par jour sur les 7 derniers jours
- Comparaison avec la semaine précédente

### V2 — Seuils et alertes
- Badge sur l'icône avec le CO₂ du jour
- Notification si seuil dépassé (configurable)

### V3 — Comparaisons sectorielles
- Équivalences visuelles (km en voiture, heures de streaming, etc.)
- Score journalier vs moyenne mondiale

### V3 — Export automatique planifié
- Export CSV déclenché automatiquement avant chaque reset si `autoExportBeforeReset = true`
- À implémenter dans le handler `chrome.alarms.onAlarm` de `background/index.ts`
