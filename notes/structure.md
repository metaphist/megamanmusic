# Song structure legend

The `structure` column of `data/scores.csv` writes out a track's song as its sections in play order, separated by
spaces, like `i a b a c o`. A section that comes back is written again each time it plays. The tier list's **range**
rating is worked out from this column (`rangeOf` and `rangeRating` in `src/model.js`).

## Symbols

| Symbol | Meaning | Example |
| --- | --- | --- |
| `a`–`e` | A section of the song. Each new section gets the next letter. | `a b a c` |
| `i` | Intro | `i a b` |
| `i(r)` | Intro that is repeated in the loop | `i(r) a b` |
| `i-` | Tiny intro | `i- a b` |
| `o` | Outro | `a b o` |
| `+` | After a section letter: that section plays extended | `a b b+` |

## Scoring

| Counts | Points |
| --- | --- |
| Each unique section letter (`a`–`e`), however often it repeats | 1 |
| Each intro (`i`, `i(r)` or `i-`) | ½ |
| Each `o` | ½ |
| Each `+` | ½ |
| Each `-` | −½ |

The points add up to a score, which becomes the range rating:

1. **Capped:** the score is kept between 1 and 5.
2. **Rounded:** an exact half rounds **down** (3½ is 3). Anything above a half rounds up (3.6 is 4).

A tiny intro (`i-`) comes to nothing: ½ for the intro, ½ off for the `-`.

The same rounding applies to every tier rating, including expression and synergy when they have decimals.

## Examples

| Structure | Working | Score | Range |
| --- | --- | --- | --- |
| `a b` | 2 sections | 2 | 2 |
| `a b c b d` | 4 sections (`b` repeats, counted once) | 4 | 4 |
| `i a b o` | 2 sections + ½ intro + ½ outro | 3 | 3 |
| `i(r) a a b b+ o` | 2 sections + ½ intro + ½ extension + ½ outro | 3½ | 3 |
| `i- a b c+` | 3 sections + ½ intro + ½ extension − ½ | 3½ | 3 |
| `i a b c d o` | 4 sections + ½ intro + ½ outro | 5 | 5 |
| `i(r) a b c d e` | 5 sections + ½ intro | 5½ | 5 (capped) |

## Missing structures

A track with a blank `structure` takes its range from the `range` column instead, rounded the same way. With neither,
the track isn't graded.
