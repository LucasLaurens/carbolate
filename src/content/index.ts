// todo: remove func and pass the resource and navigation to the background message
function collectAndSend(): void {
  const resource = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map(
    (e) => ({
      transferSize: e.transferSize,
    }),
  );
  const navigation = performance.getEntriesByType("navigation").map((e) => ({
    duration: e.duration,
  }));

  chrome.runtime.sendMessage({ type: "page_metrics", resource, navigation });
}

// todo: send without check readyState
if (document.readyState === "complete") {
  collectAndSend();
} else {
  window.addEventListener("load", collectAndSend, { once: true });
}
