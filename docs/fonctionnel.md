# Documentation fonctionnelle

## Qu'est-ce que Carbolate ?

Carbolate est une extension Chrome qui estime l'empreinte carbone de votre navigation en temps réel. Elle analyse deux sources : le **trafic réseau** (données téléchargées) et le **temps CPU** (charge de traitement de la page), puis les convertit en grammes équivalent CO₂.

---

## Fonctionnalités

### Collecte automatique (Phase 1)
- À chaque ouverture du popup, les métriques de l'onglet actif sont collectées automatiquement
- Si l'onglet a déjà été tracké dans la journée, ses métriques **et** ses métadonnées (date, status) sont mises à jour
- Le bouton "🔄 Actualiser" permet un refresh manuel supplémentaire

### Dashboard jour courant (Phase 4)
La vue principale affiche 4 indicateurs pour la journée en cours :

| Indicateur | Source | Unité |
|---|---|---|
| CO₂ estimé | `totalCarbon.totalCo2` | grammes |
| Données transférées | `totalMetrics.totalResourceSize` | MB |
| Requêtes HTTP | `totalMetrics.requestCount` | nombre |
| Onglets visités | `record.tabs.length` | nombre |

Un graphique en anneau (doughnut) affiche les **5 domaines les plus consommateurs** en CO₂ pour la journée.

### Export CSV (Phase 3)
- Bouton "📥 Exporter CSV" dans le popup
- Génère un fichier `carbolate-export-YYYY-MM-DD.csv` téléchargé via `chrome.downloads`
- Contient toutes les données historiques : une ligne par onglet tracké
- Colonnes : `date, domain, url, requestCount, totalResourceSize_MB, cpuTimeToLoad_s, networkCo2_g, cpuCo2_g, totalCo2_g, visitTimestamp`

### Reset quotidien automatique (Phase 2)
- Une alarme Chrome se déclenche chaque nuit à minuit
- Supprime les données antérieures à la période de rétention configurée
- Configuré depuis la vue Préférences

### Vue Préférences (Phase 4)
Accessible via l'onglet "⚙️ Préférences" du popup :

| Paramètre | Valeurs | Défaut |
|---|---|---|
| Période de reset | Quotidien (V1) / Hebdomadaire (V2) | Quotidien |
| Export auto avant reset | Oui / Non | Non |

**Quotidien (V1)** : `retentionDays = 1` → seules les données du jour courant sont conservées.
**Hebdomadaire (V2)** : `retentionDays = 7` → les 7 derniers jours sont conservés.

Quand "Export auto avant reset" est activé, un CSV est généré automatiquement avant chaque nettoyage.

---

## Flux utilisateur

### Ouverture du popup
```
Utilisateur clique sur l'icône Carbolate
  → Popup monté (componentDidMount)
  → Préférences chargées depuis le storage
  → handleTabMetrics() déclenché automatiquement
    → Content script interrogé pour l'onglet actif
    → Métriques calculées et sauvegardées
  → DayView affichée avec les données du jour
```

### Export manuel
```
Utilisateur clique "📥 Exporter CSV"
  → getAllDays() → récupère tout l'historique
  → Génération du CSV en mémoire
  → chrome.downloads.download() → téléchargement navigateur
```

### Changement de préférences
```
Utilisateur clique "⚙️ Préférences"
  → Sélectionne "Hebdomadaire"
    → resetPeriod = "weekly", retentionDays = 7
  → Active "Export auto avant reset"
  → Clique "Sauvegarder"
    → chrome.storage.local.set({ preferences })
    → Prochain reset : conserve 7 jours, exporte avant
```

### Reset nocturne (automatique)
```
Minuit
  → chrome.alarms déclenche "daily-reset"
  → Lit preferences.retentionDays
  → Si retentionDays = 1 : supprime tout sauf aujourd'hui
  → Si retentionDays = 7 : supprime ce qui date de plus de 7 jours
  → Si retentionDays = -1 : ne supprime rien
```

---

## Limites connues (V1)

- La collecte ne fonctionne que sur les pages web standards (pas sur `chrome://`, `file://`, etc.)
- Les performances sont mesurées au moment de l'ouverture du popup : une page chargée il y a longtemps peut avoir des métriques incomplètes
- Le calcul CO₂ est une **estimation** basée sur des moyennes sectorielles, pas une mesure exacte
- `chrome.downloads` requiert la permission `"downloads"` dans le manifest
