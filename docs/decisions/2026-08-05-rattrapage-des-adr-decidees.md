# Rattrapage des ADR décidées : ce qui est implémenté, ce qui reste dehors

**Contexte** : quatre ADR datées du 2026-08-05 étaient enregistrées mais non
implémentées. Le glossaire portait la colonne `Status` pour dire exactement cela, et
le mécanisme a fonctionné — sauf qu'un lecteur trouvait `DAILY_BROWSING_REFERENCE_G_CO2`
marqué `live` alors que le code exposait `WORLD_DAILY_BROWSING_G_CO2`, des paliers de
sobriété codés en dur à `50 / 250 / 600` dans un helper de panneau, et une roadmap V2
écrite de bout en bout sur un `ResetPeriod` que l'ADR unités avait supprimé.

Une décision enregistrée mais non appliquée n'est pas neutre : elle rend la
documentation fausse. La règle du projet dit qu'une définition périmée est pire
qu'une définition absente.

Le périmètre a été découpé selon une seule question : **est-ce que cet incrément
change le modèle de données observable par l'utilisateur, ou seulement sa forme
interne ?**

**Décision** : appliquer les trois ADR dont l'effet est contenu, ajouter la seule
brique de la quatrième qui ne dépend de rien, et laisser le reste explicitement
dehors.

## Implémenté

**1. `ResetPeriod` supprimé** ([ADR unités et rétention](2026-08-05-unites-et-retention.md)).
`retentionDays` est la source de vérité unique ; la période de l'alarme se dérive via
`resetPeriodMinutes()` dans `src/config/retention.ts`. La dérivation retenue conserve
la cadence des deux valeurs livrées — une fenêtre d'un jour ou « tout conserver » est
vérifiée toutes les 24 h, une fenêtre plus longue une fois par fenêtre. Vérifier plus
souvent aurait été défendable, mais aucune ADR ne le demandait et ce serait un
changement de comportement non décidé.

**2. Paliers de sobriété dérivés de l'ancre** ([ADR niveaux de sobriété](2026-08-05-niveaux-sobriete-et-reference-mondiale.md)).
`DAILY_BROWSING_REFERENCE_G_CO2` porte enfin le nom du glossaire. Les paliers
`60 / 180 / 480` sont les multiples `0.5 / 1.5 / 4` de l'ancre, calculés et jamais
écrits. Ils quittent `DayView/utils.ts` pour `src/carbon/sobriety.ts` : le modèle
décide de la note, le panneau décide de la peinture. Les clés françaises
`"sobre" | "modere" | "intensif" | "excessif"` deviennent `SobrietyLevel`
(`"sober" | "moderate" | "intensive" | "excessive"`). `getWorldAverageComparison()`
devient `compareToDailyReference()` et retourne une **position** — cinq libellés sans
paramètre — au lieu d'un pourcentage.

Sur le test que l'ADR réclamait : il est écrit **contre le comportement**, pas contre
les constantes. Asserter `palier === ancre × multiplicateur` ne ferait que répéter la
dérivation et ne pourrait jamais échouer. `src/carbon/sobriety.test.ts` asserte donc
où la _note_ bascule, ce qui échoue dès qu'un littéral est réécrit dans la table des
niveaux — la régression qui peut réellement se produire.

**3. `cpuCo2` et `renderingCo2` fusionnés en `deviceCo2`** ([ADR périmètre](2026-08-05-perimetre-modele-carbone.md)).
Facteur `0.0014`, soit exactement la somme des deux coefficients : aucun jour déjà
stocké ne change de valeur. `cpuTimeToLoad` devient `pageLoadDurationSec`. L'en-tête
CSV change et l'ancien format est **abandonné plutôt que versionné** — l'export
n'avait aucun bouton avant ce lot, donc aucun fichier existant n'en dépend.

**4. CO₂ évité ajouté** (même ADR). C'est la seule brique de cette ADR qui ne
dépendait pas de l'enregistrement vivant : `decodedBodySize` est déjà disponible au
`window.load`. Chiffre positif, jamais soustrait du total, exposé en CSV et sur une
ligne dédiée du panneau.

**5. Lecture tolérante du storage.** `src/session/legacy.ts` normalise chaque
enregistrement à la sortie du storage, dans une seule fonction. Trois formes de
`CarbonEstimate` ont été persistées et les trois sont encore installées quelque part.
Les totaux d'un jour sont **reconstruits depuis ses onglets normalisés** plutôt que
normalisés séparément : un total qui ne correspond pas à ses parties — mise à jour
interrompue en cours d'écriture — est corrigé au lieu d'être propagé. Les `?? 0` qui
traînaient dans l'agrégateur et dans l'export CSV disparaissent : un garde-fou répété
dans trois modules, c'est trois occasions d'avoir un champ de retard.

**6. Les deux boutons morts câblés.** `Popup.handleExport` n'était référencé par
aucun JSX et `DayView` recevait un `onRefresh` qu'il ne déstructurait même pas.
Export : la permission `downloads` était demandée pour une fonctionnalité
inatteignable, ce qui est aussi un angle de refus à la revue AMO. Refresh : le
panneau est un side panel sur Chromium et une sidebar sur Gecko, donc il reste monté
pendant la navigation et ses chiffres périment immédiatement — le bouton n'est pas un
confort, c'est le seul moyen de voir une nouvelle mesure sur ces deux surfaces.

**7. Le typecheck entre dans la CI.** `tsconfig.json` incluait `src` et un chemin
fantôme (`src/background/backgrsrc/content/content.ts/content.ts`), donc `test/`
n'était pas typé du tout ; et la CI ne lançait jamais `tsc`. ESLint n'est pas
type-aware ici et le build transpile sans vérifier : rien dans le pipeline n'aurait
signalé une erreur de type. Le hook `.husky/pre-commit` n'était par ailleurs pas
exécutable, donc `lint-staged` n'avait jamais tourné.

## Laissé dehors, et pourquoi

**`screenCo2`** ([ADR périmètre](2026-08-05-perimetre-modele-carbone.md)) : son entrée
est le temps d'écran cumulé, qui n'existe pas sans l'écouteur `visibilitychange` de
l'enregistrement vivant. L'ajouter reviendrait à implémenter l'ADR visite de page par
la porte de derrière.

**Visite de page, enregistrement vivant, cycle de vie**
([ADR visite de page](2026-08-05-page-visit-unite-de-mesure.md)) : ce n'est pas de la
dette, c'est une fonctionnalité. Le volume stocké croît d'un ordre de grandeur, les
totaux du jour deviennent monotones croissants et il faut le dire dans l'UI sous
peine de faire passer un compteur en cours pour un bug. À planifier comme tel — et
`MetricsCollector` a été mis derrière deux ports précisément pour que ce travail
arrive dans un module testable.

**Domaine enregistrable, premier/tiers, poids tiers** (même ADR) : techniquement
faisable au `window.load`, mais cela ajoute un concept métier exposé, donc un terme de
glossaire, une clé i18n et une surface UI. Hors du périmètre d'un rattrapage.

**Conséquences** :

- Le glossaire passe huit termes de `decided` à `live`. Dix restent `decided` et
  décrivent toujours une décision, pas le code.
- `roadmap-v2.md` est réécrite sur `retentionDays`. L'ADR unités avait prévu que cette
  réécriture serait due ; elle l'était depuis quatre commits.
- Les paliers affichés bougent légèrement : `50 / 250 / 600` → `60 / 180 / 480`. Un
  utilisateur peut voir sa note changer d'un cran sans que sa navigation ait changé.
  C'est le prix d'une ancre unique et l'ADR l'avait annoncé.
- La comparaison mondiale perd son pourcentage. `WorldComparisonTranslations` passe de
  trois entrées paramétrées à cinq libellés constants, dans les deux langues.
- Un enregistrement stocké n'est jamais réécrit : la normalisation est en lecture
  seule et le storage garde son ancienne forme jusqu'à la prochaine écriture réelle.
