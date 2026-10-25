// When scores.csv can't be loaded, the page still works with every track unscored
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stubFetch } from "./helpers.js";

stubFetch({ "data/scores.csv": null });   // 404
const logged = [];
const consoleError = console.error;
console.error = (...args) => logged.push(args);
const { GAMES, RELEASE_ORDER } = await import("../../src/model.js");
console.error = consoleError;

describe("without scores", () => {
  test("logs the failure", () => {
    assert.equal(logged.length, 1);
    assert.match(String(logged[0][0]), /Couldn't load scores/);
    assert.match(String(logged[0][1]), /scores\.csv 404/);
  });
  test("leaves every track unscored and every game without an average or badges", () => {
    for (const g of GAMES) {
      assert.ok(g.tracks.every(t => t.code === null && !t.vals));
      assert.deepEqual(g.scored, []);
      assert.equal(g.avg, null);
      assert.deepEqual(g.badges, []);
    }
  });
  test("still knows each track's position and the release order", () => {
    assert.equal(GAMES[1].tracks[2].gi, 1);
    assert.equal(GAMES[1].tracks[2].ti, 2);
    assert.equal(RELEASE_ORDER.length, GAMES.length);
  });
});
