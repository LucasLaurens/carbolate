# Badge de l'icône : le total du jour, noté par la couleur de sobriété

**Contexte** : le background écrivait `setBadgeText({ text: "BETA" })` dans `onInstalled`, et nulle part ailleurs. Le badge ne bougeait donc plus jamais après l'installation, et il ne disait rien de la navigation.

L'issue #16 avait demandé « Degré d'empreinte (e.g. vert, jaune, rouge) », puis a été fermée sans commentaire : la décision n'avait pas été prise, elle avait été perdue.

Deux contraintes de forme cadrent le problème. Un badge tient environ **quatre caractères** — `133.0g` n'y rentre pas, unité comprise. Et le background s'endort (service worker sur Chromium, event page sur Gecko), donc un badge écrit une seule fois ne survit pas ; l'état du badge ne survit pas non plus à un redémarrage du navigateur.

Un prototype jetable a rendu les quatre formes candidates à taille réelle 16 px, en clair et en sombre, avec simulation de deutéranopie. Il a éliminé deux options par la mesure, pas par le goût :

- **couleur seule** : sous deutéranopie, `moderate`, `intensive` et `excessive` fusionnent en un vert-jaune identique — trois niveaux sur quatre deviennent indistinguables, et seul `sober` se détache ;
- **médailles** (`🥇🥈🥉⛔`) : illisibles à 16 px, `⛔` se réduisant à une barre blanche.

**Décision** :

- Le badge porte **la couleur de sobriété et le total du jour en grammes**. La couleur porte le jugement, le chiffre porte l'information — donc la couleur n'est jamais le seul canal, et l'objection accessibilité tombe.
- Format, en quatre caractères au plus : `–` gris à exactement zéro, `<1` sous le gramme, l'entier arrondi jusqu'à 1 000, `1.2k` au-delà, puis `12k` là où la décimale déborderait.
- `–` gris à zéro plutôt que `0` vert : `0` en vert serait une note « sobre » sur une **absence de données**, exactement ce que `getWorldComparisonLabel` refuse déjà de faire dans le panneau. Un badge sans texte, lui, ne s'affiche pas du tout et se lirait « l'extension ne marche pas ».
- Peinture dans la famille Tailwind **700**, pas 500. Le badge est le seul endroit où un fond plein porte du texte blanc : blanc sur `#eab308` (yellow-500) donne 2,0:1. Les 700 passent WCAG AA avec la couleur de texte laissée au défaut de chaque moteur — donc aucun appel à `setBadgeTextColor`, et aucune divergence Chromium/Gecko possible. Prix assumé : `#a16207` tire vers le brun.
- **Infobulle dynamique** via `setTitle` : `Carbolate — 133 g aujourd'hui · Modéré`. C'est le seul endroit où l'unité et le mot du niveau apparaissent, et le seul canal qu'un lecteur d'écran atteint — il ne voit ni la couleur ni les quatre caractères.
- Le badge note **toujours le jour courant**. Les paliers dérivent d'une ancre journalière (120 g/jour) ; les appliquer à une fenêtre de sept jours ferait retomber tout total en `excessive`. La rétention dit combien d'historique on garde, pas quelle fenêtre on note — les confondre serait une erreur de modèle.
- Le badge est réécrit à **trois moments** : après chaque mesure, au démarrage (`onInstalled` / `onStartup`), et après l'alarme de reset. Un changement de langue le réécrit aussi, l'infobulle étant traduite.
- **Quelle couleur porte un niveau** remonte au modèle (`SOBRIETY_COLOR`, à côté de `sobrietyLevel`). Chaque média mixe ensuite ce nom à sa façon : classes Tailwind dans le panneau, hex dans le badge.
- `"BETA"` disparaît du code. Il ne disait rien à qui a déjà installé l'extension ; la mention appartient à la fiche store. Le retrait de BETA à la soumission reste une question distincte.

**Conséquences** :

- Le contraste est **encodé, pas documenté** : `badge.test.ts` calcule la luminance WCAG de chaque hex peint et échoue sous 4,5:1. Vérifié en cassant volontairement la palette — la famille 500 fait tomber le test à 2,28:1.
- Le badge peut désormais afficher un chiffre là où le panneau affiche `133.42` : deux arrondis, une seule source. Le total vient du même `totalCarbon.totalCo2`, donc ils ne peuvent pas diverger, seulement s'exprimer avec des précisions différentes.
- Le panneau ne nomme plus les couleurs des niveaux ; il ne garde que ses médailles et son mixage Tailwind. `StatColor` devient `SobrietyColor | "blue"`, `"blue"` étant la seule teinte que le panneau porte pour ses propres statistiques.
- Une mesure coûte maintenant une lecture de préférences en plus (pour la langue de l'infobulle), sur `chrome.storage.local`.
- Oublier le reset laisserait `1.2k` rouge affiché sur un jour vide — c'est le bug le plus visible possible, d'où le réveil du badge sur les trois chemins et non sur le seul chemin de mesure.
