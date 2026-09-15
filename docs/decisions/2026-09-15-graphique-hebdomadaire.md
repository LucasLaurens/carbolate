# Graphique hebdomadaire : sept barres en `div`, et rien pour un jour sans mesure

**Contexte** : [#45](https://github.com/LucasLaurens/carbolate/issues/45) avait fixé la
**forme** — une section de `DayView`, sous le graphique des domaines, absente quand le
storage ne contient qu'un jour. Restaient trois décisions de contenu.

**Décision** :

1. **Des `div`, pas Chart.js.** `chart.js/auto` est déjà dans le bundle pour le graphique
   des domaines : l'argument du poids ne tranche donc rien — zéro octet de plus dans les deux
   cas. Ce qui tranche est le test : sept barres sont une règle de trois, `buildWeekBars` est
   une fonction pure testable sans DOM, ce que `.claude/rules/tdd.md` exige. Chart.js
   imposerait `useRef` + `useEffect` + `chart.destroy()` et un canvas pour tester quoi que ce
   soit.

2. **Un jour sans mesure ne dessine pas de barre**, et son libellé passe en gris clair. Un
   jour sans navigation et un jour absent du storage donnent tous deux zéro, et le panneau ne
   sait pas les distinguer — dessiner une barre à zéro affirmerait une journée sobre qui n'a
   jamais été mesurée. C'est la règle qui avait déjà écarté l'onglet vide de #45 : ne pas
   dessiner une donnée qu'on n'a pas. Le type le dit avant le rendu :
   `WeekBar` est un discriminant `measured: true | false`, pas un `totalCo2` nullable.

3. **Toujours sept jours**, même quand la rétention vaut « Tout ». Dans les 288 px utiles du
   panneau, un septième fait 37 px — la seule largeur où la valeur en grammes tient au-dessus
   de sa barre. Trente barres feraient 8 px : c'est un second graphique à concevoir, pas un
   réglage de celui-ci.

**Conséquences** :

- `buildWeekBars(records, today, language)` vit dans `src/components/popup/DayView/weekBars.ts`,
  indexe les jours stockés dans une `Map` et lit sept dates — `O(n + 7)` plutôt qu'un parcours
  par barre.
- La présence de la section dépend des **données** (`days.length > 1`), pas de la préférence :
  un utilisateur qui vient de réduire sa fenêtre a encore des jours jusqu'à la purge.
- `Popup` charge désormais tous les jours au montage et à chaque « Actualiser », en parallèle
  du jour courant. Son store reste un `DailyRecordReader` : lecture seule sur les mesures.
- La couleur de barre vient de `SOBRIETY_COLOR`, ancre **journalière** — une barre par jour,
  jamais une note sur l'agrégat de sept jours, ce que la carte porte en _Out of scope_.
- Les libellés de jour viennent d'`Intl.DateTimeFormat`, pas d'une table i18n : sept noms de
  jours par langue seraient une deuxième source de vérité pour ce que la plateforme sait déjà.
