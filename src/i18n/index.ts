import { en } from "./en";
import { fr } from "./fr";
import type { Language, Translations } from "./types";

const TRANSLATIONS: Record<Language, Translations> = { en, fr };

export function getTranslations(lang: Language): Translations {
  return TRANSLATIONS[lang];
}

export { en, fr };
export type {
  Language,
  Translations,
  EquivalenceTranslations,
  WorldComparisonTranslations,
} from "./types";
