# Comparaison avec la semaine précédente : glissante, couverte, et sans couleur

**Contexte** : la forme de la vue historique, décidée en
[#45](https://github.com/LucasLaurens/carbolate/issues/45) (résolution sur l'issue, prototype sur
la branche `prototype/history-view-shape`), plaçait l'écart hebdomadaire sous les sept barres de
[#14](https://github.com/LucasLaurens/carbolate/issues/14). Ce que cet écart
compare, et ce qu'il affiche quand il ne peut pas comparer, restait ouvert.

Contrainte héritée, non rouverte : **un écart, jamais une note.** `gradeSobrietyLevel` dérive
ses seuils de `DAILY_BROWSING_REFERENCE_G_CO2`, une référence **journalière** ; un total de sept
jours ne peut pas porter de badge de sobriété sans une ancre hebdomadaire, qui serait une
décision de modèle carbone. La carte du jour reste la seule chose notée.

**Décision** :

1. **Fenêtre glissante**, sept jours finissant aujourd'hui contre les sept précédents — pas la
   semaine calendaire. Raison décisive : l'écart s'affiche **sous les barres**, qui sont déjà
   glissantes ; en calendaire, le chiffre comparerait des jours que le graphique juste au-dessus
   ne dessine pas. Le calendaire compare aussi un mardi (deux jours) à une semaine pleine, ce qui
   rendrait l'écart mécaniquement négatif du lundi au samedi sans que la navigation ait changé.

2. **L'écart n'apparaît que si les deux fenêtres sont couvertes.** Comparer sept jours à trois
   donnerait « −60 % » qui mesure la longueur des fenêtres, pas la navigation ; l'accompagner
   d'une mention (« sur 3 jours communs ») demanderait au panneau de 288 px une petite ligne
   qu'il n'a pas, et un écart qu'il faut annoter est un écart qu'on ne devrait pas montrer.
   Coût assumé : **l'écart n'est visible qu'à rétention « Tout », après quatorze jours d'usage.**

3. **Couverture ≠ présence de chaque jour.** Un jour absent _à l'intérieur_ de la quinzaine est
   une journée sans navigation — un vrai zéro. Un jour absent _avant_ le début de la fenêtre
   précédente est une absence de mesure. Seule la date stockée la plus ancienne distingue les
   deux, et c'est elle qui décide : un trou dans la quinzaine ne fait pas disparaître l'écart.

4. **Aucune couleur de jugement** : flèche ▲ / ▼ et pourcentage en gris neutre. Le produit est un
   instrument de prise de conscience, pas un score, et la carte du jour dépense déjà la seule
   couleur de verdict du panneau — un jour sobre dans une semaine en hausse afficherait du vert
   et du rouge à dix pixels l'un de l'autre. Le vert pour la baisse seule a été écarté aussi :
   récompenser l'amélioration sans nommer la hausse est une mécanique de score déguisée.

5. **La comparaison mensuelle reste hors périmètre.** Elle demande soixante jours stockés, donc
   la rétention « Tout », alors que le panneau expose 1 / 7 / Tout — la ligne serait visible pour
   quelques utilisateurs et invisible pour les autres sans que rien ne l'explique. Exposer `30`
   serait rouvrir la rétention, décidée en [#36](https://github.com/LucasLaurens/carbolate/issues/36),
   depuis un ticket d'affichage.

**Conséquences** :

- `computeWeeklyChange(records, today)` retourne un type discriminant
  `{ comparable: false } | { comparable: true, currentTotal, previousTotal, ratio }` : l'appelant
  ne peut pas lire un ratio qui n'existe pas, et aucun `null` ne circule.
- Une semaine précédente **à zéro** rend l'écart non comparable : un rapport n'a pas de sens
  quand son dénominateur est nul, et « +∞ % » n'est pas un chiffre à montrer.
- La ligne vit **dans la carte des sept jours**, séparée par un filet, plutôt que dans une carte
  à elle : une boîte de plus coûterait une bordure et une douzaine de pixels pour une seule ligne.
