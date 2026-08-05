# Niveaux de sobriété dérivés d'une ancre unique, comparaison mondiale dégrossie

**Contexte** : deux échelles cohabitaient dans la même carte de l'UI sans partager de référence.

Les paliers de niveau — 50 / 250 / 600 gCO₂e — étaient codés en dur dans `src/components/popup/DayView/utils.ts`, hors de `carbon/constants.ts`, et sans source documentée, contrairement à tous les autres facteurs du modèle. La comparaison affichait par ailleurs un écart à `WORLD_DAILY_BROWSING_G_CO2 = 120` (ADEME 2023 / Shift Project 2022).

Résultat lisible à l'écran : « 🥈 modéré » et « +25 % vs moyenne mondiale » côte à côte, deux verdicts qui semblent se contredire parce qu'ils ne mesurent pas la même chose et ne partagent aucune base.

Une dérivation depuis un budget carbone individuel (2 tCO₂e/an → part du numérique → part de la navigation web) a été tentée puis abandonnée : elle enchaîne trois ratios dont deux ne sont pas sourçables proprement. Chaque maillon multiplie l'incertitude, et le résultat aurait été une invention habillée en calcul.

**Décision** : une seule ancre sourcée, `DAILY_BROWSING_REFERENCE_G_CO2 = 120`, dont les paliers sont des multiples.

```
sobre     < 0.5 × réf =  60 gCO₂e
modéré    < 1.5 × réf = 180 gCO₂e
intensif  < 4   × réf = 480 gCO₂e
excessif  ≥ 4   × réf
```

Les multiplicateurs `0.5 / 1.5 / 4` sont un **choix de design, pas une source** — aucune étude ne dit à partir de quand naviguer devient excessif. Ce qui est sourcé, c'est l'ancre ; les paliers sont normatifs et le glossaire le dit sans le déguiser. Les valeurs obtenues restent proches des 50 / 250 / 600 précédents : le comportement observable bouge à peine.

Les paliers quittent `DayView/utils.ts` pour `carbon/constants.ts`, aux côtés des autres facteurs.

**Sur la comparaison mondiale** : la référence de 120 g est une estimation à **périmètre large**, incluant l'amortissement de la fabrication des terminaux et des équipements réseau. Le chiffre de Carbolate est, lui, en usage seulement. Comparer les deux produit un écart structurellement flatteur, d'environ 20 à 25 %.

Trois issues ont été pesées. Décoter la référence à périmètre comparable supposait de sourcer la part incorporée à retirer — soit remplacer un biais par une invention. Supprimer la comparaison faisait disparaître l'ancre dont dépendent désormais les paliers.

Retenu : garder `120` et **supprimer la fausse précision**. Le problème n'est pas la valeur, c'est `−73 % vs moyenne mondiale` — un pourcentage à l'unité près assis sur une comparaison biaisée de 20 à 25 %. `getWorldAverageComparison()` retourne donc une **position** et non un ratio : bien en dessous / en dessous / autour / au-dessus / bien au-dessus. Une affirmation grossière survit à un biais de 25 % ; un chiffre précis non.

**Conséquences** :

- Les niveaux et la comparaison partagent enfin leur référence : ils cessent de se contredire à l'écran.
- Changer la référence déplace mécaniquement les quatre paliers. C'est voulu — une seule connaissance, un seul domicile — mais cela veut dire qu'aucune valeur de seuil ne doit jamais être réécrite en dur ailleurs.
- `WorldAvgTranslations` passe de trois entrées paramétrées par un pourcentage (`below(pct)`, `above(pct)`, `equal()`) à cinq libellés sans paramètre. Les deux fichiers i18n changent ensemble.
- Les clés de niveau `"sobre" | "modere" | "intensif" | "excessif"` sont du français dans une base anglaise. Elles deviennent `"sober" | "moderate" | "intensive" | "excessive"`, le français restant du côté des traductions.
- Un test doit échouer si un palier cesse d'être un multiple de l'ancre : c'est la connaissance dupliquée que cette décision élimine, et rien n'empêche mécaniquement de la réintroduire.
