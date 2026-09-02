# Nommage — une fonction est une action

Une fonction ou une méthode **fait** quelque chose. Son nom commence par un **verbe
d'action**. Un nom sans verbe décrit une _chose_, et une chose est une donnée, pas un
comportement.

```ts
// ❌ Groupe nominal — se lit comme un champ, cache le coût de l'appel
badgeText(total);
resetPeriodMinutes(retentionDays);
clock.dailyDate();

// ✅ Verbe d'abord — le site d'appel dit ce qui se passe
formatBadgeText(total);
computeResetPeriodMinutes(retentionDays);
clock.readDailyDate();
```

Un nom nominal ment sur le coût : `store.dailyRecord()` paraît gratuit et fait un aller-retour
storage. `store.getDailyRecord()` annonce le travail.

## Choisir le verbe selon ce qui se passe vraiment

| La fonction…                                   | Verbe                                              |
| ---------------------------------------------- | -------------------------------------------------- |
| lit un store / une API et retourne des entrées | `find…`, `list…`, `read…`, `get…`                  |
| dérive une valeur de ce qu'elle reçoit         | `compute…`, `build…`, `format…`                    |
| classe une valeur dans un palier nommé         | `grade…`, `classify…`                              |
| résout une indirection (table, mapping)        | `resolve…`                                         |
| transforme A en B                              | `to…`, `convert…`, `map…`                          |
| change un état, ne retourne rien               | `save…`, `update…`, `clear…`, `apply…`, `refresh…` |
| construit et retourne un nouvel objet          | `create…`, `make…`, `build…`                       |
| répond oui/non                                 | `is…`, `has…`, `can…`, `should…`, `allows…`        |

Prendre le verbe **vrai**, pas le plus vague qui passe. `handle…` / `process…` / `manage…`
ne nomment rien : si c'est le seul verbe qui convient, la fonction en fait trop (voir
`solid.md`, SRP).

## Ce que la règle ne couvre pas

- **Composants React** — `StatsGrid`, `MethodDisclosure`, `SectionLabel`. Un composant
  _est_ une chose. Les hooks gardent le préfixe `use…`.
- **Propriétés et valeurs calculées** — un champ, une clé de type, une constante :
  `totalMetrics`, `avoidedCo2`, `purgeProgramIds` restent nominaux.
- **Entrées de dictionnaire i18n** — `t.badge.tooltip(g, level)`, `t.equivalence.car(km)`.
  Ce sont des gabarits de texte, de la donnée paramétrée, pas des méthodes.
- **Noms imposés par une plateforme** — `render()`, `componentDidMount()`, et les adaptateurs
  qui recopient une API du navigateur (`setText`, `getSessions`, `Clock.now()` / `nowMs()`
  qui reprennent `Date.now`).
- **Conversions idiomatiques** — `toCSV()`, `toCarbonInput()`, `bytesToMegabytes()`.
  Le patron `X → Y` se lit déjà comme une action.
- **Noms de fichiers et de modules** — `avoidedCarbon.ts` peut exporter
  `computeAvoidedCarbon()`. Le fichier nomme un sujet, l'export nomme un geste.
- **Tests** — `it("computes …")` commence déjà par un verbe. Les _helpers_ de test, eux,
  suivent la règle.

## Corriger ce qu'on touche

Renommer les fonctions nominales rencontrées **dans les fichiers que le changement ouvre
déjà**, dans le même commit, sites d'appel inclus. Une interface qui parle deux langues de
nommage est pire que l'une ou l'autre.

- **Ne pas partir à la chasse.** Un fichier seulement traversé — un site d'appel mis à jour
  parce qu'un nom a bougé — ne devient pas le nôtre.
- **Un renommage préserve le comportement ou n'est pas un renommage.** Tous les sites
  d'appel, la suite verte, `grep` de l'ancien nom vide, docs incluses.

## Signal

Lire le site d'appel à voix haute. Si ça sonne comme un accès à un champ
(`badgeColor(level)`), le nom est nominal. Si ça sonne comme un ordre
(`resolveBadgeColor(level)`), c'est une fonction.
