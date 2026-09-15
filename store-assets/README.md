# Store assets

Uploaded to the Chrome Web Store and AMO **dashboards** — they never travel inside the zip.
The icons that do are in `public/assets/icons/`, and their 1024px master in `assets/`.

| File                        | Size     | Where it goes                                 |
| --------------------------- | -------- | --------------------------------------------- |
| `screenshot-1-today-en.png` | 1280×800 | CWS + AMO, first screenshot (English listing) |
| `screenshot-2-week-en.png`  | 1280×800 | CWS + AMO, second screenshot                  |
| `screenshot-1-today-fr.png` | 1280×800 | French listing                                |
| `screenshot-2-week-fr.png`  | 1280×800 | French listing                                |
| `promo-tile-440x280-en.png` | 440×280  | CWS small promo tile                          |
| `promo-tile-440x280-fr.png` | 440×280  | CWS small promo tile, French                  |

## The panel in them is the real panel

The screenshots embed a headless-Chrome render of the **built extension** served from `dist/`,
not a drawing of it: every pixel inside the white frame is what the panel puts on screen. Only
the surrounding cream canvas and the copy are composed.

The data is **seeded demonstration data** — a moderate day at 143 g, a fortnight of history with
one day nobody browsed. That is deliberate twice over: it shows the colour system working without
being either flattering or alarmist, and it keeps real visited domains off a public listing, which
a capture of genuine browsing would not.

## Regenerating

`scripts/compose-store-assets.py` composes the canvases from two renders of the panel. The renders
themselves come from `dist/store-shot.html` / `store-shot-en.html`, throwaway pages that stub
`chrome.*` and seed the storage. Rebuild them whenever the panel changes shape — a screenshot that
no longer matches the product is a review risk, not a cosmetic one.
