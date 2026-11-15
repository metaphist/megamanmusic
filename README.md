# Mega Man Music Color Visualizer

A music player, visualizer, and playlist creator, featuring music from the classic Mega Man series (for now). All tracks are rated along "intensity" vectors (energy, density, gravity) to give an RGB color value and shape to the visualizer.

## Tier list

`tiers.html` grades every track on expression, synergy and range, each rated 1–5. Expression and synergy come from their columns of `data/scores.csv`; range is worked out from the `structure` column (the `range` column is only used when a track has no structure). [notes/structure.md](notes/structure.md) is the legend for its symbols, with worked examples. In short:

- 1 point for each unique section letter other than the intro and outro
- ½ point for each intro (`i`, `i(r)` or `i-`), each `o` and each `+`
- ½ point off for each `-` (so a tiny intro, `i-`, comes to nothing)

Ratings may have decimals. Each one shows and counts as a whole number: a half rounds down (3.5 is 3) and anything above it rounds up (3.6 is 4). Range is also kept within 1–5. The three ratings count equally and add up to a total from 3 to 15, which sets the grade (ranges in `src/grades.js`):

| Grade | S+ | S | A | B | C | D | F |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Total | 15 | 14 | 12–13 | 10–11 | 8–9 | 6–7 | 3–5 |

A row with blank ratings shows as "Not graded".

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
