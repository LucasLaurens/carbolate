chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getEntries") {
    const entries = performance.getEntries();
    console.log("entries", entries)
    sendResponse({ entries });
  }
});