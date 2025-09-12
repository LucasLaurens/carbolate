chrome.runtime.onMessage.addListener((n,s,r)=>{if(n.type==="getEntries"){const e=performance.getEntries();console.log("entries",e),r({entries:e})}});
