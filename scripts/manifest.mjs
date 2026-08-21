import { readFileSync } from "node:fs";

const ICONS = {
  16: "assets/logo.png",
  48: "assets/logo.png",
  128: "assets/logo.png",
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
    permissions: ["storage", "alarms", "downloads"],
    host_permissions: ["<all_urls>"],
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
