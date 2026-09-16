# Instance d'observation : quatrième composant de l'identité d'une visite

**Contexte** : une visite était identifiée par `(tabId, meta.date, url)`, où `meta.date`
est le `performance.timeOrigin` du document. Cette clé suppose qu'un document n'est
observé qu'une fois. Ce n'est pas vrai : Firefox ré-injecte les content scripts dans les
onglets déjà ouverts au chargement d'un module temporaire, et une mise à jour d'extension
produit le même effet. Le second script démarre un `VisitAccumulator` neuf, à zéro, puis
rejoue `buffered: true` — qui ne rend que ce que le tampon de ressources détient encore,
plafonné à 250 entrées. Ses totaux sont donc **plus bas**, et `upsertVisit` les a écrits
par-dessus les vrais.

**Le danger est structurel, pas observé.** Il a d'abord été cru observé, sur deux exports
du 2026-09-16 montrant `259 → 250` requêtes sur calendar et `507 → 500` sur discord au
même `visitTimestamp`. La comparaison était invalide : le premier export venait de Chrome
et le second de Firefox, deux `storage.local` distincts. Aucune régression de compteur n'a
jamais été constatée en production. Ce qui reste vrai, et suffit à motiver la décision :
deux accumulateurs peuvent exister sur un même document, le second part de zéro, et sur une
clé à trois composants son total plus bas écraserait le premier sans rien signaler.

Le même incident a exposé un second défaut, celui-là bien réel et reproduit : le
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

- Le double comptage remplace une régression possible. Deux lignes pour un document
  ré-injecté recomptent ce que le tampon rejoué avait déjà compté. **La sur-estimation est
  bornée par 250 entrées par ré-injection** ; l'écrasement, lui, n'avait pas de borne.
  C'est un prix payé contre un risque, pas contre un incident : si le double comptage se
  révèle plus coûteux en pratique, la décision se rejuge.
- Une visite vivante au moment d'une mise à jour de l'extension apparaît une seconde fois,
  au lieu de voir son total écrasé.
- Le CSV n'expose pas `observedFrom` : c'est une identité interne, et `visitTimestamp`
  reste le début du document. Deux lignes d'un même document se reconnaissent déjà à leur
  `visitTimestamp` identique.
- Le rejet des messages sans `observedFrom` fait perdre les derniers flushs d'un onglet non
  rechargé au moment d'une mise à jour. C'est la contrepartie assumée du point 3 : un
  message sans instance ne peut pas être classé sans risquer l'écrasement qu'on corrige.

**Maintenue après correction de la preuve.** La décision a été reprise une fois établi que
la régression citée n'avait jamais eu lieu, et confirmée : le danger structurel suffit, et
le garde coûte un champ. Ce point est écrit ici pour que la correction ne serve pas à
rouvrir le débat une seconde fois.

Voir [l'identité de la visite de page](2026-08-21-identite-de-la-visite-de-page.md), que
cette décision prolonge sans la contredire.
