# Licence du dépôt : propriétaire, tous droits réservés

**Contexte** : le dépôt est privé et n'a jamais porté de fichier `LICENSE` — `gh repo view` renvoie `licenseInfo: null`. Rien ne l'exigeait tant que le code ne quittait pas la machine.

La soumission à AMO change ça. Mozilla impose de fournir les sources quand l'extension expédie du code construit ou bundlé, ce qui est le cas de Carbolate — d'où `npm run package:sources`, qui fait un `git archive` de `HEAD`. Le formulaire de soumission d'un add-on comporte par ailleurs un champ licence obligatoire. La question n'était donc plus « faut-il une licence » mais « sous quelle licence ce code est-il remis au relecteur ».

Aucune contrainte externe ne dictait la réponse : toutes les dépendances (React, chart.js, Tailwind, Vite) sont MIT ou permissives, donc aucun copyleft entrant ne forçait une licence ouverte.

La seule contrainte réelle est l'asymétrie de l'irréversibilité. Une licence est irrévocable sur les copies déjà distribuées, révocable sur les copies futures. Publier MIT aujourd'hui remettrait le zip AMO sous MIT pour toujours — risque pratique quasi nul, le seul détenteur étant un relecteur, mais la question du copyleft serait tranchée par confort plutôt que par choix. Fermé → ouvert reste un simple commit ; ouvert → fermé est impossible.

Cette asymétrie compte particulièrement ici parce que Carbolate est un instrument de mesure au chiffre déjà fragile — `DEVICE_FACTOR` maison, périmètre usage seulement, plancher à 20–25 %. Le dommage crédible d'une ouverture n'est pas qu'on lise le code, c'est qu'un fork change les constantes et republie d'autres chiffres sans le dire. Une licence permissive l'autorise silencieusement ; un copyleft forcerait le fork à publier son modèle modifié, donc à rester auditable. Ce n'est pas la décision d'aujourd'hui, mais c'est la raison de ne pas la brûler.

**Décision** :

- Un fichier `LICENSE` à la racine : copyright Lucas Laurens 2026, tous droits réservés, aucun droit accordé. Il précise que les sources sont fournies à AMO aux seules fins de revue et que cette remise n'accorde rien au-delà.
- Rédigé en anglais : son unique lecteur externe est un relecteur AMO.
- Le champ licence du formulaire AMO est renseigné _All Rights Reserved_, cohérent avec le fichier.
- **Pas** de champ `"license"` dans `package.json`. Le paquet n'est pas publié sur npm, donc ce champ serait une seconde copie du même fait sans lecteur qui compte. Le fichier `LICENSE` est le domicile unique.
- L'ouverture du dépôt est souhaitée à terme mais n'est pas décidée, et **quelle** licence ouverte elle porterait ne l'est pas non plus. Cette décision se prendra au moment de l'ouverture, avec la contrainte qui la motivera.

**Conséquences** :

- `git archive HEAD` embarque `LICENSE` sans configuration : il n'y a pas de `.gitattributes` dans le dépôt, donc rien ne l'exclut. `carbolate-sources.zip` est auto-descriptif — le relecteur n'a pas à croiser le zip avec le formulaire.
- Aucune option n'est brûlée. Ouvrir le code plus tard consiste à remplacer le contenu du fichier ; personne ne détient de droit à révoquer.
- Le jour de l'ouverture, la décision à prendre est permissif contre copyleft, et l'argument d'auditabilité du modèle carbone en fait partie.
- Aucun test n'accompagne cette décision : une fois le champ `package.json` écarté, il n'existe qu'une représentation du fait, donc rien à faire diverger.
