// How the model reads scores.csv, with a hand-made file covering the edge cases
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stubFetch } from "./helpers.js";

const CSV = [
  "mm2,Metal Man,1,1,1",                 // the first line is the header, whatever it says
  "mm1,Cut Man,1,2,3",
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
].join("\r\n");

stubFetch({ "data/scores.csv": CSV });
const { GAMES } = await import("../../src/model.js");
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
    assert.deepEqual(scored.sort(), ["mm1 Cut Man", "mm1 Fire Man", "mm1 Guts Man", "mm2 Air Man"]);
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
