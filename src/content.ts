console.log('content.js')

const url = document.location.href;
const start = performance.now();

window.addEventListener('load', () => {
  console.log("load");
});

const xhr = new XMLHttpRequest();

xhr.open("GET", url);
xhr.onload = () => {
  const end = performance.now();
  const loadedPageTiming = (end - start).toFixed(2)
  console.log(`the loaded page timing in ms : ${loadedPageTiming}`);
};
xhr.onerror = () => console.error("XHR error");
xhr.send();
