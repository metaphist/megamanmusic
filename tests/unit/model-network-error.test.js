// When fetching scores.csv fails outright (offline, blocked), the page still works with every track unscored
import { test } from "node:test";
import assert from "node:assert/strict";
import { stubFetch } from "./helpers.js";

stubFetch({ "data/scores.csv": new TypeError("Failed to fetch") });
const consoleError = console.error;
let logged = null;
console.error = (...args) => { logged = args; };
const { GAMES } = await import("../../src/model.js");
console.error = consoleError;

test("logs the error and leaves every track unscored", () => {
  assert.ok(logged[1] instanceof TypeError);
  assert.ok(GAMES.every(g => g.tracks.every(t => t.code === null) && g.avg === null));
});
