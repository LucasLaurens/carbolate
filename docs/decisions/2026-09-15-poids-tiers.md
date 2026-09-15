# Poids tiers : une part de requêtes, parce que les octets ne sont pas mesurables

**Contexte** : [l'ADR de la visite de page](2026-08-05-page-visit-unite-de-mesure.md) avait posé le
principe — chaque ressource classée premier/tiers par comparaison du domaine enregistrable — et
annonçait la métrique comme « la plus actionnable pour le lecteur : _68 % de l'empreinte de ce site
est tierce_ ». Restait à décider le périmètre, la surface, et ce qui est mesuré.

**Un fait a renversé la question.** Une ressource cross-origin dont le serveur n'envoie pas
`Timing-Allow-Origin` est une entrée **opaque** : `transferSize`, `encodedBodySize` et
`decodedBodySize` valent **0** (W3C Resource Timing). Or ≈ **25 % seulement** des requêtes tierces
portent cet en-tête (Web Almanac 2022, chiffre inchangé depuis) — vérification faite le 2026-09-15 :
présent sur Google Fonts, cdnjs, jsDelivr, le pixel Meta et GPT ; **absent sur
`google-analytics.com` et `googletagmanager.com`**, les deux scripts les plus chargés du web.
Aucune autre API n'est accessible à un content script, sans permission nouvelle, pour connaître le
vrai poids transféré.

Une part **en octets** serait donc faussée exactement là où la métrique prétend accuser : les
traceurs les plus fermés pèseraient zéro, et le biais varie par page sans qu'on puisse l'estimer.

**Décision** :

1. **On compte des requêtes, pas des octets.** `entry.name` reste lisible pour toute ressource,
   opaque ou non : la part de requêtes tierces est mesurable **intégralement**. Elle dit la même
   chose sur le plan de la prise de conscience — combien de tiers ce site charge — sans revendiquer
   une précision que le navigateur refuse. Corollaire à respecter dans les libellés : **cette ligne
   n'est pas une part du CO₂** et ne doit jamais se lire comme telle.

2. **La classification a lieu dans la page.** L'accumulateur compare le domaine enregistrable de
   chaque ressource à celui du document et n'émet qu'un compteur. Faire voyager les domaines de
   ressources jusqu'au background les ferait entrer dans le storage **et** dans l'export CSV : la
   liste des régies qu'un utilisateur croise est un profil, pas une mesure.

3. **Domaine enregistrable par heuristique maison** — deux derniers labels, trois sous une courte
   liste de suffixes connus (`co.uk`, `com.br`, `co.jp`, `com.au`, `co.nz`, `co.za`, `com.mx`). Pas
   de Public Suffix List : ~80 Ko embarqués dans une extension dont le sujet est le poids du web.
   Limites écrites plutôt que découvertes : faux sur un suffixe exotique hors liste ; un CDN maison
   sur un **autre** domaine enregistrable reste compté tiers ; et `name` étant l'URL **initiale**
   d'une chaîne de redirections, une URL première qui redirige vers un tiers est comptée première.

4. **`data:`, `blob:` et toute URL illisible comptent premier.** Ces octets sont ceux du document ;
   inventer un tiers depuis un nom non analysable gonflerait la figure qu'on veut honnête.

5. **Un entier stocké, jamais une liste.** `Metrics` gagne `thirdPartyRequests`, le CSV sa colonne.
   Aucune information sur _qui_ suit l'utilisateur n'entre dans le storage.

6. **Périmètre MVP**, et une ligne sur le modèle de « évités par le cache » — présente seulement si
   la page a rencontré au moins un tiers. Ni quatrième tuile (288 px sur quatre colonnes cassent,
   décidé en [#40](https://github.com/LucasLaurens/carbolate/issues/40)), ni ventilation dans
   `DomainChart`, qui répartit le CO₂ **par domaine de page visitée**, pas par domaine de ressource.

7. **`ResourceInitiatorType` n'est pas recréé.** Il avait été supprimé faute d'usage, et la
   classification se fait par domaine, pas par type d'initiateur.

**Conséquences** :

- **`networkCo2` sous-compte les ressources opaques** — une conséquence de ce même fait, qui
  dépasse ce ticket et n'était écrite nulle part. Elle est désormais dans `docs/carbon-model.md` et
  au glossaire : le chiffre est un plancher pour une deuxième raison, indépendante du périmètre
  usage-seulement.
- Les jours stockés avant ce ticket portent `thirdPartyRequests = 0` — aucune mesure n'existe
  rétroactivement, et la ligne reste simplement absente pour eux.
