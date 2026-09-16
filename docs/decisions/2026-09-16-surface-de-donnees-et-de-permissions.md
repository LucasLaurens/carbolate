# Réduire la surface : ni query string stockée, ni host permissions demandées

**Contexte** : un audit de sécurité a relevé deux excès, tous deux sans exploitation
connue, tous deux gratuits à corriger.

Le premier : le background stockait `sender.url` brut. Une query string transporte
couramment un secret — lien magique, jeton de réinitialisation, `?email=`, jeton d'accès
après le `#` d'un flow OAuth implicite. Ces valeurs atterrissaient telles quelles dans
`chrome.storage.local`, puis dans chaque export CSV, alors que le modèle carbone n'en tire
rien : l'URL ne sert qu'à attribuer une estimation à un site. L'extension n'émet aucune
requête réseau, donc rien ne fuitait — mais un CSV partagé, ou un profil navigateur copié,
exposait des identifiants qu'aucune fonctionnalité ne justifiait de garder.

Le second : le manifest demandait `host_permissions: ["<all_urls>"]` sans jamais s'en
servir. Injecter un content script déclaré ne réclame que `content_scripts.matches`. Les
host permissions ajoutent le `fetch` cross-origin, les cookies et les champs sensibles de
`tabs` (`url`, `title`, `favIconUrl`) — trois capacités qu'aucune ligne de `src/` n'appelle,
et dont la première est déjà interdite par `test/no-network-egress.test.ts`. La preuve que
c'était superflu existait depuis le portage Firefox : Firefox MV3 n'accorde pas les host
permissions à l'installation, le background lit donc `sender.url` et non `sender.tab.url`
(voir `2026-08-01-multi-browser-build.md`) — l'extension tournait déjà sans.

**Décision** :

- `parseDomain` retourne un `storableUrl` en plus du domaine : `origin + pathname`, jamais
  la query ni le fragment. La coupe vit au seul endroit qui parse déjà l'URL, donc aucun
  appelant ne peut l'oublier, et `MetricsIntake` persiste ce champ plutôt que l'URL reçue.
- `host_permissions` disparaît des deux manifests. `content_scripts.matches` conserve
  `<all_urls>` : l'accès aux sites que l'utilisateur voit à l'installation ne change pas.

**Conséquences** :

- L'identité d'une visite — `(tabId, meta.date, url, meta.observedFrom)` — porte désormais
  une URL tronquée. Aucune collision nouvelle : deux documents distincts dans un même
  onglet ont des `performance.timeOrigin` distincts, et deux URLs qui ne diffèrent que par
  leur query sont deux navigations donc deux documents.
- Les exports CSV d'avant ce changement gardent leurs query strings. Rien ne les réécrit :
  la rétention finira par les effacer, et le fichier déjà téléchargé appartient à
  l'utilisateur.
- La politique de confidentialité change de formulation dans les deux langues, panneau et
  page publiée : elle promet maintenant explicitement que ni les paramètres ni l'ancre ne
  sont conservés.
- Un futur besoin de `fetch` cross-origin devra redemander la permission — et se heurtera
  d'abord à `test/no-network-egress.test.ts`, ce qui est l'effet recherché.
