# Énergie de l'écran : facteur sourcé, part attributionnelle

**Contexte** : `DEVICE_FACTOR = 0.0014` gCO₂e/s était une estimation maison unique, décrite
comme « ≈ 11 W au-dessus du repos, CPU + GPU intégré + écran ». Trois choses s'y cachaient :
un chiffre global sans source, un écran mélangé au reste de la machine, et une part
attributionnelle (l'écran était déjà allumé) présentée comme une émission comme les autres.
`screenCo2` était en `decided` au glossaire depuis l'ADR périmètre sans jamais être écrit.

La recherche de [#42](https://github.com/LucasLaurens/carbolate/issues/42) a donné deux
candidats : `3,4 W` pour la dalle seule (moyenne de parc Fraunhofer/DOE) et `1,0 W/dm²`
(Commission européenne).

**Décision** :

1. **Facteur écran : Fraunhofer, 3,4 W.** Le `1,0 W/dm²` exige une diagonale physique
   qu'aucune API navigateur n'expose ; la déduire d'une résolution serait inventer une donnée,
   ce que l'[ADR périmètre](2026-08-05-perimetre-modele-carbone.md) interdit.
   `3,4 W × 1,2278e-4 gCO₂e/W·s` (442 gCO₂e/kWh) ⇒ `SCREEN_FACTOR = 0.00042`.

2. **Découpage en deux constantes.** `DEVICE_FACTOR` passe à `0.00098` (CPU + GPU),
   `SCREEN_FACTOR` vaut `0.00042`. Leur somme est exactement `0.0014` : aucun jour déjà
   stocké ne bouge, la scission nomme une part, elle n'en ajoute pas. Le facteur unique
   aurait sinon porté deux sens selon la fenêtre de temps considérée.

3. **Les 8,0 W restants sont une estimation maison, et le disent.** `11,40 W` était la
   puissance implicite de l'ancien facteur ; moins les `3,4 W` sourcés de la dalle, il reste
   `8,0 W` que personne ne publie. À ≈ 0,003 g par page, trop petit pour bloquer sur une
   recherche, trop réel pour être supprimé. Le commentaire de `DEVICE_FACTOR` porte
   l'étiquette.

4. **`screenCo2` est une allocation attributionnelle**, pas une émission évitable : une
   dalle allumée n'est pas causée par la page, seulement utilisée par elle. Fermer l'onglet
   ne l'éteint pas. Dit au glossaire **et** dans le `<details>` « Comment ce chiffre est
   construit » des Paramètres — un utilisateur qui lit le chiffre n'ouvre pas le glossaire.

5. **L'ancre de 120 g/jour ne bouge pas.** L'écran ajoutera +6 à +12 g/jour une fois le temps
   d'affichage réel disponible, soit +5 à +10 %. Déplacer l'ancre rejugerait la sobriété de
   tout l'historique déjà stocké ; les seuils restent ce qu'ils sont, et cette phrase existe
   pour qu'on ne le « corrige » pas plus tard par inadvertance.

**Conséquences** :

- `ScreenCarbonSource` s'ajoute aux sources par défaut. Son entrée est la **durée de
  chargement** — la seule durée allumée que l'extension observe aujourd'hui.
  [#40](https://github.com/LucasLaurens/carbolate/issues/40) élargira cette entrée à tout le
  temps d'affichage **sans toucher au facteur**. Tant que #40 n'est pas livré, `screenCo2`
  est structurellement sous-estimé : il ne compte que le chargement.
- `CarbonEstimate` gagne `screenCo2`, donc `sumCarbonEstimates`, les éléments neutres et
  `normalizeDailyRecord` le portent. Les jours stockés avant la scission **ne sont pas
  re-répartis** : leur `screenCo2` vaut 0 et leur total reste celui que l'utilisateur a vu.
  La part est inconnaissable a posteriori, et zéro n'invente rien.
- L'export CSV gagne `screenCo2_g` entre `deviceCo2_g` et `totalCo2_g`. En-tête précédent
  **abandonné, pas versionné** — même traitement qu'à la fusion `cpuCo2`/`renderingCo2`, pour
  la même raison : l'extension n'est pas publiée, aucun fichier exporté dans la nature ne
  dépend de l'ancien format.
- Glossaire : `Screen CO₂` passe de **decided** à **live** ; `Attributional allocation` est
  ajouté au chapitre Attribution.
