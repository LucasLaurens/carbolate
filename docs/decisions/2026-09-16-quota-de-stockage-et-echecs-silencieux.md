# Un écrit refusé doit s'entendre, et « tout garder » doit tenir

**Contexte** : l'audit de sécurité a relevé que `chrome.storage.local` n'a aucune marge ni
aucun filet ici.

Le plafond d'abord. `storage.local` s'arrête à 10 Mo sans `unlimitedStorage`. Le panneau
offre pourtant une rétention « tout garder », et une visite pèse quelques centaines
d'octets : quelques mois de navigation conservée suffisent à atteindre le mur. L'option
promettait donc quelque chose que le stockage ne pouvait pas honorer.

Le silence ensuite, et c'est le vrai défaut. Chaque écouteur du background était un
`async` dont personne n'attend la promesse : le navigateur ignore ce que rend un listener,
donc un rejet devenait une promesse non gérée et le travail n'avait simplement pas lieu.
`storage.local` rejette précisément au moment où le stockage est plein — l'instant où
perdre l'information sans bruit est le plus coûteux. Le défaut ne touchait pas seulement le
chemin d'enregistrement relevé par l'audit : `onInstalled`, `onStartup`, l'alarme de reset
et `storage.onChanged` partageaient la même absence de sortie d'erreur.

**Décision** :

- `unlimitedStorage` est demandé. Il lève le plafond sans donner accès à quoi que ce soit,
  et ni Chrome ni Firefox ne l'affichent comme un avertissement à l'utilisateur.
- Un `runInBackground(what, task)` unique porte le chemin d'échec des cinq écouteurs. Il
  journalise et s'arrête là : il n'y a pas de surface utilisateur à alerter dans un
  service worker, et chaque appelant est déjà réessayé par le chargement de page ou
  l'alarme suivante.
- `QuotaLimitedDailyRecordsStorage` rejoint les doublures de test : un vrai stockage avec
  un vrai plafond en octets, qui refuse ce qui ne rentre pas. Pas un drapeau à lever — on
  atteint la limite en écrivant trop, comme en production.

**Conséquences** :

- Deux invariants sont désormais encodés : un refus d'écriture remonte à son appelant, et
  la file d'écriture continue de servir après un refus. Le second a été vérifié en cassant
  volontairement le double `catch` de `enqueue` — un seul test, et il tombe.
- Le stockage reste borné par la rétention choisie, pas par le navigateur. « Tout garder »
  veut dire ce qu'il dit, et la seule limite qui reste est le disque.
- Le coût par écriture ne change pas : `upsertVisit` scanne les visites du jour et chaque
  écriture re-sérialise tout le store. Acceptable au défaut d'un jour, noté dans le code
  comme le plafond à lever si « tout garder » rend une écriture lente.
- La politique de confidentialité liste la nouvelle autorisation, dans les deux langues et
  sur la page publiée.
