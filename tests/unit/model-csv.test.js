// How the model reads scores.csv, with a hand-made file covering the edge cases
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stubFetch } from "./helpers.js";

const CSV = [
  "mm2,Metal Man,1,1,1",                 // the first line is the header, whatever it says
  "mm1,Cut Man,1,2,3,5,1,4",             // tier list ratings after the color scores
  "mm2,Crash Man,,,,2,3,1",              // rated, without color scores
  "mm2,Flash Man,1,2,3,5,,",             // partly rated: not rated
  "",
  '"mm1","Guts Man",5,5,5,extra column',  // quoted cells, extra columns ignored
  "mm1,Ice Man,6,2,2",                   // out of range: not scored
  "mm1,Bomb Man,,,",                     // blank: not scored
  "mm1,Fire Man, 2 , 3 , 4 ",            // spaces trimmed
  "mm1,Elec Man,2,2",                    // too few scores: not scored
  "mm1,Oil Man,1,1,1",                   // no such track in this game
  "nope,Cut Man,1,1,1",                  // no such game
  'mm2,"Air Man",3,"4",5',
  "mm2,Bubble Man,1.5,2,3",              // not a whole number: not scored
  "mm2,Wood Man,1,1,1,3,3,1, i  a b o ",  // a song structure after the ratings: range comes from it, not the column
  "mm2,Heat Man,,,,,,,a b",              // a structure without scores
  "mm3,Needle Man,,,,4.5,3.6,2.5",       // decimal ratings, no structure: range from its column
  "mm3,Magnet Man,,,,5,5,,i a b c d e",  // a structure past 5, and no range column
  "mm3,Gemini Man,,,,5.5,4,4,a b",       // a decimal out of range: not rated
  "mm3,Hard Man,,,,4,4,,",               // no range and no structure: not rated
].join("\r\n");

stubFetch({ "data/scores.csv": CSV });
const { GAMES, rangeOf, rangeRating } = await import("../../src/model.js");
const code = (gameId, name) => GAMES.find(g => g.id === gameId).tracks.find(t => t.name === name).code;

describe("reading scores.csv", () => {
  test("skips the header line", () => {
    assert.equal(code("mm2", "Metal Man"), null);
  });
  test("reads plain rows", () => {
    assert.equal(code("mm1", "Cut Man"), "123");
  });
  test("reads quoted cells and ignores extra columns", () => {
    assert.equal(code("mm1", "Guts Man"), "555");
    assert.equal(code("mm2", "Air Man"), "345");
  });
  test("trims spaces around cells", () => {
    assert.equal(code("mm1", "Fire Man"), "234");
  });
  test("leaves tracks unscored when a score is blank, missing, out of range or fractional", () => {
    assert.equal(code("mm1", "Ice Man"), null);
    assert.equal(code("mm1", "Bomb Man"), null);
    assert.equal(code("mm1", "Elec Man"), null);
    assert.equal(code("mm2", "Bubble Man"), null);
  });
  test("ignores rows for tracks that don't exist", () => {
    const scored = GAMES.flatMap(g => g.tracks).filter(t => t.code).map(t => `${t.game.id} ${t.name}`);
    assert.deepEqual(scored.sort(), ["mm1 Cut Man", "mm1 Fire Man", "mm1 Guts Man", "mm2 Air Man", "mm2 Flash Man", "mm2 Wood Man"]);
  });
  test("reads tier list ratings separately from color scores", () => {
    const track = (gameId, name) => GAMES.find(g => g.id === gameId).tracks.find(t => t.name === name);
    assert.deepEqual(track("mm1", "Cut Man").ratings, [5, 1, 4]);
    assert.equal(track("mm1", "Cut Man").code, "123");
    assert.deepEqual(track("mm2", "Crash Man").ratings, [2, 3, 1]);
    assert.equal(track("mm2", "Crash Man").code, null);
  });
  test("leaves tracks unrated when ratings are partial, invalid or absent", () => {
    const ratings = (gameId, name) => GAMES.find(g => g.id === gameId).tracks.find(t => t.name === name).ratings;
    assert.equal(ratings("mm2", "Flash Man"), null);
    assert.equal(ratings("mm1", "Guts Man"), null);   // its extra column isn't a rating
    assert.equal(ratings("mm2", "Air Man"), null);
    assert.equal(ratings("mm2", "Metal Man"), null);  // never read: it's the header line
  });
  test("reads song structures as a list of sections, or null when there's none", () => {
    const structure = (gameId, name) => GAMES.find(g => g.id === gameId).tracks.find(t => t.name === name).structure;
    assert.deepEqual(structure("mm2", "Wood Man"), ["i", "a", "b", "o"]);
    assert.deepEqual(structure("mm2", "Heat Man"), ["a", "b"]);
    assert.equal(structure("mm1", "Cut Man"), null);
    assert.equal(structure("mm1", "Guts Man"), null);
  });
  test("works out a structure's range from its unique sections", () => {
    assert.equal(rangeOf(["a", "b"]), 2);
    assert.equal(rangeOf(["a", "b", "a", "c", "d"]), 4);                // repeats count once
    assert.equal(rangeOf(["i", "a", "b"]), 2.5);                        // an intro is half a point
    assert.equal(rangeOf(["i(r)", "a", "b"]), 2.5);                     // ...repeated in the loop or not
    assert.equal(rangeOf(["i", "a", "b", "o"]), 3);                     // an outro is half a point
    assert.equal(rangeOf(["a", "b", "o", "a", "o"]), 3);                // ...each time
    assert.equal(rangeOf(["i(r)", "a", "a", "b", "b+", "o"]), 3.5);     // an extension is half a point
    assert.equal(rangeOf(["a", "b+", "b+"]), 3);                        // ...each time
    assert.equal(rangeOf(["i-", "a", "b", "c+"]), 3.5);                 // a tiny intro is an intro less half: nothing
  });
  test("rounds a structure's range into a rating from 1 to 5, a half rounding down", () => {
    assert.equal(rangeRating(["i", "a", "b", "o"]), 3);
    assert.equal(rangeRating(["i", "a", "b", "c", "d", "e"]), 5);
    assert.equal(rangeRating(["i-"]), 1);
  });
  test("rates range from the structure, and decimal ratings as whole numbers", () => {
    const ratings = (gameId, name) => GAMES.find(g => g.id === gameId).tracks.find(t => t.name === name).ratings;
    assert.deepEqual(ratings("mm2", "Wood Man"), [3, 3, 3]);           // i a b o: 3, not its column's 1
    assert.deepEqual(ratings("mm3", "Needle Man"), [4, 4, 2]);         // 4.5 down, 3.6 up, 2.5 down
    assert.deepEqual(ratings("mm3", "Magnet Man"), [5, 5, 5]);         // 5.5, kept to 5
    assert.equal(ratings("mm3", "Gemini Man"), null);
    assert.equal(ratings("mm3", "Hard Man"), null);
    assert.equal(ratings("mm2", "Heat Man"), null);                    // a structure alone isn't a rating
  });
  test("works out averages from what was read", () => {
    const mm1 = GAMES.find(g => g.id === "mm1");
    assert.equal(mm1.scored.length, 3);
    assert.deepEqual(mm1.avg, [(1 + 5 + 2) / 3, (2 + 5 + 3) / 3, (3 + 5 + 4) / 3]);
  });
  test("gives no badges when no game has 4 scored tracks", () => {
    assert.ok(GAMES.every(g => g.badges.length === 0));
  });
});
