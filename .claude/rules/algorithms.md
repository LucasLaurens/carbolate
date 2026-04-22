# Structures de données & Algorithmes

- Choisis la structure adaptée : `Map` pour lookups O(1), `Set` pour l'unicité, tableaux pour les séquences ordonnées.
- Évite les O(n²) implicites : pas de `.find()` dans une boucle — utilise un index.
- Nomme les structures métier explicitement (`DailyRecord`, pas `Record<string, any>`).
- Pas de mutation silencieuse : les fonctions qui transforment des données retournent de nouvelles structures.
