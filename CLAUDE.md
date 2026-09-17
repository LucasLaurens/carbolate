# Carbolate — Règles techniques

## Tests

- Tout fichier de test vit dans `src/**/*.test.ts`, à côté du module testé. `test/` ne contient que le support : `setup.ts`, `fakes/`, `egress.ts`.
- Les doublures sont des implémentations réelles dans `test/fakes/`, jamais des mocks configurés.
- Effet de bord (storage, messages Chrome, API) derrière une interface injectable ; pas de `new` dans un constructeur métier — les dépendances arrivent en argument.
- Test cassé = blocage : jamais skippé ni commenté.
- Correction de bug : le test de régression est écrit **avant** le correctif.

## Types

- Jamais de paramètre optionnel qui change le comportement — deux fonctions distinctes.
- L'absence se modélise dans le type, pas par un `null` en argument. Constructeurs et factories reçoivent des données complètes et valides.
- Forme canonique d'un résultat faillible, sans `null` ni `""` comme sentinelle :

```ts
type FooResult = { valid: true; value: T } | { valid: false };
```

- Pas de `try/catch` comme flow control : guard en amont (`URL.canParse`, regex), puis construction sans exception.
- Nomme les structures métier (`DailyRecord`, pas `Record<string, any>`).
- Une transformation retourne une nouvelle structure — pas de mutation silencieuse.

## Nommage

- Une fonction est une action : son nom commence par un verbe. `formatBadgeText(total)`, pas `badgeText(total)` ; `getDailyRecord()` annonce l'aller-retour storage que `dailyRecord()` cache.
- Prendre le verbe vrai : `find/list/read` (lecture d'un store), `compute/build/format` (dérivation), `grade/classify` (palier), `resolve` (indirection), `to/convert/map` (transformation), `save/update/clear/apply/refresh` (mutation), `create/make` (construction), `is/has/can/should` (prédicat). `handle`/`process`/`manage` ne nomment rien : la fonction en fait trop.
- Restent nominaux : les composants React (`StatsGrid`) et les hooks `use…`, les champs et valeurs calculées, les entrées i18n (`t.equivalence.car(km)`), les adaptateurs qui recopient une API du navigateur (`Clock.nowMs`, `setText`), les conversions idiomatiques (`toCSV`, `bytesToMegabytes`), les noms de fichiers.
- Renommer les fonctions nominales des fichiers que le changement ouvre déjà — sites d'appel inclus, suite verte, `grep` de l'ancien nom vide. Ne pas partir à la chasse ailleurs.

## Duplication

2 duplications tolérées, la 3e réclame une abstraction. La duplication accidentelle — même forme, sémantique différente — ne se déduplique pas.

## Commentaires

- Commentaires et TSDoc en **anglais** ; `docs/`, ADR et textes destinés à l'utilisateur en français.
- TSDoc réservé aux interfaces publiques exposées à d'autres modules.
- Pas de bloc commenté, pas de `// TODO` sans ticket ni date.

## Commits

- Pas de `Co-Authored-By: Claude` ni de mention IA dans les commits, PR ou commentaires de code.
- Le message décrit l'intention ("add carbon threshold logic", pas "add if statement").

## Documentation

- La doc fait partie de « done » : fausse ou manquante = blocage.
- Nouveau module → `docs/architecture.md` ; fonctionnalité visible → `docs/features.md` ; décision non-triviale → `docs/decisions/YYYY-MM-DD-sujet.md`.
- Format ADR : `# Titre`, puis `**Contexte**` (pourquoi), `**Décision**` (quoi), `**Conséquences**` (implications).

## Sécurité — Rate limiting

Toute action UI à effet de bord (export, API, storage) passe par `RateLimiter` (`src/security/RateLimiter.ts`) ; les messages `page_metrics` en sont exclus.

```ts
if (!rateLimiter.isAllowed("csv-export")) return;
```

- Clé = nom de l'action. Un seul `RateLimiter` par contexte UI — pas un par bouton.
