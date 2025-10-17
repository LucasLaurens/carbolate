import { EntriesEnum } from "../enums/EntriesEnum";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "entries") {
    const resource = performance.getEntriesByType(EntriesEnum.RESOURCE);
    const navigation = performance.getEntriesByType(EntriesEnum.NAVIGATION);
    // const paint = performance.getEntriesByType(EntriesEnum.PAINT);
    // const longtask = performance.getEntriesByType(EntriesEnum.LONGTASK);

    sendResponse({
      resource,
      navigation,
      // paint,
      // longtask
    });
  }
});