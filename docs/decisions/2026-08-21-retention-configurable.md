# Rétention configurable : purge immédiate et alarme reprogrammée

**Contexte** : `retentionDays` était la source de vérité unique de la rétention depuis l'ADR
[unités et rétention](2026-08-05-unites-et-retention.md), mais personne ne pouvait la changer.
Elle valait `1` à vie, donc le storage n'a jamais contenu qu'un seul jour — ce qui bloquait les
deux vues d'historique de la V2.

Trois défauts n'étaient pas atteignables tant que la valeur était immuable, et le contrôle les
rendait atteignables tous les trois :

1. **L'alarme n'était créée que sur `onInstalled` et `onStartup`.** Un réglage changé depuis le
   panneau n'aurait pris effet qu'au prochain démarrage du navigateur : l'UI aurait affiché
   « 7 jours » pendant que l'alarme tournait encore en quotidien.
2. **La fenêtre était large d'un jour de trop.** `clearPastDays` filtrait `date >= cutoff` contre
   `today - retentionDays`, ce qui conserve le jour du seuil : « 7 jours » en stockait huit.
   Invisible tant qu'aucune vue ne comptait de jours.
3. **`autoExportBeforeReset` n'avait pas de contrôle non plus.** Même défaut, même écran.

**Décision** :

**Trois fenêtres exposées — `1`, `7`, `-1`.** `30` reste représentable sans nouveau type, mais
n'est pas offert tant que la comparaison mensuelle n'existe pas : une option qui ne sert rien est
une option à maintenir. La liste vit dans `RETENTION_OPTIONS` et les traductions sont indexées par
la valeur elle-même, donc une option ne peut pas être ajoutée sans ses deux libellés.

**La règle de coupure a un domicile unique.** `isKept(date, retentionDays, today)` remplace le
filtre enfoui dans `clearPastDays`. Elle a deux appelants qui n'ont rien d'autre en commun : le
store supprime avec, le panneau compte avec pour annoncer la perte. Le nombre annoncé et le nombre
supprimé ne peuvent plus diverger. L'écart d'un jour est corrigé au passage, en un seul endroit.

**Réduire la fenêtre purge immédiatement, après confirmation native.** « Garde 1 jour » doit
vouloir dire _maintenant_ : c'est un réglage à saveur vie-privée, et laisser sept jours en storage
pendant que l'UI en annonce un est un mensonge. Mais c'est la seule action du produit qui détruit
des données enregistrées, donc elle est la seule à demander d'abord. La confirmation nomme le
nombre exact de journées perdues, et son texte diffère selon `autoExportBeforeReset` : avec
l'export activé les jours quittent l'extension, pas le disque, et écrire « définitivement » ferait
hésiter pour rien.

`window.confirm` plutôt qu'une modale dessinée : le texte porte l'information, pas la couleur du
bouton. Une modale reste possible plus tard sans rien changer à la décision.

**Le background reste le seul à supprimer.** Le panneau ne peut pas : son store est un
`DailyRecordReader`. Il écrit la préférence ; `chrome.storage.onChanged` côté background
reprogramme l'alarme et lance le cycle de reset. Le listener filtre sur la clé `preferences` puis
sur `retentionDays` ayant réellement bougé — chaque chargement de page écrit `sessions`, et un
changement de langue écrit `preferences` ; aucun des deux ne doit atteindre un chemin destructeur.

**Un cycle qui ne supprime rien n'exporte rien.** Élargir la fenêtre change `retentionDays` et
déclenche donc le cycle, mais aucun jour ne tombe. Un « export avant suppression » qui télécharge
un CSV sans rien supprimer est un fichier que l'utilisateur n'a pas demandé. Le garde vaut aussi
pour l'alarme périodique, qui exportait jusqu'ici même les nuits sans rien à supprimer.

**Conséquences** :

- Un historique existant est déjà d'un jour trop large. Le premier déclenchement de l'alarme après
  mise à jour le ramène à la fenêtre annoncée — sans confirmation, puisque l'utilisateur n'a rien
  changé. La perte porte sur le jour le plus ancien d'une fenêtre qui n'aurait jamais dû le
  contenir.
- `runResetCycle` prend un quatrième paramètre, le jour courant. Le cycle décide désormais s'il y a
  quelque chose à supprimer, ce qu'il ne pouvait pas faire sans savoir quel jour on est.
- `SettingsView` ne garde plus de copie locale des préférences. Une copie locale afficherait la
  nouvelle fenêtre même quand la confirmation la refuse.
- La section 1 de `docs/roadmap-v2.md` est livrée ; le `reconfigureAlarm(retentionDays)` qu'elle
  proposait n'a pas été écrit — `scheduleReset` existait déjà et fait le travail.
- #15 et #14 peuvent désormais disposer de plus d'un jour en storage.
