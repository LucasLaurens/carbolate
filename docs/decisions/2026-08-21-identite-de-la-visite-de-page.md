# Identité d'une visite de page : `(tabId, timeOrigin, url)`

**Contexte** : [l'ADR de la visite de page](2026-08-05-page-visit-unite-de-mesure.md) a fixé l'unité de mesure — une entrée par navigation, clé `(tabId, url)` — sans dire ce que cette clé implique. Trois cas restaient ouverts, et chacun tombait sur la même insuffisance : le rechargement de la même URL, le retour arrière, et les navigations SPA.

`upsertTab()` compare aujourd'hui `tab.id !== incoming.id` — donc `tabId` seul. Naviguer remplace l'entrée en gardant l'`url` et le `domain` du premier chargement.

Trois faits ont contraint les réponses :

- Le buffer `resource` est **par document, cumulatif, plafonné à 250 entrées** par défaut, et il jette au-delà (`onresourcetimingbufferfull`). Une page ouverte longtemps perd des entrées en silence. Compter ce qui suit le `load` impose un `PerformanceObserver` avec filigrane, pas un `getEntriesByType()` rejoué.
- Un retour arrière servi par le bfcache **ne déclenche pas `load`** : aucune mesure n'est émise. Ce qui est presque juste — environ zéro octet a traversé le réseau.
- Le content script **survit** aux navigations SPA : même document, même script. Il peut donc observer l'History API sans aucune permission nouvelle.

**Décision** :

1. **La clé est `(tabId, timeOrigin, url)`**, et chaque composant a une raison distincte d'être là. Le `timeOrigin` sépare les rechargements — deux F5 sont deux documents. L'`url` sépare les visites SPA à venir, qui partageront un document donc un `timeOrigin`. Le `tabId` sépare la même page ouverte dans deux onglets.

2. **L'URL est prise brute**, telle que `sender.url` la livre : query et hash inclus, aucune normalisation. `?utm_source=…` sur la même page a réellement retransféré les octets — deux entrées est la réponse honnête pour le CO₂, qui est le chiffre en tête d'affiche, pas le compte de pages. Retirer des paramètres serait un jeu de devinettes par site, et fusionnerait des chargements qui ont vraiment coûté deux fois.

3. **Un rechargement ajoute une visite**, il ne remplace ni ne cumule. Remplacer sous-compterait des octets réellement transférés ; cumuler additionnerait des `pageLoadDurationSec`, ce qui ne veut rien dire.

4. **L'horodatage d'identité est le `performance.timeOrigin` du document**, posé dans la page, et non l'heure d'arrivée du message. Une identité doit être une propriété de la chose identifiée : l'heure d'arrivée est une propriété du message, et l'enregistrement vivant produira plusieurs messages par visite. Avec le tampon du document, tous les deltas d'une visite portent la même identité et le routage est exact — sans l'heuristique « la visite la plus récente de ce `tabId` », qui se tromperait sur une course ou un redémarrage du background.

5. **Un retour arrière bfcache n'émet rien.** Zéro octet transféré, et c'est de toute façon le même document donc le même `timeOrigin` : le temps d'écran s'accumulera sur la visite existante quand l'enregistrement vivant arrivera, sans cas particulier.

6. **Les navigations SPA restent non comptées**, et le mécanisme futur est tranché : observation de l'History API **côté content script**. `chrome.webNavigation` est **exclu définitivement**. Cette permission règlerait le problème en trois lignes et donnerait la visibilité sur toute navigation, sur tous les sites, en permanence — y compris ceux où Carbolate n'a rien à faire. Elle s'affiche à l'installation sur les deux stores et contredit le positionnement de la politique de confidentialité. Le content script, lui, ne voit que les pages où il tourne déjà.

7. **La statistique affichée compte des chargements, pas des pages.** Le libellé passe d'« Onglets visités » à « Chargements de page ». Trois F5 font trois entrées : afficher « 3 pages visitées » serait faux. Le terme _visite de page_ reste l'unité stockée ; la statistique est un décompte de chargements. Deux choses différentes, deux mots différents.

**Conséquences** :

- `meta.date` change de sens : début du document plutôt qu'heure d'enregistrement. Son unique lecteur est la dernière colonne du CSV. Pour les enregistrements déjà stockés les deux valeurs sont à une seconde près — aucune migration.
- `upsertTab()` n'est plus « une seule comparaison » : la clé a trois composants, et le cas par défaut devient l'ajout, pas le remplacement. Le remplacement ne subsiste que pour les deltas d'une visite déjà connue.
- Le volume stocké croît des rechargements en plus des navigations. La rétention par défaut à un jour le borne.
- Limite préexistante, désormais écrite : une page qui charge plus de 250 ressources en perd au-delà, donc son poids est sous-compté. Le plafond du buffer n'a jamais été relevé. À reprendre avec l'enregistrement vivant, qui doit de toute façon changer de mécanisme de collecte.
- Le glossaire gagne un terme pour la statistique affichée, distinct de l'unité stockée.

**Amendement du 2026-09-15 — la forme est écrite** ([#47](https://github.com/LucasLaurens/carbolate/issues/47)) :

- `MetricTab` devient `PageVisit`, son champ `id` devient `tabId`, et `DailyRecord.tabs` devient
  `DailyRecord.visits`. `session/legacy.ts` lit les deux anciens noms et écrit les nouveaux : aucune
  migration, aucun jour perdu — vérifié à l'écran sur un storage mélangeant les deux formes.
- `TabMetricsRecorder` devient `PageVisitRecorder`, `recordTabMetrics` devient `recordPageVisit`.
- Le `timeOrigin` voyage dans le message (`PageMetricsMessage.timeOrigin`), lu dans la page par
  `PerformanceSource.readTimeOrigin()`. Le garde du message le **refuse absent ou non fini** : un
  content script d'avant la mise à jour n'a pas d'identité à offrir, et une visite sans identité ne
  peut pas recevoir ses deltas.
- `MetricsIntake` perd sa dépendance au `Clock` : il ne pose plus d'horodatage, il le reçoit.
- L'en-tête CSV ne bouge pas. `visitTimestamp` reste juste — il nommait déjà l'identité de la
  visite ; seul son contenu passe de l'heure d'enregistrement au début du document, à une seconde
  près sur tout ce qui était déjà stocké.
