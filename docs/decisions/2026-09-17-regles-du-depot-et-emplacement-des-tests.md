# Règles du dépôt : un seul fichier, et des tests tous colocalisés

**Contexte** : `CLAUDE.md` faisait 50 lignes et importait 9 fichiers `.claude/rules/`,
soit 184 lignes au total. Trois défauts s'y étaient installés.

1. **Des règles déductibles du dépôt.** « `npm test` doit passer » redit
   `package.json` ; « le dossier `docs/` contient `architecture.md`, `features.md`,
   `decisions/` » redit `ls docs/` ; « limite : 10 appels / 60 s, throttle
   quadratique » recopie `MAX_ATTEMPTS`, `WINDOW_MS` et `excess ** 2` de
   `src/security/RateLimiter.ts`, où la prose finira par dériver du code.
2. **Une règle fausse.** « Tests dans `src/**/*.test.ts` — même dossier que le
   module testé » était démentie par 8 fichiers de test vivant dans `test/`.
3. **Deux représentations des mêmes règles.** `solid.md`, `patterns.md`, `dry.md`
   et l'essentiel de `naming.md` redisaient la configuration globale de l'auteur.
   Deux copies d'une règle, c'est la règle qui dérive.

**Décision** :

- **La règle gagne contre le dépôt** : les 8 fichiers de test de `test/` rejoignent
  le module qu'ils couvrent. `test/` ne garde que ce qui n'est pas un test —
  `setup.ts`, `fakes/`, `egress.ts`.

  | Avant                                              | Après                                                    |
  | -------------------------------------------------- | -------------------------------------------------------- |
  | `test/carbon-calculation.test.ts`                  | `src/carbon/carbon-calculation.test.ts`                  |
  | `test/browsing-session-carbon.integration.test.ts` | `src/carbon/browsing-session-carbon.integration.test.ts` |
  | `test/wizard-seed.integration.test.ts`             | `src/config/wizard-seed.integration.test.ts`             |
  | `test/no-network-egress.test.ts`                   | `src/security/no-network-egress.test.ts`                 |
  | `test/rate-limiter.test.ts`                        | `src/security/rate-limiter.test.ts`                      |
  | `test/session-store.integration.test.ts`           | `src/session/session-store.integration.test.ts`          |
  | `test/chrome-storage.integration.test.ts`          | `src/storage/chrome-storage.integration.test.ts`         |
  | `test/csv-export.integration.test.ts`              | `src/utils/csv-export.integration.test.ts`               |

- **Un seul fichier de règles.** `.claude/rules/` disparaît ; ce qui est propre à
  ce dépôt est fondu dans `CLAUDE.md` : la forme canonique `{ valid: true; value }`,
  les exemptions de nommage côté TypeScript et React, l'interdit
  `Co-Authored-By`, le contrat du `RateLimiter`. Ce qui n'était qu'une
  reformulation générique (SOLID, catalogue de patterns) est supprimé.
- **Les commentaires de code sont en anglais**, `docs/`, les ADR et les textes
  affichés à l'utilisateur restent en français. La règle n'était écrite nulle part
  et le dépôt mélangeait les deux.
- **La règle de trois l'emporte** : 2 duplications tolérées, la 3e réclame une
  abstraction. La configuration globale de l'auteur dit « extraire à la deuxième » ;
  le dépôt tranche pour la troisième, et c'est `CLAUDE.md` qui fait foi ici.

**Conséquences** :

- 184 lignes de règles → 63, dans un fichier unique. Ce qui reste est un interdit,
  un nom exact, un chemin, ou une erreur déjà payée.
- Le scan anti-egress de `src/` ignore déjà les fichiers `.test.` (`skip: isTestFile`) :
  les tests déplacés, dont certains contiennent des adresses de fixture, ne le font
  pas échouer. La garde reste entière.
- Les ADR antérieures citent les anciens chemins `test/…` : ce sont des documents
  datés, ils ne sont pas réécrits. Seuls les liens vers `.claude/rules/*.md`, devenus
  morts, pointent désormais vers `CLAUDE.md`.
- Suite verte avant et après : 28 fichiers, 297 tests.
