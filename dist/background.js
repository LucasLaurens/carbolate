chrome.runtime.onInstalled.addListener(()=>{chrome.action.setBadgeText({text:"BETA"})});chrome.runtime.onMessage.addListener((e,n,s)=>{e.type==="PING"&&console.log("Ping reçu depuis la popup !")});
