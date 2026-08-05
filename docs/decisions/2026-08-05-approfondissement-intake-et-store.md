# Approfondissement : une ingestion, une écriture, des ports construits

**Contexte** : la suite de tests passait à 101 vert, et pourtant rien n'importait
`src/background/index.ts` ni `src/content/index.ts`. Le seul endroit où la logique
se composait vraiment — `handlePageMetrics()` — n'était atteignable qu'à travers
`chrome.runtime.onMessage`. Le test dit « pipeline » ne le testait donc pas : il le
**réimplémentait**, et son propre commentaire l'avouait (« Replicates the exact
transform from background/index.ts »). `test/helpers.ts` recopiait de même l'étape
carbone. Les pièces étaient vertes, le câblage non vérifié : une unité inversée,
une branche fausse ou un `await` oublié dans `handlePageMetrics` passait les 101
tests.

Trois autres symptômes du même défaut, tous sur le chemin le plus modifié du dépôt :

- `metricsStore` publiait dix méthodes dont **quatre sans aucun appelant en
  production** (`findOrCreateDailyRecord`, `getTabs`, `getTotalMetrics`,
  `getTotalCarbon`), plus un `globalThis.__carbolateCacheReset` livré dans le code
  de production. L'interface avait été élargie pour être _inspectée_ par les tests
  au lieu d'être leur surface.
- Le neuf fichiers de `src/performance/` calculaient `resources.length` et une
  somme. `MetricsProcessorContext.execute()` était une ligne de délégation — une
  Strategy à une seule stratégie. `PageMetricsValidator` était construit
  `as never` en production comme dans ses quatre tests : le type déclaré ne
  décrivait pas ce qu'on lui passait, et le cast masquait l'écart.
  `ResourceInitiatorType` n'avait aucun importateur.
- `Clock` existait en interface, injectée dans `RateLimiter` — et contournée
  partout ailleurs par un proxy mutable de module (`setTestClock`). C'est cette
  mutation ambiante qui **obligeait** le store à publier son hook global : un état
  jamais construit ne peut pas être réinitialisé, seulement atteint.

Enfin, et c'est le seul défaut qui produisait un faux chiffre : `hasExistingTabById()`
était appelé **hors** de `enqueue()`, puis l'écriture choisie était enfilée dedans.
Deux messages `page_metrics` pour le même onglet arrivant avant que la première
écriture ne soit persistée concluaient tous deux « pas encore là » et ajoutaient
tous deux. Un onglet stocké deux fois, total du jour gonflé.

**Décision** : cinq changements, tous sur la même cause — les seams étaient au
mauvais endroit.

1. **`MetricsIntake` (`src/intake/`)** devient le chemin unique de la page observée
   vers l'enregistrement stocké et chiffré : valider, convertir, estimer, persister.
   `background/index.ts` ne garde que ce qui est réellement propre à Chrome —
   garde de forme du message, `sender.url`, alarme, badge. L'interface est
   redevenue la surface de test : les transformations dupliquées côté tests sont
   supprimées, `test/helpers.ts` avec.

2. **`recordTabMetrics(tab)`** remplace `hasExistingTabById` + `addTab` +
   `updateTabMetrics`. Lire le jour, décider ajouter-ou-remplacer et écrire se
   passent dans un seul tour de file. La course ne disparaît pas par discipline :
   il n'existe plus de séquence d'appels à se tromper. Trois tests l'encodent, et
   ils ont été vus rouges en réintroduisant volontairement la décision hors file —
   un onglet devenait 2 puis 3 entrées.

3. **`src/performance/` passe de neuf fichiers à deux.** `measurePage(payload)`
   retourne `{ valid: true, requests, transferredBytes, loadDurationMs } | { valid: false }`,
   la forme canonique de `.claude/rules/types.md` déjà utilisée par `parseDomain`.
   Tous les `as never` disparaissent, parce que le type décrit enfin l'appelant.
   `PerformanceEntryType` survit et devient le domicile unique des chaînes
   `getEntriesByType()`, utilisé des deux côtés du message.

4. **`MetricsCollector` (`src/content/`)** met les deux globales — `performance` et
   `chrome.runtime` — derrière `PerformanceSource` et `ObservationSink`.
   `content/index.ts` n'est plus que le câblage.

5. **Une seule convention d'horloge** : on construit avec un `Clock`. Le proxy
   mutable, `setTestClock`, `resetClock` et le hook global du store disparaissent
   ensemble. `src/utils/date.ts` n'avait plus de raison d'être — `getDailyDate()`
   était un pass-through d'une ligne, `isToday` et `isThisWeek` n'avaient aucun
   appelant. `FixedClock` quitte `src/` pour `test/fakes/` : un double de test
   n'a rien à faire dans un bundle livré.

**Sur la Strategy supprimée** : `docs/architecture.md` la présentait comme une
vertu (« additional extractors can be added for PAINT, LONGTASK »). Aucune ADR ne
la ratifiait, et elle est restée à une seule stratégie depuis son écriture. Un
adaptateur unique est un seam hypothétique. Le contrat `MetricsExtractor` sera
réintroduit quand un deuxième extracteur existera — la classification
premier/tiers en fournira probablement un — et il ne coûtera rien à réécrire.

**Sur le périmètre volontairement laissé dehors** : ce changement ne touche pas au
modèle carbone. Les paliers de sobriété restent codés en dur dans
`DayView/utils.ts`, `cpuCo2` et `renderingCo2` restent scindés, `ResetPeriod`
existe toujours. Ce sont des décisions déjà prises ailleurs, qui changent le
comportement observable ou la forme des données stockées ; les mêler à un
refactoring structurel aurait rendu impossible de dire ce qui a cassé quoi.

`meta.status` est la seule exception : supprimé ici parce qu'il ne décrivait aucun
état, n'était lu nulle part, et qu'un `200` codé en dur dans le constructeur d'un
enregistrement est le genre de mensonge qu'un refactoring ne doit pas recopier.
Les données déjà stockées le portent encore ; il est ignoré à la lecture, aucune
migration n'est nécessaire.

**Conséquences** :

- 101 tests → 148, et surtout : le câblage est désormais couvert. Trois nouveaux
  fichiers de test portent sur du code qui n'en avait aucun (`MetricsIntake`,
  `MetricsCollector`, la garde de message), deux sur du code couvert seulement
  transitivement (`ChromeStorage`, `toCSV`).
- `exportToCSV` est scindé : `toCSV(records)` est pur et testé, `exportToCSV`
  garde l'effet de bord et reçoit son `Clock`.
- `getDailyRecord()` ne retourne plus `null`. Un jour non mesuré est
  `emptyDailyRecord(date)`, et les `?? emptyMetrics()` du `DayView` disparaissent.
- `App.tsx` devient la racine de composition du panneau. Le `Popup` reçoit un
  `DailyRecordReader` : il ne peut plus écrire une mesure, même par accident.
- Le nom des modules nouveaux (`MetricsIntake`, `MetricsCollector`) est documenté
  dans `docs/architecture.md` et non dans le glossaire : le glossaire est le
  domicile du sens des **termes métier**, pas de l'inventaire des modules.
- Contrainte qui découle de ceci : toute nouvelle dépendance sur une globale du
  navigateur passe par un port avec une implémentation réelle dans `test/fakes/`.
  Pas de `vi.mock`, pas de singleton mutable de module.
