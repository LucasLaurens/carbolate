# Une fonction est une action : son nom commence par un verbe

**Contexte** : le code mélangeait deux langues de nommage. `badgeText(total)`,
`resetPeriodMinutes(days)`, `clock.dailyDate()`, `emptyDailyRecord(date)` se lisaient comme
des champs alors qu'ils formatent, dérivent, lisent une horloge ou construisent un objet ;
à côté d'eux `refreshBadge`, `measurePage`, `recordTabMetrics`, `clearPastDays` annonçaient
leur geste. Un nom nominal ment sur le coût de l'appel : `store.dailyRecord()` paraît
gratuit et fait un aller-retour storage. La règle vivait dans les instructions globales,
pas dans le dépôt, donc rien ne la faisait tenir ici.

**Décision** : toute fonction et toute méthode commence par un verbe d'action, et le verbe
dit ce qui se passe réellement (`compute…` dérive, `format…` met en forme, `grade…` classe,
`resolve…` résout une table, `read…`/`get…` lit une source, `create…` construit,
`is…`/`has…`/`allows…` répond oui/non). La règle est écrite dans
[`CLAUDE.md`](../../CLAUDE.md), section « Nommage »,
avec ses exceptions : composants React, propriétés et valeurs calculées, entrées de
dictionnaire i18n, noms imposés par la plateforme (`render`, `setText`, `Clock.now()` qui
reprend `Date.now`), conversions idiomatiques (`toCSV`, `bytesToMegabytes`), et noms de
fichiers — `avoidedCarbon.ts` nomme un sujet, il peut exporter `computeAvoidedCarbon()`.

Renommages appliqués à tout le dépôt dans le même commit :

| Avant                                                       | Après                                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `badgeText`                                                 | `formatBadgeText`                                                             |
| `badgeColor`                                                | `resolveBadgeColor`                                                           |
| `tooltipGrams`                                              | `formatTooltipGrams`                                                          |
| `resetPeriodMinutes`                                        | `computeResetPeriodMinutes`                                                   |
| `avoidedCarbon`                                             | `computeAvoidedCarbon`                                                        |
| `sobrietyLevel`                                             | `gradeSobrietyLevel`                                                          |
| `emptyMetrics` / `emptyCarbonEstimate` / `emptyDailyRecord` | `createEmptyMetrics` / `createEmptyCarbonEstimate` / `createEmptyDailyRecord` |
| `numberOr`                                                  | `coalesceNumber`                                                              |
| `csvUrl`                                                    | `buildCsvUrl`                                                                 |
| `choiceClass`                                               | `buildChoiceClass`                                                            |
| `Clock.dailyDate`                                           | `Clock.readDailyDate`                                                         |
| `PerformanceSource.resources` / `.navigations`              | `readResources` / `readNavigations`                                           |

**Conséquences** :

- `Clock` garde `now()` et `nowMs()`, qui recopient `Date.now()` : l'idiome pèse plus que
  l'uniformité de préfixe, et `readDailyDate()` est le seul membre dérivé de l'interface.
- Renommage à comportement constant : 225 tests verts avant et après, `tsc --noEmit` propre,
  `grep` des anciens noms vide hors les contre-exemples de la règle.
- Les ADR antérieures ont été mises à jour sur les noms de code qu'elles citaient, pour
  rester navigables ; leurs décisions ne changent pas.
- Le nom de fichier `src/carbon/avoidedCarbon.ts` reste tel quel : ce sont les exports qui
  portent le verbe, pas les modules.
