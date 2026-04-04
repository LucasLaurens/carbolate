# Carbolate — Règles techniques

## SOLID

- **S** — Une classe/fonction = une responsabilité. Si tu dois écrire "et" pour décrire ce qu'elle fait, découpe-la.
- **O** — Étends par composition ou nouveaux types, pas en modifiant du code existant. Préfère les stratégies et les handlers pluggables.
- **L** — Un sous-type doit pouvoir remplacer son parent sans changer le comportement observable. Pas d'override qui lève des exceptions inattendues.
- **I** — Interfaces petites et focalisées. Une interface qui n'est que partiellement implémentée doit être découpée.
- **D** — Les modules haut niveau ne dépendent que d'abstractions (interfaces/types). Injecte les dépendances, ne les instancie pas à l'intérieur.

## Design Patterns

Utilise les patterns nommés quand ils s'appliquent naturellement — pas pour paraître malin :

- **Strategy** — pour les variantes d'algorithme interchangeables (ex: sources de carbone)
- **Composite** — pour les agrégats d'objets traités uniformément
- **Observer** — pour les réactions à des événements sans couplage direct
- **Repository** — pour isoler l'accès aux données (storage) du reste
- **Factory** — pour centraliser la construction d'objets complexes

Ne pas sur-ingénierer : si un pattern ajoute des couches sans valeur, ne l'utilise pas.

## DRY

- Duplique du code 2 fois → c'est acceptable. 3 fois → extrait une abstraction.
- La duplication accidentelle (code similaire, sémantique différente) ne doit PAS être dédupliquée.
- Préfère les fonctions pures extraites aux helpers de classe pour la réutilisation.

## Structures de données & Algorithmes

- Choisis la structure adaptée à l'usage : `Map` pour les lookups O(1), `Set` pour l'unicité, tableaux pour les séquences ordonnées.
- Évite les O(n²) implicites : pas de `.find()` dans une boucle sur de grandes collections — utilise un index.
- Nomme les structures métier explicitement (`DailyRecord`, pas `Record<string, any>`).
- Pas de mutation silencieuse : les fonctions qui transforment des données retournent de nouvelles structures.

## Pas de paramètres nullables

- Jamais `foo(x?: string)` quand `x` change le comportement — crée plutôt deux fonctions distinctes.
- Utilise des types union explicites plutôt que `null` / `undefined` en valeur de retour : retourne un `Result<T, E>` ou un type discriminant.
- Si une valeur peut être absente, modélise-la dans le type (`Option<T>` ou pattern objet nul), pas par un `null` passé en argument.
- Les constructeurs et factories doivent recevoir des données complètes et valides.

## TDD Friendly

- Écris le code pour qu'il soit testable sans modifications : pas de dépendances statiques, pas de `new` dans les constructeurs métier.
- Les effets de bord (storage, messages Chrome, API) doivent être derrière des interfaces injectables.
- Chaque comportement métier doit être exprimable comme un test unitaire pur (entrée → sortie attendue), sans mock du DOM ni de Chrome.
- Les tests existants (`npm test`, Vitest) doivent toujours passer avant et après chaque modification.
- Un test qui dépend de l'ordre d'exécution ou de l'état global est un signal d'architecture à corriger, pas à contourner.

## Commits & attribution

- Les messages de commit ne mentionnent pas Claude, l'IA, ni aucun outil de génération. Le code appartient au projet, pas à son auteur circonstanciel.
- Pas de `Co-Authored-By: Claude`, pas de `Generated with Claude Code`, pas de mention similaire dans les commits, PR, ou commentaires de code.
- Le message de commit décrit l'intention du changement, pas la mécanique ("add carbon threshold logic", pas "add if statement to check value").

## Commentaires

- Un commentaire doit expliquer le **pourquoi**, jamais le **quoi** — le code dit déjà ce qu'il fait.
- Supprimer tout commentaire qui paraphrase le code : `// increment i` au-dessus de `i++` est du bruit.
- Pas de blocs commentés laissés dans le code — si ce n'est plus utile, supprime-le.
- Pas de commentaires `// TODO` sans ticket associé ni date — soit c'est dans le backlog, soit c'est fait maintenant.
- Les JSDoc/TSDoc sont réservés aux interfaces publiques exposées à d'autres modules, pas aux fonctions internes.
