# La garde anti-egress regarde le bundle, pas seulement nos sources

**Contexte** : `test/no-network-egress.test.ts` existait pour tenir la promesse publiée —
l'extension n'émet aucune requête réseau — mais ne scannait que `src/`. Deux angles morts.

Le premier, prévisible : `scripts/` n'était pas couvert, alors que ce code tourne en CI, où
une requête serait une étape de chaîne d'approvisionnement que personne n'a relue.

Le second, moins : `src/` ne dit rien des dépendances. React et Chart.js atterrissent dans
`side_panel.js` et arrivent chez l'utilisateur exactement comme notre code. Le scan du
bundle, écrit pour cet audit, a immédiatement trouvé un `fetch(` — le polyfill
`modulepreload` de Vite, qui parcourt les liens de préchargement du document et les
récupère. Les URLs en question sont des fichiers locaux de l'extension, donc ce n'était pas
une fuite ; mais c'était bien un appel réseau dans le paquet livré, sous une politique qui
promet que « le code ne contient pas de fetch ». Aucune discipline dans `src/` ne pouvait
le révéler.

**Décision** :

- `modulePreload: { polyfill: false }` dans `vite.config.ts`. Le panneau est une entrée
  unique : le HTML généré ne contient aucun `<link rel="modulepreload">` à combler, et tous
  les navigateurs supportés les gèrent nativement — Firefox depuis la 115, qui est déjà le
  `strict_min_version` du manifest. Supprimer plutôt qu'autoriser : la garde peut affirmer
  zéro occurrence.
- Trois scans au lieu d'un, sur une seule liste de motifs (`test/egress.ts`) : `src/` (APIs
  - toute adresse), `scripts/` (APIs seules — une URL de fixture y est de la donnée), et
    `dist/` (APIs, plus toute adresse externe dans le `.html`/`.css` du panneau, qui peut en
    charger une sans JavaScript).
- Le scan du bundle tourne là où `dist/` existe : toujours en CI, dont l'étape de test passe
  désormais **après** le build, et localement pour qui a lancé un build.

**Conséquences** :

- La promesse porte enfin sur ce que l'utilisateur installe, dépendances comprises, et non
  sur le sous-ensemble que nous tapons nous-mêmes.
- Deux adresses restent tolérées dans le bundle : React embarque des constantes d'espace de
  noms XML (`http://www.w3.org/2000/svg`). Ce sont des identifiants, pas des destinations,
  et sans aucune API de requête rien ne peut les appeler.
- La détection reste textuelle, donc contournable par concaténation. Elle arrête la
  régression accidentelle et la dépendance qui change d'avis — pas un contributeur hostile.
  Ce qui l'arrêterait, lui, est la revue de `package-lock.json`, pas une regex.
- Le panneau a été rendu sans le polyfill et regardé : React monte, les deux graphiques
  Chart.js se dessinent, le CSS et l'i18n sont intacts.
