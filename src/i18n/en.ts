import type { Translations } from "./types";

export const en: Translations = {
  nav: { today: "Today", settings: "Settings", privacy: "Privacy" },
  noData: "No data for today",
  stats: {
    co2: "Estimated CO₂",
    data: "Data transferred",
    requests: "Requests",
    pageLoads: "Page loads",
    running: "Running total, resets at midnight",
    thirdParty: (third: number, total: number) =>
      `${third} of ${total} requests come from third parties`,
    avoided: "avoided by the cache",
  },
  chart: { title: "Top domains by CO₂" },
  history: {
    title: "Last 7 days",
    barTooltip: (date: string, grams: string) => `${date}: ${grams} g CO₂`,
    noMeasure: (date: string) => `${date}: nothing measured`,
    versusPreviousWeek: (percent: number) =>
      `${percent > 0 ? "+" : percent < 0 ? "−" : ""}${Math.abs(percent)}% vs. previous week`,
  },
  actions: {
    export: "Export CSV",
    exporting: "Exporting…",
    exportFailed: "The export failed. Try again in a few seconds.",
  },
  badge: {
    tooltip: (grams, level) => `Carbolate — ${grams} g today · ${level}`,
    tooltipEmpty: "Carbolate — nothing measured today",
  },
  sobrietyLevels: {
    sober: "Sober",
    moderate: "Moderate",
    intensive: "Intensive",
    excessive: "Excessive",
  },
  equivalences: {
    emails: (n) => `≈ ${n} email${n > 1 ? "s" : ""}`,
    streamingMin: (n) => `≈ ${n} min HD streaming`,
    streamingH: (h) => `≈ ${h}h HD streaming`,
    car: (km) => `≈ ${km} km by car`,
    flight: (km) => `≈ ${km} km by plane`,
  },
  worldComparison: {
    wellBelow: "well below the daily average",
    below: "below the daily average",
    around: "around the daily average",
    above: "above the daily average",
    wellAbove: "well above the daily average",
  },
  settings: {
    saved: "Saved",
    language: "Language",
    method: {
      summary: "How this number is built",
      measurement:
        "Energy can't be measured directly: the servers aren't ours, and a web page can't read your machine's power draw. Carbolate multiplies what it sees (bytes, load time) by published averages.",
      perimeter:
        "It counts browsing only. Building the servers, the network and your device is excluded, so the true figure is about a quarter higher.",
      allocation:
        "The screen's share is an allocation, not an avoidable emission: the display was already on and the page uses a part of it. Closing the tab does not turn it off.",
    },
    retention: {
      label: "History kept",
      options: { 1: "1 day", 7: "7 days", [-1]: "Everything" },
      confirm: (days: number) =>
        `${days} recorded ${days === 1 ? "day" : "days"} will be deleted for good. This can't be undone.`,
      confirmWithExport: (days: number) =>
        `${days} recorded ${days === 1 ? "day" : "days"} will be exported as a CSV, then removed from the extension.`,
    },
    autoExport: {
      label: "Export before deleting",
      hint: "Downloads a CSV each time days are dropped.",
    },
  },
};
