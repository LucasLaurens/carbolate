# Octets en base 10, rétention à source unique

**État** : la partie **unités** est implémentée — conversions centralisées dans `src/utils/bytes.ts`, adaptateur unique `src/carbon/toCarbonInput.ts`, règle encodée par `src/utils/bytes.test.ts`. Le renommage `SessionsStore` → `DailyRecordsStore` est fait, la clé de storage reste `"sessions"` derrière `StorageKey.SESSIONS`. La partie **rétention** reste décidée mais non implémentée : `ResetPeriod` existe encore, et la période d'alarme est toujours configurée à côté de `retentionDays` au lieu de s'en déduire.

**Contexte** : deux doublons de connaissance, sans lien entre eux sinon qu'ils portent tous deux sur des contrats de données.

**Unités.** Trois conventions coexistaient pour une seule grandeur. `background/index.ts` divisait `totalTransferSize` par `1024²` et stockait le résultat dans un champ décrit comme des MB. `toCarbonInput()` remultipliait par `1024²` pour revenir aux octets. `NetworkCarbonSource` divisait ensuite par `10⁹` pour obtenir des GB. L'aller-retour se compensant, le CO₂ calculé était juste — mais la valeur **affichée** était des MiB étiquetés MB, soit 4,9 % d'écart avec le libellé.

**Rétention.** `Preferences` portait `resetPeriod: "daily" | "weekly"` **et** `retentionDays: number`. Deux champs pour une seule connaissance : la paire `{ resetPeriod: "weekly", retentionDays: 1 }` était représentable et incohérente. `retentionDays: -1` (tout conserver) n'avait aucun `ResetPeriod` correspondant, et la comparaison mensuelle prévue en V2 aurait demandé un troisième cas d'enum en plus d'une nouvelle valeur numérique.

**Décision** :

**Base 10 partout** — `1 MB = 10⁶ octets`, `1 GB = 10⁹ octets`. C'est la convention de toutes les sources carbone publiées : les facteurs en `kWh/GB` sont en base 10, et `CARBON_PER_GB` en dépend. Les unités base 2 (MiB, GiB) ne sont utilisées nulle part — ni code, ni UI, ni doc.

**`retentionDays` seule source de vérité** — `ResetPeriod` est supprimé. La période de l'alarme de reset se **dérive** de `retentionDays`, elle n'est plus configurée à côté. N'importe quelle fenêtre devient représentable — `1`, `7`, `30`, `60`, `-1` — sans nouveau cas d'enum, ce qui débloque la comparaison mensuelle de la roadmap V2 sans changement de type.

**Sur le mot « session »** : la clé de storage `"sessions"` contient des enregistrements journaliers, pas des sessions de navigation — le mot désigne autre chose pour n'importe quel développeur web. Le type devient `DailyRecordsStore`. La **clé** reste `"sessions"` : la renommer casserait les données des installations existantes pour un gain purement cosmétique. Le glossaire porte l'écart entre la clé et son contenu, plutôt que de le laisser se transmettre par lecture du code.

**Conséquences** :

- Les valeurs déjà stockées sont des MiB. Après le passage en base 10, un historique existant est surestimé de 4,9 % dans son affichage. Négligeable au regard de l'incertitude du modèle, mais à ne pas présenter comme une correction rétroactive : seules les nouvelles mesures sont justes.
- Supprimer `resetPeriod` change la forme de `Preferences`. `ChromeStorage.getPreferences()` fusionne déjà avec `DEFAULT_PREFERENCES` : un champ résiduel en storage est ignoré sans migration.
- La roadmap V2 mentionne `exportToCSV(records, mode: ResetPeriod)`. Cette signature devient caduque — l'export se filtre sur `retentionDays`.
- `docs/roadmap-v2.md` décrit `reconfigureAlarm(period: ResetPeriod)`. À réécrire au moment de l'implémentation, sinon la roadmap contredit ce fichier.
- Un test doit échouer si une conversion base 2 réapparaît sur un champ d'octets : c'est le défaut qui vient d'être corrigé, et rien n'empêche mécaniquement de le réintroduire.
