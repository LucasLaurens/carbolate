# Documentation fonctionnelle

## Qu'est-ce que Carbolate ?

Carbolate est une extension Chrome qui estime l'empreinte carbone de votre navigation en temps réel. Elle analyse deux sources : le **trafic réseau** (données téléchargées) et le **temps CPU** (charge de traitement de la page), puis les convertit en grammes équivalent CO₂.

---

## Fonctionnalités

### Collecte automatique
- À chaque chargement d'une nouvelle page, les métriques sont collectées **automatiquement** par le content script et envoyées au background
- Si l'onglet a déjà été tracké dans la journée, ses métriques **et** ses métadonnées (date, status) sont mises à jour
- Le bouton "🔄 Actualiser" relit le storage pour afficher les données les plus récentes
- Les URLs non collectables (`chrome://`, `about:blank`, `file://`) sont ignorées silencieusement

### Dashboard jour courant
La vue principale affiche 4 indicateurs pour la journée en cours :

| Indicateur | Source | Unité |
|---|---|---|
| CO₂ estimé | `totalCarbon.totalCo2` | grammes |
| Données transférées | `totalMetrics.totalResourceSize` | MB |
| Requêtes HTTP | `totalMetrics.requestCount` | nombre |
| Onglets visités | `record.tabs.length` | nombre |

Un graphique en anneau (doughnut) affiche les **5 domaines les plus consommateurs** en CO₂ pour la journée.

### Export CSV
- Bouton "📥 Exporter CSV" dans le popup
- Génère un fichier `carbolate-export-YYYY-MM-DD.csv` téléchargé via `chrome.downloads`
- Contient toutes les données historiques : une ligne par onglet tracké
- Colonnes : `date, domain, url, requestCount, totalResourceSize_MB, cpuTimeToLoad_s, networkCo2_g, cpuCo2_g, totalCo2_g, visitTimestamp`

### Reset automatique
- Une alarme Chrome se déclenche automatiquement à minuit
- La période de l'alarme dépend du mode configuré : **24h** (quotidien) ou **7 jours** (hebdomadaire)
- Supprime les données antérieures à la période de rétention configurée
- Configuré depuis la vue Préférences

### Vue Préférences
Accessible via l'onglet "⚙️ Préférences" du popup :

| Paramètre | Valeurs | Défaut |
|---|---|---|
| Période de reset | Quotidien / Hebdomadaire | Quotidien |
| Export auto avant reset | Oui / Non | Non |

**Quotidien** : alarme toutes les 24h — `retentionDays = 1` → seules les données du jour courant sont conservées.
**Hebdomadaire** : alarme tous les 7 jours — `retentionDays = 7` → les 7 derniers jours sont conservés.

Quand "Export auto avant reset" est activé, un CSV est généré automatiquement avant chaque nettoyage *(à implémenter dans le handler alarme)*.

---

## Flux utilisateur

### Chargement d'une page (collecte automatique)
```
Utilisateur navigue vers une nouvelle URL
  → Content script déclenché sur window.load
  → performance.getEntriesByType("resource") → liste des ressources réseau
  → performance.getEntriesByType("navigation") → timing de chargement
  → Convertis en plain objects { transferSize }, { duration }
  → chrome.runtime.sendMessage({ type: "page_metrics", ... })
    → Background reçoit le message + sender.tab.{id, url}
    → EntriesValidator → valide que "resource" n'est pas vide
    → ResourceStrategy → { resourceCount, totalTransferSize }
    → Metrics calculées + carbon estimé
    → hasExistingTabById ?
      ├─ Non → metricsStore.addTab(...)
      └─ Oui → metricsStore.updateTabMetrics(...)
    → Données persistées dans ChromeStorage
```

### Ouverture du popup
```
Utilisateur clique sur l'icône Carbolate
  → Popup monté (componentDidMount)
  → Préférences chargées depuis ChromeStorage.getPreferences()
  → handleRefresh() déclenché automatiquement
    → metricsStore.findDailyRecord() → lit ChromeStorage
    → setState({ record })
  → DayView affichée avec les données du jour
```

### Bouton Actualiser
```
Utilisateur clique "🔄 Actualiser"
  → isLoading = true (bouton désactivé)
  → metricsStore.findDailyRecord() → relit ChromeStorage
  → setState({ record })
  → isLoading = false
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
    → ChromeStorage.setPreferences(prefs)
    → L'alarme sera recréée au prochain démarrage avec periodInMinutes = 7*24*60
```

### Reset nocturne (automatique)
```
Minuit (ou fin de semaine si mode hebdomadaire)
  → chrome.alarms déclenche "reset"
  → Lit ChromeStorage.getPreferences()
  → Si retentionDays = 1 : supprime tout sauf aujourd'hui
  → Si retentionDays = 7 : supprime ce qui date de plus de 7 jours
  → Si retentionDays = -1 : ne supprime rien
  → Cutoff calculé en heure locale (pas UTC)
```

---

## Limites connues

- La collecte ne fonctionne que sur les pages web standards — `chrome://`, `file://`, `about:blank` ne déclenchent pas le content script
- Les pages déjà ouvertes avant l'installation de l'extension n'auront pas leur content script injecté — elles devront être rechargées
- Le calcul CO₂ est une **estimation** basée sur des moyennes sectorielles, pas une mesure exacte
- **L'export CSV ne fonctionne pas actuellement** : `utils/csv.ts` utilise `chrome.downloads.download` mais la permission `"downloads"` est absente du manifest — à ajouter
- Le changement de période de reset (quotidien ↔ hebdomadaire) n'est effectif qu'au prochain démarrage du navigateur
