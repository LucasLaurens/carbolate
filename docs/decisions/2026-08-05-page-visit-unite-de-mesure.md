# La visite de page devient l'unité de mesure

**État** : décidée, non implémentée. L'unité reste l'onglet. Deux points ont
toutefois déjà bougé, par
[l'ADR d'approfondissement](2026-08-05-approfondissement-intake-et-store.md) :
`meta.status` est **supprimé** (le cycle de vie qui le remplace n'existe pas
encore, une visite ne porte donc aucun état), et `ResourceInitiatorType` a été
**supprimé** au lieu d'attendre — il n'avait aucun importateur, et la clause
ci-dessous prévoyait sa suppression dans ce cas. La classification premier/tiers
le recréera si elle en a besoin.

Le reste — une entrée par navigation clé `(tabId, url)`, l'enregistrement vivant,
le cycle de vie, le poids tiers — n'a pas été écrit. Le point de bascule est une
seule comparaison, dans `upsertTab()` (`src/session/store.ts`).

**Contexte** : l'unité de mesure était `MetricTab` — une entrée par `chrome.tabs.Tab.id` et par jour. `updateTabMetrics()` (aujourd'hui `recordTabMetrics()`) remplaçait `metrics` et `carbon` mais conservait `url` et `domain` du premier chargement. Naviguer sur cinq pages dans un même onglet produisait donc une seule entrée, portant le domaine de la première page et les métriques de la cinquième. Le graphique « top 5 domaines » attribuait des émissions au mauvais site, et la statistique « onglets visités » comptait des identifiants d'onglets, pas des pages.

Second problème, indépendant du premier : la collecte s'arrêtait au `window.load`. Tout ce qui suit — streaming vidéo, scroll infini, requêtes XHR, navigations SPA sans rechargement — était invisible. Une heure de YouTube comptait pour l'équivalent d'un chargement de page d'accueil.

Troisième problème : `meta.status` était codé en dur à `200`, jamais lu, jamais autre chose. Il prétendait décrire un état sans en décrire aucun.

**Décision** : trois changements liés, parce qu'ils portent tous sur la même chose — ce qu'est une unité de mesure.

1. `MetricTab` devient `PageVisit` : une entrée par navigation, identifiée par `(tabId, url)`. Naviguer sur cinq pages produit cinq visites, chacune avec son domaine et ses métriques. La statistique devient « pages visitées ».

2. Une `PageVisit` est un **enregistrement vivant** : un `PerformanceObserver("resource")` continue d'écouter après le `load` et pousse les deltas au background ; un écouteur `visibilitychange` accumule le temps d'écran. La visite est mise à jour plusieurs fois au lieu d'être figée une fois.

3. `meta.status` est supprimé, remplacé par un cycle de vie réel : `opened → active → hidden → closed`, piloté par `visibilitychange`.

Chaque ressource est en outre classée **premier** ou **tiers** en comparant son domaine enregistrable à celui de la page. Le domaine enregistrable est obtenu par une heuristique maison — deux derniers labels, plus une liste courte d'exceptions (`co.uk`, `com.br`, `co.jp`, `com.au`…) — et non par une Public Suffix List : 80 Ko embarqués dans une extension dont le sujet est le poids du web serait un aveu.

L'attribution du total ne change pas : le site visité porte l'intégralité des octets qu'il charge, tiers inclus. La ventilation premier/tiers est un ajout, pas une réattribution. Un top 5 listant `doubleclick.net` et `cloudfront.net` serait plus juste techniquement mais inactionnable pour l'utilisateur visé, qui ne visite pas ces domaines.

**Conséquences** :

- Le volume de données stockées croît d'un ordre de grandeur : une entrée par navigation au lieu d'une par onglet. La rétention devient un vrai sujet de dimensionnement, pas une préférence cosmétique.
- Les totaux du jour deviennent **monotones croissants pendant la journée**. Le panneau affiche un compteur en cours, jamais un bilan clos — à dire dans l'UI, sinon un utilisateur qui le rouvre croit à un bug.
- `ResourceInitiatorType` (`src/performance/enums/`), aujourd'hui défini et jamais importé, sert enfin à la classification. S'il ne sert toujours pas après ce changement, il doit être supprimé.
- Le poids tiers devient un concept métier exposé, donc un terme du glossaire, donc une clé i18n.
- L'heuristique de domaine enregistrable est fausse sur les suffixes exotiques et compte un CDN maison sur un autre domaine comme tiers. La limite est documentée plutôt que masquée.
- Les navigations SPA restent non comptées à ce stade : elles ne produisent ni `window.load` ni entrée `navigation`. C'est le prochain incrément, pas une régression introduite ici.
