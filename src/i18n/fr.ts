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
  },
  chart: { title: "Top domaines par CO₂" },
  carbonLevels: {
    sobre: "Sobre",
    modere: "Modéré",
    intensif: "Intensif",
    excessif: "Excessif",
  },
  equivalences: {
    emails: (n) => `≈ ${n} email${n > 1 ? "s" : ""}`,
    streamingMin: (n) => `≈ ${n} min streaming HD`,
    streamingH: (h) => `≈ ${h}h streaming HD`,
    car: (km) => `≈ ${km} km en voiture`,
    flight: (km) => `≈ ${km} km en avion`,
  },
  worldAvg: {
    below: (pct) => `−${pct}% vs. moy. mondiale (120 g/j)`,
    above: (pct) => `+${pct}% vs. moy. mondiale (120 g/j)`,
    equal: () => `= moy. mondiale (120 g/j)`,
  },
  settings: {
    save: "Enregistrer",
    saved: "✅ Enregistré !",
    language: "Langue",
  },
};
