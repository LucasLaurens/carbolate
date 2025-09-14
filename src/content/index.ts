import { EntriesEnum } from "../enums/EntriesEnum";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('message', message)

    if (message.type !== 'entries') {
      // todo: throw an exception
      return
    }

      const resource = performance.getEntriesByType(EntriesEnum.RESOURCE);
      const navigation = performance.getEntriesByType(EntriesEnum.NAVIGATION);
      const paint = performance.getEntriesByType(EntriesEnum.PAINT);
      const longtask = performance.getEntriesByType(EntriesEnum.LONGTASK);

      sendResponse({
        resource,
        navigation,
        paint,
        longtask
      });
});