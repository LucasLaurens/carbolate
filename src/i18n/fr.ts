import type { Translations } from "./types";

export const fr: Translations = {
  header: "📊 Aujourd'hui",
  nav: { today: "Aujourd'hui", settings: "Paramètres" },
  noData: "Aucune donnée aujourd'hui",
  stats: {
    co2: "CO₂ estimé",
    data: "Données transférées",
    requests: "Requêtes",
    tabs: "Onglets visités",
    avoided: "évités par le cache",
  },
  chart: { title: "Top domaines par CO₂" },
  actions: { refresh: "Actualiser", export: "Export CSV" },
  sobrietyLevels: {
    sober: "Sobre",
    moderate: "Modéré",
    intensive: "Intensif",
    excessive: "Excessif",
  },
  equivalences: {
    emails: (n) => `≈ ${n} email${n > 1 ? "s" : ""}`,
    streamingMin: (n) => `≈ ${n} min streaming HD`,
    streamingH: (h) => `≈ ${h}h streaming HD`,
    car: (km) => `≈ ${km} km en voiture`,
    flight: (km) => `≈ ${km} km en avion`,
  },
  worldComparison: {
    wellBelow: "bien en dessous de la moyenne journalière",
    below: "en dessous de la moyenne journalière",
    around: "autour de la moyenne journalière",
    above: "au-dessus de la moyenne journalière",
    wellAbove: "bien au-dessus de la moyenne journalière",
  },
  settings: {
    save: "Enregistrer",
    saved: "✅ Enregistré !",
    language: "Langue",
  },
};
