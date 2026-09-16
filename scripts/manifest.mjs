import { readFileSync } from "node:fs";

/**
 * The union of what both stores ask for: Chromium wants 16/32/48/128, AMO wants
 * 32 and 64. Each size is a committed file rather than one master scaled by the
 * browser — and rather than a build script, since the only resizer on this
 * machine (`sips`) is macOS-only and would break the build everywhere else.
 *
 * The 1024px master lives in `assets/`, outside `public/`: Vite copies `public/`
 * verbatim, so a master left there shipped 1.3 MB inside every zip.
 */
const ICONS = {
  16: "assets/icons/icon-16.png",
  32: "assets/icons/icon-32.png",
  48: "assets/icons/icon-48.png",
  64: "assets/icons/icon-64.png",
  128: "assets/icons/icon-128.png",
};

const GECKO_ID = "carbolate@lucaslaurens.dev";
const GECKO_MIN_VERSION = "115.0";

const PANEL_PATH = "index.html";
const PANEL_TITLE = "Carbolate";

function sharedManifest(version) {
  return {
    name: "Carbolate",
    description: "Estimate the carbon footprint of your browsing.",
    version,
    manifest_version: 3,
    action: {
      default_popup: PANEL_PATH,
      default_title: PANEL_TITLE,
      default_icon: ICONS,
    },
    content_scripts: [
      {
        js: ["content.js"],
        matches: ["<all_urls>"],
        run_at: "document_idle",
      },
    ],
    icons: ICONS,
    /**
     * No `host_permissions`. Injecting the declared content script needs only
     * `content_scripts.matches`; host permissions would additionally grant
     * cross-origin `fetch`, cookies, and the sensitive tab fields — none of
     * which this extension uses. The background reads `sender.url`, which is the
     * sending frame and costs no permission, precisely so `sender.tab.url`
     * (which Firefox withholds without host access) is never needed.
     *
     * `unlimitedStorage` lifts the 10 MB cap on `storage.local`. The panel offers
     * a "keep everything" retention window, and without this that promise ended
     * at a rejected write. Neither store shows the user a warning for it, and it
     * grants no access to anything — only room for what is already local.
     */
    permissions: ["storage", "unlimitedStorage", "alarms", "downloads"],
  };
}

// Chromium (Chrome, Edge, Opera, Brave, Vivaldi): background is a service
// worker and the docked panel is exposed through the `sidePanel` API.
function chromiumManifest(version) {
  const shared = sharedManifest(version);
  return {
    ...shared,
    background: { service_worker: "background.js" },
    side_panel: { default_path: PANEL_PATH },
    permissions: [...shared.permissions, "sidePanel"],
  };
}

// Gecko (Firefox): MV3 background is a non-persistent event page, the panel is
// a `sidebar_action`, and AMO refuses to sign without an explicit gecko id.
function geckoManifest(version) {
  return {
    ...sharedManifest(version),
    browser_specific_settings: {
      gecko: { id: GECKO_ID, strict_min_version: GECKO_MIN_VERSION },
    },
    background: { scripts: ["background.js"] },
    sidebar_action: {
      default_panel: PANEL_PATH,
      default_title: PANEL_TITLE,
      default_icon: ICONS,
    },
  };
}

const BUILDERS = {
  chrome: chromiumManifest,
  firefox: geckoManifest,
};

export const TARGETS = Object.keys(BUILDERS);

export function manifestFor(target) {
  const build = BUILDERS[target];
  if (!build)
    throw new Error(`Unknown browser target "${target}". Expected: ${TARGETS.join(", ")}`);

  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  return build(version);
}
