# Politique de confidentialité — un onglet dans le produit, l'URL publique reportée

**Contexte** : le Chrome Web Store exige une politique de confidentialité dès qu'une extension
manipule des données utilisateur, et son champ _Privacy policy_ attend un **lien** — « Add a
link to the privacy policy for your extension ». Carbolate enregistre l'URL complète de chaque
page visitée : il manipule bien des données utilisateur. Les program policies exigent en plus
que la divulgation apparaisse **dans l'interface** de l'extension, une politique atteignable
seulement depuis la fiche store ne suffisant pas.

Le texte existait déjà, bilingue, dans `docs/privacy/index.html`. Le dépôt est privé et doit le
rester, or GitHub Pages depuis un dépôt privé demande un plan payant — l'hébergement n'était donc
pas acquis. Les options pesées : un dépôt public minuscule dont le README est la politique, un
hébergeur statique gratuit, un domaine acheté. `lucaslaurens.dev` et `carbolate.dev` ne résolvent
pas : l'identifiant gecko `carbolate@lucaslaurens.dev` est une chaîne namespacée, pas un domaine
possédé.

**Décision** : livrer d'abord la moitié qui vit dans le produit, reporter l'hébergement.

- Un onglet dédié « Privacy » / « Vie privée » rend la politique dans la langue active, une
  section par `<details>` replié — ce que Chrome exige dans l'UI, et ce qu'un panneau de 320 px
  peut porter sans noyer le reste.
- `src/legal/privacy.ts` devient le domicile unique du texte. `docs/privacy/index.html` en reste
  la version longue destinée à l'URL publique, et `src/legal/privacy.test.ts` échoue si les deux
  divergent — le test a mordu dès sa première exécution, le panneau disant « How to erase
  everything » là où la page disait « How to erase it ».
- Le contact est `lucas.laurens@proton.me`, en pied de panneau sur tous les onglets et dans la
  section Contact des deux surfaces. La page renvoyait auparavant vers « l'adresse du
  développeur affichée par les fiches store », ce qui n'est pas un contact.
- La politique nomme les API de sortie réseau de façon lâche — « ni XHR, ni socket, ni beacon ».
  `test/no-network-egress.test.ts` scanne `src/` à la recherche de ces identifiants et ne
  distingue pas la prose d'un appel : écrire `XMLHttpRequest` en clair dans le produit ferait
  échouer le test que cette politique sert précisément à garantir. La page publiée, hors du
  scan, garde les noms complets.

**Conséquences** :

- **La soumission Chrome reste bloquée** jusqu'à ce que la page réponde à une URL publique. Ce
  n'est pas le code qui bloque, c'est un champ de formulaire. AMO acceptant du texte collé,
  Firefox peut partir avec ce qui existe aujourd'hui.
- L'hébergement redevient un ticket à part, prérequis de la soumission plutôt que du produit.
- Un troisième onglet occupe la barre de navigation : trois libellés à 96 px tiennent sur une
  ligne dans les deux langues, mesuré, mais un quatrième demandera de revoir la barre.
- Tout ajout de sortie réseau devra faire bouger trois choses ensemble : le code, la politique
  dans `src/legal/`, et la page publiée. Les tests refusent que l'une avance seule.
