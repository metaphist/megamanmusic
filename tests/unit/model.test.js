// The model with the real data/scores.csv
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { stubFetch, readScores } from "./helpers.js";
import { hex, colorName, intensity } from "../../src/colors.js";

stubFetch();
const m = await import("../../src/model.js");
const { GAMES, RELEASE_ORDER, trackKey, trackOf, selectable, average, shortTitle, tableTitle } = m;
const allTracks = GAMES.flatMap(g => g.tracks);

let scores;
before(async () => { scores = new Map((await readScores()).map(([g, n, ...v]) => [g + "|" + n, v])); });

describe("scores", () => {
  test("each track gets its three scores from scores.csv as a code", () => {
    for (const g of GAMES) for (const t of g.tracks) {
      const row = scores.get(g.id + "|" + t.name);
      const expected = row && row.every(v => /^[1-5]$/.test(v)) ? row.join("") : null;
      assert.equal(t.code, expected, `${g.id} ${t.name}`);
    }
  });
  test("some tracks are scored and some aren't", () => {
    assert.ok(allTracks.some(t => t.code));
    assert.ok(allTracks.some(t => !t.code));
  });
  test("a scored track has its scores, color and color name", () => {
    for (const t of allTracks.filter(t => t.code)) {
      assert.deepEqual(t.vals, [...t.code].map(Number));
      assert.equal(t.color, hex(t.vals));
      assert.equal(t.cname, colorName(t.vals));
    }
  });
  test("an unscored track has none of those", () => {
    for (const t of allTracks.filter(t => !t.code)) {
      assert.equal(t.vals, undefined);
      assert.equal(t.color, undefined);
    }
  });
  test("Cut Man is Rosy Brown", () => {
    const cut = GAMES[0].tracks[0];
    assert.equal(cut.name, "Cut Man");
    assert.equal(cut.color, "#BF8080");
    assert.equal(cut.cname, "Rosy Brown");
  });
});

describe("games", () => {
  test("list their scored tracks, in order", () => {
    for (const g of GAMES) assert.deepEqual(g.scored, g.tracks.filter(t => t.vals));
  });
  test("average their scored tracks' scores, with the color of the average", () => {
    for (const g of GAMES.filter(g => g.scored.length)) {
      const avg = [0, 1, 2].map(k => g.scored.reduce((s, t) => s + t.vals[k], 0) / g.scored.length);
      avg.forEach((v, k) => assert.ok(Math.abs(g.avg[k] - v) < 1e-9));
      assert.equal(g.color, hex(g.avg));
      assert.equal(g.cname, colorName(g.avg));
    }
  });
  test("with nothing scored have no average or color", () => {
    const empty = GAMES.filter(g => !g.scored.length);
    assert.ok(empty.length > 0, "expected an unscored game (Dual Override)");
    for (const g of empty) {
      assert.equal(g.avg, null);
      assert.equal(g.color, null);
      assert.equal(g.cname, null);
    }
  });
});

describe("track positions", () => {
  test("each track knows its game and its place in it", () => {
    GAMES.forEach((g, gi) => g.tracks.forEach((t, ti) => {
      assert.equal(t.gi, gi);
      assert.equal(t.ti, ti);
      assert.equal(t.game, g);
    }));
  });
});

describe("RELEASE_ORDER", () => {
  test("has every game once", () => {
    assert.equal(RELEASE_ORDER.length, GAMES.length);
    assert.equal(new Set(RELEASE_ORDER).size, GAMES.length);
  });
  test("runs by year, with undated games last", () => {
    const years = RELEASE_ORDER.map(g => g.year ?? Infinity);
    years.slice(1).forEach((y, i) => assert.ok(y >= years[i], `${RELEASE_ORDER[i + 1].id} after ${RELEASE_ORDER[i].id}`));
    assert.equal(RELEASE_ORDER.at(-1).year, null);
  });
  test("keeps series order within a year", () => {
    RELEASE_ORDER.slice(1).forEach((g, i) => {
      const prev = RELEASE_ORDER[i];
      if ((g.year ?? Infinity) === (prev.year ?? Infinity)) assert.ok(GAMES.indexOf(g) > GAMES.indexOf(prev));
    });
  });
  test("starts with the first game", () => {
    assert.equal(RELEASE_ORDER[0].id, "mm1");
  });
});

describe("trackKey and trackOf", () => {
  test("key a track by game id and index", () => {
    assert.equal(trackKey(GAMES[0].tracks[0]), "mm1.0");
  });
  test("round-trip every track", () => {
    for (const t of allTracks) assert.equal(trackOf(trackKey(t)), t);
  });
  test("find nothing for an unknown game or index", () => {
    assert.ok(!trackOf("nope.0"));
    assert.ok(!trackOf("mm1.99"));
    assert.ok(!trackOf("mm1"));
  });
});

describe("selectable", () => {
  test("is true for a scored track or one with audio", () => {
    for (const t of allTracks) assert.equal(selectable(t), !!(t.vals || t.audio));
    assert.equal(selectable({ vals: [1, 1, 1] }), true);
    assert.equal(selectable({ audio: "a.mp3" }), true);
    assert.equal(selectable({ name: "???" }), false);
  });
});

describe("average", () => {
  test("is null for no tracks", () => {
    assert.equal(average([]), null);
  });
  test("averages each score", () => {
    assert.deepEqual(average([{ vals: [1, 2, 3] }, { vals: [3, 4, 5] }]), [2, 3, 4]);
  });
});

describe("titles", () => {
  const game = title => ({ title });
  test("short titles drop the Mega Man prefix", () => {
    assert.equal(shortTitle(game("Mega Man")), "1");
    assert.equal(shortTitle(game("Mega Man 2")), "2");
    assert.equal(shortTitle(game("Mega Man Powered Up")), "Powered Up");
    assert.equal(shortTitle(game("Mega Man & Bass")), "& Bass");
  });
  test("table titles abbreviate the longer suffixes", () => {
    assert.equal(tableTitle(game("Mega Man Powered Up")), "PU");
    assert.equal(tableTitle(game("Mega Man & Bass")), "&B");
    assert.equal(tableTitle(game("Mega Man Dual Override")), "DO");
    assert.equal(tableTitle(game("Mega Man 11")), "11");
    assert.equal(tableTitle(game("Mega Man")), "1");
  });
});

describe("distinction badges", () => {
  const pool = GAMES.filter(g => g.scored.length >= 4);
  const holders = icon => GAMES.filter(g => g.badges.some(b => b.icon === icon));
  const best = (value, highest) => (highest ? Math.max : Math.min)(...pool.map(value));
  const near = (a, b) => Math.abs(a - b) < .005;

  test("only games with 4 or more scored tracks have a variety or badges", () => {
    for (const g of GAMES.filter(g => g.scored.length < 4)) {
      assert.equal(g.variety, null);
      assert.deepEqual(g.badges, []);
    }
    for (const g of pool) assert.equal(typeof g.variety, "number");
  });
  test("variety is the average distance between a game's track shapes", () => {
    for (const g of pool) {
      const v = g.scored.map(t => t.vals), d = [];
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) d.push(Math.hypot(...[0, 1, 2].map(k => v[i][k] - v[j][k])));
      assert.ok(Math.abs(g.variety - d.reduce((a, b) => a + b) / d.length) < 1e-9);
    }
  });
  test("every badge goes to at least one game", () => {
    for (const icon of ["varied", "uniform", "hiE", "loE", "hiD", "loD", "hiG", "loG", "hiI", "loI"]) {
      assert.ok(holders(icon).length >= 1, icon);
    }
  });
  test("most varied and most uniform go to the extremes (ties within 0.005 share)", () => {
    const top = best(g => g.variety, true), bottom = best(g => g.variety, false);
    assert.deepEqual(holders("varied"), pool.filter(g => near(g.variety, top)));
    assert.deepEqual(holders("uniform"), pool.filter(g => near(g.variety, bottom)));
  });
  test("highest and lowest of each score go to the extremes", () => {
    "EDG".split("").forEach((L, k) => {
      assert.deepEqual(holders("hi" + L), pool.filter(g => near(g.avg[k], best(g => g.avg[k], true))), "hi" + L);
      assert.deepEqual(holders("lo" + L), pool.filter(g => near(g.avg[k], best(g => g.avg[k], false))), "lo" + L);
    });
  });
  test("highest and lowest intensity use the sum of the averages", () => {
    const sum = g => intensity(g.avg);
    assert.deepEqual(holders("hiI"), pool.filter(g => near(sum(g), best(sum, true))));
    assert.deepEqual(holders("loI"), pool.filter(g => near(sum(g), best(sum, false))));
  });
  test("each badge has a tip and the score badges carry their axis color", () => {
    for (const b of GAMES.flatMap(g => g.badges)) {
      assert.ok(b.text && b.tip && b.icon);
      if (/^(hi|lo)[EDG]$/.test(b.icon)) assert.match(b.cls, /^ch-[rgb]$/);
    }
  });
});
