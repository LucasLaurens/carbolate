chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getEntries") {
    const entries = performance.getEntriesByType("resource");
    sendResponse({ entries });
  }
  // Return true pour indiquer que sendResponse sera appelé de façon asynchrone
  return true;
});

// Récupère toutes les entrées de performance
// const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
// const entries = performance.getEntries();
// console.log('entries', entries)

// document.dispatchEvent(new CustomEvent<PerformanceEntry[]>("entries", {
//   detail: entries,
// }));

// Nombre de requêtes
// console.log("Nombre de requêtes :", entries.length);

// Temps total cumulé des requêtes
// const totalTime = entries.reduce((sum, entry) => sum + entry.duration, 0);
// console.log("Temps total des requêtes :", totalTime, "ms");

// Exemple : afficher chaque ressource avec son temps de chargement
// entries.forEach((entry) => {
//   console.log(`${entry.name} : ${entry.duration.toFixed(2)} ms`);
// });