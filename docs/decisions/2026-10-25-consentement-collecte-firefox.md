# Firefox : déclarer l'absence de collecte, et exiger Firefox 140

**Contexte** : depuis le 3 novembre 2025, AMO refuse toute **nouvelle** extension dont le
manifest ne déclare pas ce qu'elle collecte, dans
`browser_specific_settings.gecko.data_collection_permissions`. Carbolate n'a jamais été publié
sur AMO : la V2 y entre comme nouvelle extension, la règle s'applique donc. Firefox ne lit
cette clé qu'à partir de la version 140 ; avant, il la signale comme inconnue et attend de
l'extension qu'elle affiche son propre écran de consentement. Le manifest visait jusqu'ici
`strict_min_version: "115.0"`.

Trois options : (1) déclarer et garder 115, en laissant les versions 115 à 139 avec un
avertissement de manifest et sans écran de consentement ; (2) déclarer et exiger 140 ;
(3) construire un écran de consentement maison pour les anciennes versions.

**Décision** :

- `data_collection_permissions: { required: ["none"] }` : « collecter », pour Mozilla, c'est
  transmettre hors du navigateur, et Carbolate ne transmet rien — c'est ce que tient
  `src/security/no-network-egress.test.ts`. Les visites restent dans `storage.local`.
- `strict_min_version: "140.0"`, la version ESR en cours. L'option (3) coûterait un écran
  pour annoncer qu'il n'y a rien à consentir ; l'option (1) livrerait sciemment un manifest
  que les versions visées signalent comme invalide.
- `src/legal/firefox-data-consent.test.ts` tient le manifest Gecko généré à ces deux valeurs,
  et vérifie que le manifest Chromium n'en porte aucune.
- La version passe à `2.0.0` : c'est la V2 publiée sur les deux stores, et le Chrome Web Store
  exige une version supérieure à celle en ligne.

**Conséquences** :

- Firefox ESR 115 ne peut plus installer Carbolate. Son support étendu était réservé aux
  systèmes que Firefox 140 n'accepte plus (Windows 7, anciens macOS).
- Une fois déclarée, la clé doit figurer dans toutes les versions suivantes. Si Carbolate
  envoie un jour quelque chose hors de l'appareil, elle devra le nommer, et la politique de
  confidentialité changer avec elle.
- La règle `modulePreload` de l'ADR anti-egress, justifiée par « Firefox depuis la 115 »,
  reste vraie a fortiori.
