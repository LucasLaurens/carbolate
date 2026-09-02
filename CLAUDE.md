# Carbolate — Règles techniques

@.claude/rules/solid.md
@.claude/rules/patterns.md
@.claude/rules/dry.md
@.claude/rules/algorithms.md
@.claude/rules/types.md
@.claude/rules/naming.md
@.claude/rules/tdd.md
@.claude/rules/comments.md
@.claude/rules/commits.md

## Tests

- Tests dans `src/**/*.test.ts` — même dossier que le module testé.
- `npm test` (Vitest) doit passer avant et après chaque modification.
- Un test cassé bloque — jamais ignoré ni commenté.
- Tout nouveau comportement → test en même temps que le code.
- Bug corrigé → test de régression avant la correction.

## Documentation

Le dossier `docs/` contient la doc vivante : `architecture.md` (flux, modules, décisions structurantes), `features.md` (fonctionnalités, comportements), `decisions/` (ADR — une décision = un fichier).

La doc fait partie de la définition de "done" — si elle est fausse ou manquante, c'est un blocage.

Quand mettre à jour : nouveau module → `architecture.md` ; nouvelle fonctionnalité visible → `features.md` ; décision non-triviale → `decisions/YYYY-MM-DD-sujet.md`.

Ce qu'on documente : le **pourquoi** des choix, les **contrats** entre modules, les **comportements** fonctionnels.

Format ADR (`decisions/YYYY-MM-DD-sujet.md`) :

    # Titre
    **Contexte** : pourquoi
    **Décision** : quoi
    **Conséquences** : implications

## Sécurité — Rate limiting

Les messages `page_metrics` ne sont pas limités.

Tout bouton ou action UI produisant un effet de bord (export, API, storage) doit passer par `RateLimiter` (`src/security/RateLimiter.ts`) :

```ts
if (!rateLimiter.isAllowed("nom-action")) return;
```

- Clé = nom de l'action (`"csv-export"`, `"refresh"`, …)
- Limite : 10 appels / 60 s, throttle quadratique au-delà
- Un seul `RateLimiter` par contexte UI — pas un par bouton
