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
  "mm2,Wood Man,1,1,1,3,3,3, i  a b o ",  // a song structure after the ratings
  "mm2,Heat Man,,,,,,,a b",              // a structure without scores
].join("\r\n");

stubFetch({ "data/scores.csv": CSV });
const { GAMES, rangeOf } = await import("../../src/model.js");
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
    assert.equal(rangeOf(["i", "a", "b", "o"]), 4);
    assert.equal(rangeOf(["a", "b", "a", "c", "d"]), 4);                // repeats count once
    assert.equal(rangeOf(["i(r)", "a", "a", "b", "b+", "o"]), 4.5);     // an extension is half a point
    assert.equal(rangeOf(["i-", "a", "b", "c+"]), 4);                   // a tiny intro is half; c+ alone is c and its extension
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
