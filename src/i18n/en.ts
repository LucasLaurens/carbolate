import type { Translations } from "./types";

export const en: Translations = {
  header: "📊 Today",
  nav: { today: "Today", settings: "Settings" },
  noData: "No data for today",
  stats: {
    co2: "Estimated CO₂",
    data: "Data transferred",
    requests: "Requests",
    tabs: "Tabs visited",
  },
  chart: { title: "Top domains by CO₂" },
  carbonLevels: {
    sobre: "Sober",
    modere: "Moderate",
    intensif: "Intensive",
    excessif: "Excessive",
  },
  equivalences: {
    emails: (n) => `≈ ${n} email${n > 1 ? "s" : ""}`,
    streamingMin: (n) => `≈ ${n} min HD streaming`,
    streamingH: (h) => `≈ ${h}h HD streaming`,
    flight: (km) => `≈ ${km} km by plane`,
  },
  settings: {
    save: "Save",
    saved: "✅ Saved!",
    language: "Language",
  },
};
