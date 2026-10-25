// Checks on the data files themselves, so a typo in games, scores, sprites or audio is caught before it ships
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { ROOT, readScores } from "./helpers.js";
import { GAMES } from "../../data/games.js";
import { SPRITES } from "../../data/sprites.js";
import { COLOR_NAMES } from "../../data/color-names.js";
import { AXES } from "../../data/axes.js";
import { BADGE_ICONS, ICON_STAR, ICON_PLAY, ICON_PAUSE } from "../../data/icons.js";

const exists = path => access(new URL(path, ROOT)).then(() => true, () => false);
const trackNamed = (gameId, name) => GAMES.find(g => g.id === gameId)?.tracks.find(t => t.name === name);

describe("games", () => {
  test("have unique ids, a title, a year (or null when unannounced) and tracks", () => {
    assert.equal(new Set(GAMES.map(g => g.id)).size, GAMES.length);
    for (const g of GAMES) {
      assert.match(g.id, /^[a-z0-9]+$/, g.id);
      assert.match(g.title, /^Mega Man/, g.id);
      assert.ok(g.year === null || (Number.isInteger(g.year) && g.year >= 1987), g.id);
      assert.ok(Array.isArray(g.tracks) && g.tracks.length > 0, g.id);
    }
  });
  test("tracks have a name and serial, and names are unique within a game (apart from ??? placeholders)", () => {
    for (const g of GAMES) {
      const named = g.tracks.filter(t => t.name !== "???").map(t => t.name);
      assert.equal(new Set(named).size, named.length, g.id);
      for (const t of g.tracks) {
        assert.ok(t.name && typeof t.name === "string", g.id);
        assert.ok(t.dln && typeof t.dln === "string", `${g.id} ${t.name}`);
      }
    }
  });
  test("every game or track has a composer credit", () => {
    for (const g of GAMES) for (const t of g.tracks) {
      if (g.year !== null) assert.ok(t.composer || g.composer, `${g.id} ${t.name}`);
    }
  });
  test("every audio file exists", async () => {
    const missing = [];
    for (const t of GAMES.flatMap(g => g.tracks).filter(t => t.audio)) if (!(await exists(t.audio))) missing.push(t.audio);
    assert.deepEqual(missing, []);
  });
  test("no two tracks share an audio file", () => {
    const files = GAMES.flatMap(g => g.tracks).filter(t => t.audio).map(t => t.audio);
    assert.equal(new Set(files).size, files.length);
  });
});

describe("scores.csv", () => {
  test("has the expected header", async () => {
    const text = await readFile(new URL("data/scores.csv", ROOT), "utf8");
    assert.equal(text.split(/\r?\n/)[0], "game,name,energy,density,gravity");
  });
  test("every row names a real track, once", async () => {
    const rows = await readScores(), seen = new Set();
    for (const [game, name] of rows) {
      assert.ok(trackNamed(game, name), `no track ${game} ${name}`);
      assert.ok(!seen.has(game + "|" + name), `duplicate row ${game} ${name}`);
      seen.add(game + "|" + name);
    }
  });
  test("every row is either fully scored 1–5 or left blank", async () => {
    for (const [game, name, ...vals] of await readScores()) {
      assert.equal(vals.length, 3, `${game} ${name}`);
      const blank = vals.every(v => v === ""), scored = vals.every(v => /^[1-5]$/.test(v));
      assert.ok(blank || scored, `${game} ${name}: ${vals.join(",")}`);
    }
  });
});

// Reads an image's size from its header: PNG (IHDR) or WebP (VP8, VP8L or VP8X)
function imageSize(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (chunk === "VP8L") { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
  if (chunk === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  throw new Error("unknown WebP chunk " + chunk);
}

describe("sprites", () => {
  test("are keyed by a real game and track", () => {
    for (const key of Object.keys(SPRITES)) {
      const [game, name] = key.split("|");
      assert.ok(trackNamed(game, name), `no track for sprite ${key}`);
    }
  });
  test("point at image files in sprites/ whose size matches w and h", async () => {
    for (const [key, s] of Object.entries(SPRITES)) {
      assert.match(s.src, /^sprites\/[a-z0-9-]+\.(png|webp)$/, key);
      const size = imageSize(await readFile(new URL(s.src, ROOT)));
      assert.deepEqual(size, { w: s.w, h: s.h }, key);
    }
  });
  test("use a pixel density (r) of 1, 2 or 4", () => {
    for (const [key, s] of Object.entries(SPRITES)) assert.ok([undefined, 2, 4].includes(s.r), key);
  });
  test("don't share files", () => {
    const files = Object.values(SPRITES).map(s => s.src);
    assert.equal(new Set(files).size, files.length);
  });
});

describe("color names", () => {
  test("name all 125 colors, each differently", () => {
    assert.equal(COLOR_NAMES.length, 125);
    assert.equal(new Set(COLOR_NAMES).size, 125);
    assert.ok(COLOR_NAMES.every(n => n && n === n.trim()));
  });
  test("start at black and end at white", () => {
    assert.equal(COLOR_NAMES[0], "Black");
    assert.equal(COLOR_NAMES[124], "White");
  });
});

describe("axes", () => {
  test("are Energy, Density and Gravity, in the red, green and blue tokens", () => {
    assert.deepEqual(AXES.map(a => a.label), ["Energy", "Density", "Gravity"]);
    assert.deepEqual(AXES.map(a => a.tok), ["--r", "--g", "--b"]);
    for (const a of AXES) assert.ok(a.lo && a.hi);
  });
  test("point 120° apart", () => {
    const angles = AXES.map(a => ((a.ang % 360) + 360) % 360).sort((a, b) => a - b);
    assert.deepEqual([angles[1] - angles[0], angles[2] - angles[1]], [120, 120]);
  });
});

describe("icons", () => {
  test("cover every badge the model awards", () => {
    for (const icon of ["varied", "uniform", "hiE", "loE", "hiD", "loD", "hiG", "loG", "hiI", "loI"]) {
      assert.match(BADGE_ICONS[icon] || "", /^M[0-9]/, icon);
    }
  });
  test("are SVGs hidden from screen readers", () => {
    for (const icon of [ICON_STAR, ICON_PLAY, ICON_PAUSE]) assert.match(icon, /^<svg [^>]*aria-hidden="true"/);
  });
});
