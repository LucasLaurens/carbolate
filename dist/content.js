chrome.runtime.onMessage.addListener((e,n,r)=>{if(e.type==="getEntries"){const t=performance.getEntriesByType("resource");r({entries:t})}return!0});
