# TODO — Support Firefox (Mozilla Add-ons)

Portage de Carbolate sur Firefox MV3, en gardant Chrome fonctionnel depuis la même base de code.

Rien n'est encore implémenté. Ordre recommandé : 1 → 7.

---

## 1. Manifests séparés par navigateur

- [ ] Renommer `public/manifest.json` → `public/manifest.chrome.json`
- [ ] Nettoyer les permissions Chrome :
  - retirer `tabs` — `sender.tab` est fourni au listener `onMessage` sans permission (`src/background/index.ts:89`)
  - retirer `scripting`, `declarativeNetRequest`, `declarativeNetRequestFeedback`, `contextMenus` — aucun usage dans `src/`
  - ajouter `downloads` — requis par `src/utils/csv.ts:50`, actuellement manquant (l'export CSV est cassé sur Chrome aussi)
  - aligner `version` sur `package.json` : `"1.0"` → `"1.0.0"`
- [ ] Créer `public/manifest.firefox.json`

```json
{
  "name": "Carbolate",
  "description": "Calculate your carbon footprint on the web.",
  "version": "1.0.0",
  "manifest_version": 3,
  "browser_specific_settings": {
    "gecko": {
      "id": "carbolate@lucaslaurens.dev",
      "strict_min_version": "115.0"
    }
  },
  "background": {
    "scripts": ["background.js"]
  },
  "content_scripts": [
    { "js": ["content.js"], "matches": ["<all_urls>"] }
  ],
  "action": {
    "default_popup": "index.html",
    "default_icon": { "16": "assets/logo.png", "48": "assets/logo.png", "128": "assets/logo.png" }
  },
  "sidebar_action": {
    "default_panel": "index.html",
    "default_title": "Carbolate",
    "default_icon": "assets/logo.png"
  },
  "icons": { "16": "assets/logo.png", "48": "assets/logo.png", "128": "assets/logo.png" },
  "permissions": ["storage", "alarms", "downloads"],
  "host_permissions": ["<all_urls>"]
}
```

Deltas Firefox vs Chrome :

| Clé Chrome | Équivalent Firefox | Raison |
|---|---|---|
| `background.service_worker` | `background.scripts` | Firefox MV3 utilise une event page, pas de service worker |
| `side_panel.default_path` | `sidebar_action.default_panel` | `side_panel` n'existe pas dans Gecko |
| permission `sidePanel` | *(supprimée)* | Permission invalide → warning à la review AMO |
| — | `browser_specific_settings.gecko.id` | **Obligatoire** pour signer sur AMO |

---

## 2. Build multi-cible (`vite.config.ts`)

Problème : `dist/background.js` contient aujourd'hui `import {...} from "./assets/constants-*.js"`. Un module ESM en background n'est pas chargeable par Firefox MV3 → extension morte au démarrage.

- [ ] Sélectionner le manifest via `process.env.BROWSER_TARGET` et le copier en `dist/manifest.json` au `closeBundle`
- [ ] Supprimer le chunk partagé pour que `background.js` et `content.js` soient autonomes

```diff
+const target = process.env.BROWSER_TARGET ?? "chrome";
+
 export default defineConfig({
-  plugins: [react(), tailwindcss()],
+  plugins: [
+    react(),
+    tailwindcss(),
+    {
+      name: "browser-manifest",
+      closeBundle() {
+        copyFileSync(`public/manifest.${target}.json`, "dist/manifest.json");
+      },
+    },
+  ],
   build: {
     rollupOptions: {
       input: {
         side_panel: "index.html",
         background: "src/background/index.ts",
         content: "src/content/index.ts",
       },
-      output: { entryFileNames: "[name].js" },
+      output: {
+        entryFileNames: "[name].js",
+        // Pas de chunk partagé : background/content doivent rester des scripts
+        // classiques, Firefox MV3 ne charge pas de module ESM en background.
+        manualChunks: undefined,
+      },
     },
```

- [ ] **Vérifier après build** : `dist/background.js` ne doit contenir aucun `import`
- [ ] Fallback si le chunk réapparaît (3 entrées partagent `src/config/constants.ts`) : un second config `vite.config.scripts.ts` avec les 2 entrées scripts en `format: "iife"`, buildé séquentiellement ; le config principal ne garde que le side panel

- [ ] Retirer `public/manifest.json` du `.gitignore`/copie automatique si Vite le copie encore en doublon

---

## 3. Scripts npm (`package.json`)

```diff
   "scripts": {
     "dev": "vite",
-    "build": "vite build",
+    "build": "BROWSER_TARGET=chrome vite build",
+    "build:firefox": "BROWSER_TARGET=firefox vite build",
+    "package:firefox": "npm run build:firefox && cd dist && zip -r ../carbolate-firefox.zip .",
+    "package:sources": "git archive --format=zip -o carbolate-sources.zip HEAD",
```

- [ ] Ajouter `carbolate-firefox.zip` et `carbolate-sources.zip` au `.gitignore` (ainsi que `carbolate.zip`, actuellement non tracké mais non ignoré)

---

## 4. Corrections de compatibilité API

Le namespace `chrome.*` en style callback est aliasé par Firefox — `ChromeStorage.ts` et les autres appels fonctionnent tels quels. Deux exceptions réelles :

- [ ] `src/utils/csv.ts:50` — révoquer le blob URL après le téléchargement (Firefox invalide l'URL à la fermeture de la page)

```diff
-  chrome.downloads.download({
-    url,
-    filename: `carbolate-export-${today}.csv`,
-  });
+  chrome.downloads.download({ url, filename: `carbolate-export-${today}.csv` }, () =>
+    URL.revokeObjectURL(url),
+  );
```

- [ ] `src/background/index.ts:29` — clamp du délai d'alarme. Firefox impose un minimum de 1 minute ; à 23h59m30 le `delayInMinutes` calculé jusqu'à minuit passe sous 1 et l'alarme est décalée silencieusement

```diff
-  chrome.alarms.create(RESET_ALARM, { delayInMinutes, periodInMinutes });
+  chrome.alarms.create(RESET_ALARM, {
+    delayInMinutes: Math.max(delayInMinutes, 1),
+    periodInMinutes,
+  });
```

- [ ] Test de régression pour le clamp (`src/background/*.test.ts`), avec un `clock` injecté à 23:59:30

---

## 5. Host permissions optionnelles — piège principal

En MV3 Firefox, `<all_urls>` n'est **pas** accordé à l'installation. Conséquence : `content.js` ne s'injecte jamais, aucune métrique n'arrive, aucune erreur visible.

- [ ] Créer `src/security/HostPermissions.ts` — interface injectable, pas d'appel `chrome.*` direct dans les composants (règle `.claude/rules/tdd.md`)

```ts
export interface HostPermissions {
  isGranted(): Promise<boolean>;
  request(): Promise<boolean>;
}
```

- [ ] Implémentation Chrome/Firefox `ChromeHostPermissions` via `chrome.permissions.contains` / `chrome.permissions.request({ origins: ["<all_urls>"] })` — `request()` doit partir d'un geste utilisateur
- [ ] Fake in-memory `InMemoryHostPermissions` pour les tests (règle no-mocks)
- [ ] Écran d'onboarding dans `src/components/popup/Popup.tsx` : si permission absente, afficher le bouton d'activation au lieu du dashboard vide
- [ ] Passer l'action par le `RateLimiter` existant (`src/security/RateLimiter.ts`) : clé `"permission-request"`
- [ ] Tests : rendu onboarding vs dashboard selon l'état de permission

---

## 6. Documentation

- [ ] `docs/decisions/2026-07-31-support-firefox.md` — ADR : deux manifests statiques plutôt qu'un manifest généré ; refus de `webextension-polyfill` ; contrainte host permissions optionnelles
- [ ] `docs/architecture.md` — section build multi-cible + contrat `HostPermissions`
- [ ] `docs/features.md` — comportement onboarding permissions
- [ ] `README.md` — instructions de build par navigateur + procédure de test local (`about:debugging` → « Charger un module temporaire »)

---

## 7. Soumission AMO

- [ ] `PRIVACY.md` à la racine — les métriques restent en `chrome.storage.local`, aucune sortie réseau. Requis par la review AMO pour une extension qui lit `<all_urls>`
- [ ] Soumettre les sources : le code est minifié par Vite → AMO exige l'archive source (`npm run package:sources`) + instructions de build reproductibles dans le README
- [ ] Renseigner le formulaire de collecte de données AMO : URLs visitées traitées localement, aucune transmission
- [ ] Valider avec `npx web-ext lint --source-dir dist` avant upload
- [ ] Tester sur Firefox ESR (`strict_min_version: 115.0`) — si le fallback IIFE de l'étape 2 n'aboutit pas, remonter à `128.0` et documenter pourquoi

---

## Non retenu

**`webextension-polyfill`** — le code n'utilise que `storage`, `alarms`, `runtime`, `action`, `downloads`, tous aliasés en `chrome.*` par Firefox en style callback. La dépendance ajouterait une couche sans corriger de bug réel.
