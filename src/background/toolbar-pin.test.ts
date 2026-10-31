import { describe, expect, it } from "vitest";

/**
 * Firefox MV3 files the `action` button under the Extensions menu, where the
 * day's badge is never seen; the sidebar icon cannot carry a badge at all.
 * Pinning the button at install is what makes the badge reach the toolbar.
 */
const MANIFEST_MODULE = new URL("../../scripts/manifest.mjs", import.meta.url).href;

const TOOLBAR_AREA = "navbar";

type Manifest = { action: { default_area?: string } };

type ManifestModule = { manifestFor: (target: string) => Manifest };

async function buildManifest(target: string): Promise<Manifest> {
  const { manifestFor } = (await import(MANIFEST_MODULE)) as ManifestModule;
  return manifestFor(target);
}

describe("Toolbar pin of the action button", () => {
  it("pins the Firefox button to the toolbar so its badge is visible", async () => {
    // Act
    const manifest = await buildManifest("firefox");

    // Assert
    expect(manifest.action.default_area).toBe(TOOLBAR_AREA);
  });

  it("keeps the Firefox-only key out of the Chromium manifest", async () => {
    // Act
    const manifest = await buildManifest("chrome");

    // Assert
    expect(manifest.action).not.toHaveProperty("default_area");
  });
});
