# Pas de paramètres nullables

- Jamais `foo(x?: string)` quand `x` change le comportement — crée deux fonctions distinctes.
- Utilise des types union explicites plutôt que `null` / `undefined` : retourne `Result<T, E>` ou un type discriminant.
- Si une valeur peut être absente, modélise-la dans le type (`Option<T>` ou objet nul), pas par un `null` en argument.
- Constructeurs et factories reçoivent des données complètes et valides.

## Type discriminant — forme canonique

```ts
type FooResult = { valid: true; value: T } | { valid: false };
```

- Pas de `null`, pas de `""` comme sentinelle d'erreur.
- L'appelant est forcé par le compilateur à tester `valid` avant d'accéder à `value`.
- Pas de `try/catch` comme flow control : valide en amont avec un guard (`URL.canParse`, regex, etc.) puis construis le résultat sans exception.
