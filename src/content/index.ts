function collectAndSend(): void {
  const resource = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((e) => ({
    transferSize: e.transferSize,
  }));
  const navigation = performance.getEntriesByType("navigation").map((e) => ({
    duration: e.duration,
  }));

  chrome.runtime.sendMessage({ type: "page_metrics", resource, navigation });
}

if (document.readyState === "complete") {
  collectAndSend();
} else {
  window.addEventListener("load", collectAndSend, { once: true });
}
