import { EntriesEnum } from "../performance/enums/EntriesEnum";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "entries") {
    const resource = performance.getEntriesByType(EntriesEnum.RESOURCE);
    const navigation = performance.getEntriesByType(EntriesEnum.NAVIGATION);

    sendResponse({ resource, navigation });
  } else {
    sendResponse(null);
  }
  return true;
});
