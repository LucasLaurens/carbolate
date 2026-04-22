# TDD Friendly

- Code testable sans modifications : pas de dépendances statiques, pas de `new` dans les constructeurs métier.
- Les effets de bord (storage, messages Chrome, API) sont derrière des interfaces injectables.
- Chaque comportement métier est exprimable comme un test unitaire pur (entrée → sortie), sans mock du DOM ni de Chrome.
- Un test qui dépend de l'ordre d'exécution ou de l'état global est un signal d'architecture, pas un cas à contourner.
