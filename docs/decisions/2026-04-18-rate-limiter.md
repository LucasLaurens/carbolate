# Rate limiting on UI actions

**Contexte** : les boutons d'export CSV et de rafraîchissement déclenchent des écritures storage ou des appels `chrome.downloads`. Sans garde, un clic répété rapide ou un script malveillant injecté pouvait saturer le storage ou générer des dizaines de fichiers en quelques secondes.

**Décision** : introduire un `RateLimiter` centralisé (`src/security/RateLimiter.ts`) à instancier une fois par contexte UI. Chaque action side-effecting appelle `isAllowed(key)` avant d'exécuter son effet. La limite est 10 appels / 60 s avec throttle quadratique sur les excès.

Les messages `page_metrics` du content script sont volontairement exclus : chaque chargement de page est une donnée légitime, même en cas de rechargement rapide.

**Conséquences** : tout nouveau bouton ou action side-effecting doit passer par `RateLimiter.isAllowed()` — c'est une contrainte de sécurité, pas une optimisation. Le module est pur et injectable, ce qui permet des tests unitaires sans mock.
