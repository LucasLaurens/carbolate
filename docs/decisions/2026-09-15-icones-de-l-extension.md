# Icônes de l'extension : cinq tailles committées, master hors du zip

**Contexte** : `public/assets/logo.png` pesait **1 374 270 octets** en 1024×1024, et `public/`
est copié tel quel par Vite — ce master partait donc dans **chaque** zip livré aux stores, pour
servir trois tailles (16 / 48 / 128) que le navigateur redimensionnait lui-même. Le motif
occupait par ailleurs moins de 70 % de l'image : à 16 px, il devenait illisible à cause de la
marge, pas du redimensionnement. Aucune source vectorielle n'existe.

Chromium demande 16 / 32 / 48 / 128, AMO demande 32 et 64 — union : **16, 32, 48, 64, 128**.

**Décision** :

1. **Cinq PNG committés**, un par taille, dans `public/assets/icons/`. Pas de script de
   génération : le seul redimensionneur présent sur la machine de développement est `sips`,
   macOS-only, et un script qui casse le build ailleurs coûte plus qu'il n'apporte pour cinq
   fichiers qui changent quand le logo change.
2. **Le master 1024 px sort de `public/`** et vit dans `assets/logo-master-1024.png`. Il reste
   versionné — c'est la seule source dont les tailles dérivent — mais ne voyage plus dans le
   zip livré.
3. **Recadrage sur le contenu avant réduction.** La boîte du motif mesurée contre le fond crème
   est `(178, 162)–(883, 856)` ; le carré retenu est centré dessus avec 12 % de respiration, soit
   `(136, 114)–(925, 904)`. Le motif occupe alors la surface, et la lisibilité à 16 px vient de
   là, pas du filtre de réduction.
4. **Pas de redessin ici.** Fond crème opaque et motif conservés tels quels : un redessin pensé
   pour 16 px, transparent, est une décision d'identité visuelle, pas une tâche de préparation
   à la soumission.

**Conséquences** :

- Le zip livré passe de ≈ 1,8 Mo à **443 Ko** ; les cinq icônes pèsent 26 645 octets à elles
  toutes.
- `scripts/manifest.mjs` référence les cinq tailles ; `icons` et `action.default_icon` les
  portent sur les deux moteurs.
- Le périmètre de [#37](https://github.com/LucasLaurens/carbolate/issues/37) se réduit aux
  icônes. Capture 1280×800 et tuile 440×280 se **téléversent sur les tableaux de bord** et ne
  voyagent jamais dans le zip : elles passent dans un ticket propre, dont la capture relève de
  Lucas — une capture de fiche doit montrer l'interface réelle, une maquette est un motif de
  rejet en revue.
