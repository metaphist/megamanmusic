# Mega Man Music Color Visualizer

A music player, visualizer, and playlist creator, featuring music from the classic Mega Man series (for now). All tracks are rated along "instensity" vectors (energy, density, gravity) to give an RGB color value and shape to the visualizer.

## Running it

The page loads its scores with `fetch`, so it needs to be served over http rather than opened as a file:

```
npm run serve        # http://localhost:4173
```

## Tests

```
npm install          # once; uses your installed Chrome, no browser download
npm test             # unit tests, then browser tests
npm run test:unit    # Node's built-in test runner: tests/unit
npm run test:e2e     # Playwright in Chrome: tests/e2e
```

- `tests/unit` covers the logic in `src/colors.js`, `src/model.js` (including how `data/scores.csv` is read and what happens when it's missing), `src/draw.js` and `src/util.js`, and checks the data files: games, scores, sprites (their files and sizes), audio files, color names, axes and icons.
- `tests/e2e` drives the page in Chrome: links and old hash links, back button history, the visualizer and custom lists, the track table, the report and its search, "Play all", favorites, saved lists, color buddies, the score distribution and the theme. Any page error or missing file fails a test. Audio plays muted.
