# Pas de paramètres nullables

- Jamais `foo(x?: string)` quand `x` change le comportement — crée deux fonctions distinctes.
- Utilise des types union explicites plutôt que `null` / `undefined` : retourne `Result<T, E>` ou un type discriminant.
- Si une valeur peut être absente, modélise-la dans le type (`Option<T>` ou objet nul), pas par un `null` en argument.
- Constructeurs et factories reçoivent des données complètes et valides.
