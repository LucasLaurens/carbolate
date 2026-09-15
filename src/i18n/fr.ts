import type { Translations } from "./types";

export const fr: Translations = {
  header: "📊 Aujourd'hui",
  nav: { today: "Aujourd'hui", settings: "Paramètres", privacy: "Vie privée" },
  noData: "Aucune donnée aujourd'hui",
  stats: {
    co2: "CO₂ estimé",
    data: "Données transférées",
    requests: "Requêtes",
    pageLoads: "Chargements de page",
    avoided: "évités par le cache",
  },
  chart: { title: "Top domaines par CO₂" },
  history: {
    title: "7 derniers jours",
    barTooltip: (date: string, grams: string) => `${date} — ${grams} g CO₂`,
    noMeasure: (date: string) => `${date} — aucune mesure`,
  },
  actions: { refresh: "Actualiser", export: "Export CSV" },
  badge: {
    tooltip: (grams, level) => `Carbolate — ${grams} g aujourd'hui · ${level}`,
    tooltipEmpty: "Carbolate — rien mesuré aujourd'hui",
  },
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
    method: {
      summary: "Comment ce chiffre est construit",
      measurement:
        "L'énergie n'est pas mesurable directement : les serveurs ne sont pas les nôtres, et une page web ne peut pas lire la consommation de ta machine. Carbolate multiplie ce qu'il voit — octets, durée de chargement — par des moyennes publiées.",
      perimeter:
        "Il ne compte que la navigation. La fabrication des serveurs, du réseau et de ton appareil est exclue : le chiffre réel est plus haut d'environ un quart.",
      allocation:
        "La part de l'écran est une attribution, pas une émission évitable : l'écran était déjà allumé, la page en utilise une part. Fermer l'onglet ne l'éteint pas.",
    },
    retention: {
      label: "Historique conservé",
      options: { 1: "1 jour", 7: "7 jours", [-1]: "Tout" },
      confirm: (days: number) =>
        `${days} ${days === 1 ? "journée enregistrée sera supprimée définitivement" : "journées enregistrées seront supprimées définitivement"}. C'est irréversible.`,
      confirmWithExport: (days: number) =>
        `${days} ${days === 1 ? "journée enregistrée va être exportée" : "journées enregistrées vont être exportées"} en CSV, puis ${days === 1 ? "supprimée" : "supprimées"} de l'extension.`,
    },
    autoExport: {
      label: "Exporter avant de supprimer",
      hint: "Télécharge un CSV à chaque suppression de journées.",
    },
  },
};
