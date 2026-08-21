import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRIVACY_CONTACT, PRIVACY_POLICY } from "./privacy";
import type { Language } from "../i18n/types";

const LANGUAGES: Language[] = ["en", "fr"];

/**
 * The published page and this module are two representations of one policy, so a
 * test has to fail when they drift — otherwise the product and the URL the store
 * points at can end up claiming different things.
 */
const PUBLISHED_PAGE = readFileSync(
  new URL("../../docs/privacy/index.html", import.meta.url),
  "utf8",
);

const normalize = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const publishedText = normalize(PUBLISHED_PAGE);

describe("privacy policy", () => {
  it("says the same thing in both languages", () => {
    // Arrange
    const [en, fr] = LANGUAGES.map((lang) => PRIVACY_POLICY[lang]);

    // Act
    const shapes = [en, fr].map((policy) => policy.sections.map((s) => s.paragraphs.length));

    // Assert
    expect(shapes[0]).toEqual(shapes[1]);
    expect(en.sections.map((s) => s.heading)).not.toEqual(fr.sections.map((s) => s.heading));
  });

  it.each(LANGUAGES)("has no empty section in %s", (lang) => {
    // Act
    const { sections } = PRIVACY_POLICY[lang];

    // Assert
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.heading.trim()).not.toBe("");
      expect(section.paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of section.paragraphs) expect(paragraph.trim()).not.toBe("");
    }
  });

  it.each(LANGUAGES)("keeps every %s section the published page carries", (lang) => {
    // Act
    const headings = PRIVACY_POLICY[lang].sections.map((s) => normalize(s.heading));

    // Assert
    for (const heading of headings) expect(publishedText).toContain(heading);
  });

  it("gives the same contact address in the extension and on the page", () => {
    // Act
    const inPanel = LANGUAGES.map((lang) => {
      const { sections } = PRIVACY_POLICY[lang];
      return sections[sections.length - 1].paragraphs.join(" ");
    });

    // Assert
    for (const contactSection of inPanel) expect(contactSection).toContain(PRIVACY_CONTACT);
    expect(publishedText).toContain(PRIVACY_CONTACT);
  });
});
