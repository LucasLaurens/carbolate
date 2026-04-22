# SOLID

- **S** — Une classe/fonction = une responsabilité. Si tu dois écrire "et" pour la décrire, découpe-la.
- **O** — Étends par composition ou nouveaux types, pas en modifiant l'existant. Préfère les stratégies pluggables.
- **L** — Un sous-type remplace son parent sans changer le comportement observable. Pas d'override qui lève des exceptions inattendues.
- **I** — Interfaces petites et focalisées. Si elle n'est que partiellement implémentée, découpe-la.
- **D** — Les modules haut niveau dépendent d'abstractions. Injecte les dépendances, ne les instancie pas à l'intérieur.
