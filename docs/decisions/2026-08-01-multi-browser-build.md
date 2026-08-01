# Build multi-navigateur : manifest généré et bundles iife

**Contexte** : l'extension ne ciblait que Chrome. Le manifest était un fichier statique (`public/manifest.json`) copié tel quel, et le build Vite mono-passe hoistait le code partagé entre le panneau et le background dans `dist/assets/constants-*.js`. `dist/background.js` contenait donc un `import` ESM — chargeable par un service worker Chrome déclaré `type: "module"`, mais fatal pour une event page MV3 Firefox, qui est un script classique. Publier sur AMO exigeait en plus des clés absentes du manifest Chrome (`browser_specific_settings.gecko.id`, `sidebar_action`) et l'absence de clés invalides (`side_panel`, permission `sidePanel`).

Trois options : (1) deux manifests JSON statiques, (2) un manifest généré depuis une base commune, (3) `webextension-polyfill` + manifest unique. La (3) ne résout rien : les deltas de manifest ne sont pas polyfillables, et le namespace `chrome.*` en style callback est déjà aliasé par Firefox.

**Décision** :

- `scripts/manifest.mjs` génère le manifest depuis une base partagée + un builder par moteur (`chrome`, `firefox`). La version vient de `package.json` — plus de dérive possible entre les deux.
- `scripts/build.mjs` enchaîne trois builds Vite : le panneau (ESM, depuis `index.html`), puis `background` et `content` **séparément** en mode library `formats: ["iife"]`. Un build par entrée est la seule façon de garantir zéro chunk partagé, donc zéro `import`.
- `vite.config.ts` ne garde que les plugins (React, Tailwind) pour `npm run dev` ; toute la config de build vit dans `scripts/build.mjs`.
- Permissions réduites au réel : `storage`, `alarms`, `downloads` (+ `sidePanel` sur Chromium). `tabs`, `scripting`, `declarativeNetRequest*` et `contextMenus` n'étaient appelés nulle part.
- Le background lit l'URL de la page depuis `sender.url` plutôt que `sender.tab.url` : Firefox MV3 traite les host permissions comme optionnelles, `sender.tab.url` y est donc `undefined` tant que l'accès n'est pas accordé — le garde-fou aurait jeté toutes les métriques.

**Conséquences** :

- `public/manifest.json` est supprimé ; `dist/manifest.json` est un artefact de build. Toute modification de manifest passe par `scripts/manifest.mjs`.
- Le build Chromium sert aussi Edge, Opera, Brave et Vivaldi. Safari reste hors périmètre : conversion `xcrun safari-web-extension-converter` + compte développeur Apple.
- `npm run build` cible Chromium par défaut, `npm run build:firefox` Gecko. Les deux écrivent dans le même `dist/` — un build écrase l'autre, il faut packager avant de changer de cible (`npm run package:all` le fait dans le bon ordre).
- L'export CSV, cassé sur Chrome aussi (permission `downloads` manquante), fonctionne désormais partout.
- Contrainte à respecter : `dist/background.js` et `dist/content.js` ne doivent contenir aucun `import`. La CI le vérifie après chaque build.
