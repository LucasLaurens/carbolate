import { describe, expect, it } from "vitest";
import { en, fr } from "./index";
import type { Translations } from "./types";

const EMOJI = /\p{Extended_Pictographic}/u;
const EM_DASH = "—";

/**
 * The toolbar tooltip keeps the "Carbolate — …" separator its ADR fixed
 * (docs/decisions/2026-08-21-badge-icone.md); every other string is panel copy.
 */
const EM_DASH_EXEMPT = new Set(["badge.tooltip", "badge.tooltipEmpty"]);

type RenderedString = { path: string; text: string };

/**
 * Every string a translation can render, parameterised entries called with sample
 * arguments. O(n) time and space, n = entries.
 */
function listRenderedStrings(node: unknown, path = ""): RenderedString[] {
  if (typeof node === "string") return [{ path, text: node }];
  if (typeof node === "function") return [{ path, text: String(node(2, 3)) }];
  if (typeof node !== "object" || node === null) return [];
  return Object.entries(node).flatMap(([key, child]) =>
    listRenderedStrings(child, path === "" ? key : `${path}.${key}`),
  );
}

describe.each<[string, Translations]>([
  ["en", en],
  ["fr", fr],
])("%s panel copy", (_, translations) => {
  const strings = listRenderedStrings(translations);

  it("carries no emoji: the word already says it, and the panel has no icon pack", () => {
    // Act
    const offenders = strings.filter(({ text }) => EMOJI.test(text));

    // Assert
    expect(offenders).toEqual([]);
  });

  it("uses no em-dash outside the toolbar tooltip", () => {
    // Act
    const offenders = strings.filter(
      ({ path, text }) => text.includes(EM_DASH) && !EM_DASH_EXEMPT.has(path),
    );

    // Assert
    expect(offenders).toEqual([]);
  });
});
