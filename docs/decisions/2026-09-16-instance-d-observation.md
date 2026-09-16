# Instance d'observation : quatrième composant de l'identité d'une visite

**Contexte** : une visite était identifiée par `(tabId, meta.date, url)`, où `meta.date`
est le `performance.timeOrigin` du document. Cette clé suppose qu'un document n'est
observé qu'une fois. Ce n'est pas vrai : Firefox ré-injecte les content scripts dans les
onglets déjà ouverts au chargement d'un module temporaire, et une mise à jour d'extension
produit le même effet. Le second script démarre un `VisitAccumulator` neuf, à zéro, puis
rejoue `buffered: true` — qui ne rend que ce que le tampon de ressources détient encore,
plafonné à 250 entrées. Ses totaux sont donc **plus bas**, et `upsertVisit` les a écrits
par-dessus les vrais.

Observé le 2026-09-16, sur deux exports du même jour à `visitTimestamp` identique :

    calendar.google.com   259 → 250 requêtes
    discord.com           507 → 500 requêtes,  5 → 0 requêtes tierces

Un compteur cumulatif qui descend. Le même incident a exposé un second défaut : le
content script initialisait son horloge de visibilité à `performance.timeOrigin`. Pour un
script ré-injecté dans un onglet visible ouvert depuis trois heures, la première lecture
annonçait trois heures de temps d'écran que personne n'avait passées.

**Décision** :

1. `meta.observedFrom` — le `Date.now()` du démarrage du script — entre dans l'identité,
   qui devient `(tabId, meta.date, url, meta.observedFrom)`. Deux scripts observant un
   même document produisent deux visites, chacune cumulative pour elle-même.
2. L'horloge de visibilité démarre à ce même instant, plus au `timeOrigin` du document.
3. Le garde de message exige `observedFrom` : un content script antérieur, encore vivant
   dans un vieil onglet, est rejeté plutôt que d'entrer sans instance.
4. `meta.date` ne bouge pas. Il reste le début du **document**, et c'est lui qui classe la
   visite sous le jour où elle a commencé.
5. Les jours déjà stockés reçoivent `observedFrom: 0` à la normalisation : ils sont déjà
   distincts entre eux, et zéro n'invente rien.

**Conséquences** :

- Le double comptage remplace la régression silencieuse. Deux lignes pour un document
  ré-injecté additionnent des octets qui ont réellement traversé le réseau une fois
  chacune pour l'instance qui les a vus — le tampon rejoué, lui, recompte ce que la
  première instance avait déjà compté. **La sur-estimation est bornée par 250 entrées par
  ré-injection** ; elle était non bornée dans l'autre sens.
- Une visite vivante au moment d'une mise à jour de l'extension apparaît une seconde fois,
  au lieu de voir son total écrasé.
- Le CSV n'expose pas `observedFrom` : c'est une identité interne, et `visitTimestamp`
  reste le début du document. Deux lignes d'un même document se reconnaissent déjà à leur
  `visitTimestamp` identique.
- Le rejet des messages sans `observedFrom` fait perdre les derniers flushs d'un onglet non
  rechargé au moment d'une mise à jour. C'est la contrepartie assumée du point 3 : un
  message sans instance ne peut pas être classé sans risquer l'écrasement qu'on corrige.

Voir [l'identité de la visite de page](2026-08-21-identite-de-la-visite-de-page.md), que
cette décision prolonge sans la contredire.
