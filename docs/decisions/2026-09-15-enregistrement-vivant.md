# Enregistrement vivant : cadence des deltas, temps visible, honnêteté du compteur

**Contexte** : une visite n'était mesurée qu'une fois, au `load`, par un
`getEntriesByType("resource")`. Trois conséquences : les requêtes postérieures au `load`
(XHR, images paresseuses, lecture vidéo) n'étaient jamais comptées ; `screenCo2` n'avait
d'autre entrée que la durée de chargement ([ADR énergie écran](2026-09-15-energie-ecran.md)) ;
et le buffer `resource`, plafonné à 250 entrées par document, jetait en silence ce qui
dépassait — une page lourde se sous-comptait déjà.

Faits qui ont contraint les réponses :

- `storage.local` n'a **aucune limite de débit d'écriture**, mais `set()` sérialise la
  **valeur entière** de la clé : chaque écriture réécrit tout l'historique stocké.
- Le service worker MV3 est tué après **30 s d'inactivité** ; `setTimeout` n'y survit pas,
  et la période minimale d'une alarme est d'une minute. Firefox se comporte de même avec
  son event page.
- `observe({type:"resource", buffered:true})` rejoue ce que le buffer contient encore —
  mais **pas** ce qu'il a déjà jeté.

**Décision** :

1. **Collecte par `PerformanceObserver`**, dès le démarrage du script, avec `buffered: true`.
   Un seul chemin : le premier lot **est** ce que le message de `load` disait, les suivants
   sont des cumuls du même type de message. Chaque entrée est pliée `O(1)` au moment où elle
   existe, ce qui récupère au passage les ressources que le plafond de 250 faisait perdre.

2. **Lot de 5 s accumulé dans la page**, jamais dans le background : l'état d'un service
   worker tué à 30 s d'inactivité est perdu à un instant que personne ne choisit, alors que
   `VisitAccumulator` vit exactement aussi longtemps que la chose qu'il mesure. Flush
   immédiat au `load`, à `visibilitychange → hidden` et à `pagehide`. En dessous de 5 s le
   panneau ne paraît pas plus vivant ; au-dessus, la rafale qui suit un `load` devient une
   écriture par ressource.

3. **Delta cumulatif, jamais incrémental.** `upsertVisit` remplace déjà une visite connue,
   donc aucun code nouveau ; surtout, `chrome.runtime.sendMessage` ne promet ni la livraison
   ni l'unicité. En cumulatif un message rejoué est sans effet et un message perdu est
   rattrapé par le suivant ; en incrémental le premier double un total et le second le creuse
   définitivement.

4. **Le temps compté est le temps visible**, accumulé tant que `visibilityState === "visible"`.
   Compter depuis le `load` ferait payer à un onglet oublié l'écran d'un autre — huit heures
   d'usage produiraient trente heures d'écran. Le focus fenêtre n'est pas utilisé :
   `blur`/`focus` se déclenchent aussi quand l'utilisateur clique dans la barre d'adresse ou
   dans le panneau, et une fenêtre regardée serait comptée éteinte.

5. **`screenCo2` bascule sur le temps visible seul.** La durée de chargement quitte ce canal :
   une page visible pendant son chargement est déjà dans son temps visible, la facturer deux
   fois serait un double comptage. Conséquence assumée et visible : **un onglet ouvert en
   arrière-plan et jamais regardé porte `screenCo2 = 0`** — son réseau et son CPU restent
   comptés, pas sa dalle. C'est le sens du mot _attributionnel_.

6. **Une clé `sessions`, une écriture par lot.** Une visite pèse ~300 octets de JSON et la
   rétention par défaut d'un jour borne le blob ; réécrire quelques dizaines de kilo-octets
   cent fois par minute est sans effet mesurable. Découper par jour (`sessions:YYYY-MM-DD`)
   demanderait une refonte de `legacy.ts`, `getAllDays` et `clearPastDays` pour un gain qui
   n'existe qu'à rétention « Tout » **et** navigation intense. Seuil où cette décision se
   rouvre : un blob dépassant quelques centaines de kilo-octets, ou la limite de 10 Mo de
   `storage.local` approchée.

7. **Un delta est classé au jour de la visite**, dérivé de son `timeOrigin`, pas au jour où
   il arrive. Une page ouverte à 23 h 58 et encore visible à 00 h 05 enverrait sinon son cumul
   dans le jour suivant, où sa clé n'existe pas : deux entrées portant chacune le total
   complet, donc les mêmes octets comptés deux fois. Conséquence : **le total d'hier peut
   encore bouger après minuit**, et un export pris à 00 h 30 n'est pas forcément définitif.

8. **Un delta pour un jour supprimé est ignoré.** `mutateDay` ne crée que le jour courant ; un
   jour absent et passé a été purgé, et le recréer ferait mentir l'avertissement du panneau
   (« ces journées seront supprimées définitivement »), qu'un test garde vrai. Perte réelle :
   ce qu'un onglet d'hier consomme après minuit, à rétention d'un jour seulement.

9. **Le panneau devient vivant** — il écoute `chrome.storage.onChanged` et se met à jour seul.
   Le bouton « Actualiser » est retiré : un panneau vivant qui l'affiche encore enseigne qu'il
   ne l'est pas, et son propre commentaire disait qu'il existait parce que les chiffres
   devenaient périmés à la page suivante. La clé de limitation `"refresh"` disparaît avec lui.

10. **Une ligne permanente dit que c'est un compteur** — « Compteur en cours — remis à zéro à
    minuit » / « Running total — resets at midnight » — sous le grand chiffre. Sans elle, un
    utilisateur qui rouvre le panneau et voit un nombre plus haut conclut à un bug. Un
    horodatage répondrait à « quand ? » quand la question est « pourquoi ça monte ? ».

11. **Le badge est repeint à chaque lot.** `setBadgeText` est un appel local sans I/O ;
    l'amortir demanderait un minuteur dans le service worker, c'est-à-dire l'état fragile que
    la décision 2 écarte.

12. **`Metrics` gagne `visibleDurationSec` et le CSV sa colonne `visibleDuration_s`.** En-tête
    précédent abandonné, pas versionné — même traitement et même raison que les deux fois
    précédentes. Cacher l'entrée d'un canal de CO₂ tout en exportant le canal empêcherait un
    lecteur de refaire le calcul, ce que l'export est censé permettre. La bande de stats du
    panneau, elle, ne gagne pas de tuile : à 288 px utiles une quatrième colonne casse, et le
    temps passé est une **entrée** du chiffre, pas un résultat que l'utilisateur vient chercher.

**Conséquences** :

- `MetricsCollector`, `BrowserPerformanceSource` et `measurePage` disparaissent au profit de
  `VisitAccumulator` (pur, sans DOM), `addResourceTiming`/`withLoadDuration` (plis purs) et du
  câblage dans `content/index.ts`.
- Le message transporte désormais `{ timeOrigin, measurement }` au lieu des tableaux d'entrées :
  renvoyer 250 entrées toutes les 5 secondes serait absurde, et le garde vérifie cinq nombres
  finis plutôt que deux tableaux.
- `screenCo2` change de sens pour l'historique : les jours écrits avant ce ticket portent un
  `screenCo2` calculé sur la durée de chargement. Ils **ne sont pas recalculés** — la donnée
  n'existe pas rétroactivement, et `visibleDurationSec` y vaut 0.
