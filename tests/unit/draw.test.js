import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubFetch, installFakeDocument, FakeElement } from "./helpers.js";

stubFetch();
const { GAMES } = await import("../../src/model.js");
const d = await import("../../src/draw.js");
const { BADGE_ICONS } = await import("../../data/icons.js");
const { SPRITES } = await import("../../data/sprites.js");

const close = (a, b) => Math.abs(a - b) < 1e-9;
const assertPoint = ([x, y], [ex, ey], msg) => assert.ok(close(x, ex) && close(y, ey), `${msg}: got ${x},${y}, want ${ex},${ey}`);

describe("ps", () => {
  test("writes points as an SVG points attribute, to 2 decimals", () => {
    assert.equal(d.ps([[1, 2], [3.14159, -0.5]]), "1.00,2.00 3.14,-0.50");
  });
});

describe("shapePts", () => {
  const c30 = Math.cos(Math.PI / 6) * 100, s30 = 50;
  test("puts all 5s on the hexagon's corners: E+, G-, D+, E-, G+, D- in turn", () => {
    const pts = d.shapePts([5, 5, 5], 100);
    assert.equal(pts.length, 6);
    assertPoint(pts[0], [0, -100], "Energy high (top)");
    assertPoint(pts[1], [c30, -s30], "Gravity low");
    assertPoint(pts[2], [c30, s30], "Density high");
    assertPoint(pts[3], [0, 100], "Energy low (bottom)");
    assertPoint(pts[4], [-c30, s30], "Gravity high");
    assertPoint(pts[5], [-c30, -s30], "Density low");
  });
  test("scales each axis by its score out of 5, on both of its ends", () => {
    const pts = d.shapePts([1, 5, 2.5], 100);
    assert.ok(close(Math.hypot(...pts[0]), 20));
    assert.ok(close(Math.hypot(...pts[3]), 20));
    assert.ok(close(Math.hypot(...pts[2]), 100));
    assert.ok(close(Math.hypot(...pts[1]), 50));
  });
});

describe("scoreBars", () => {
  const filled = html => html.split('<div class="bar">').slice(1).map(bar => (bar.match(/background:var\(/g) || []).length);
  test("fills each bar up to its score", () => {
    const html = d.scoreBars([4, 1, 5]);
    assert.deepEqual(filled(html), [4, 1, 5]);
    assert.match(html, /^<div class="bars">/);
    assert.equal((html.match(/<b /g) || []).length, 15);
    assert.match(html, /<span>Energy<\/span>.*<span>4<\/span>/);
    assert.match(html, /var\(--r\).*var\(--g\).*var\(--b\)/);
  });
  test("leaves every bar empty, with dashes, for an unscored track", () => {
    const html = d.scoreBars(null);
    assert.deepEqual(filled(html), [0, 0, 0]);
    assert.equal((html.match(/<span>–<\/span>/g) || []).length, 3);
  });
});

describe("sprImg", () => {
  const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`))[1];
  const s = { w: 24, h: 32, src: "sprites/x.png" };
  test("scales up by the largest whole number that fits the box", () => {
    const html = d.sprImg(s, 100);   // 32 × 3 = 96 fits, 32 × 4 doesn't
    assert.equal(attr(html, "width"), "72");
    assert.equal(attr(html, "height"), "96");
    assert.equal(attr(html, "class"), "spr");
  });
  test("caps the scale at maxK", () => {
    const html = d.sprImg(s, 200, "", 4);
    assert.equal(attr(html, "height"), "128");
  });
  test("shrinks a sprite bigger than the box to fit, drawn smoothly", () => {
    const html = d.sprImg(s, 28);
    assert.equal(attr(html, "height"), "28");
    assert.equal(attr(html, "width"), "21");
    assert.equal(attr(html, "class"), "spr soft");
  });
  test("scales denser sprites (r) by less, to come out the same size", () => {
    const dense = { w: 48, h: 64, r: 2, src: "d.png" };   // 32 × 32 at r 1
    assert.equal(attr(d.sprImg(dense, 100), "height"), attr(d.sprImg(s, 100), "height"));
    assert.equal(attr(d.sprImg(dense, 100), "width"), "72");
  });
  test("adds the class, src, empty alt and lazy loading", () => {
    const html = d.sprImg(s, 100, "spr-ghost");
    assert.equal(attr(html, "class"), "spr spr-ghost");
    assert.equal(attr(html, "src"), "sprites/x.png");
    assert.equal(attr(html, "alt"), "");
    assert.equal(attr(html, "loading"), "lazy");
  });
});

describe("spriteOf and sprite", () => {
  const cut = GAMES[0].tracks[0];
  test("find a track's sprite, for tracks and table rows alike", () => {
    assert.equal(d.spriteOf(cut), SPRITES["mm1|Cut Man"]);
    assert.equal(d.spriteOf({ gi: 0, ti: 0 }), SPRITES["mm1|Cut Man"]);
  });
  test("find nothing for no track or a track without a sprite", () => {
    assert.equal(d.spriteOf(null), null);
    assert.equal(d.spriteOf({ gi: 999, ti: 0 }), null);
    const plain = GAMES.flatMap(g => g.tracks).find(t => !SPRITES[t.game.id + "|" + t.name]);
    assert.ok(plain, "expected a track without a sprite");
    assert.equal(d.spriteOf(plain), undefined);
    assert.equal(d.sprite(plain, "spr-inline"), "");
  });
  test("small sprites sit in a sprite box", () => {
    const html = d.sprite(cut, "spr-inline");
    assert.match(html, /^<span class="sprbox spr-inline"><img class="spr/);
  });
  test("the ghost sprite is a bare image, at most 4× in a 200px box", () => {
    const html = d.sprite(cut, "spr-ghost");
    assert.match(html, /^<img class="spr spr-ghost"/);
    assert.match(html, /height="128"/);
  });
  test("the banner sprite fits 48px at no more than 1×", () => {
    assert.match(d.sprite(cut, "spr-banner"), /height="32"/);
  });
});

describe("badgeIcon", () => {
  test("draws the badge's icon with its tip for screen readers and the tooltip", () => {
    const html = d.badgeIcon({ icon: "hiE", tip: "Highest average Energy", cls: "ch-r" });
    assert.match(html, /class="ticon ch-r"/);
    assert.match(html, /role="img" aria-label="Highest average Energy" data-tip="Highest average Energy"/);
    assert.ok(html.includes(`d="${BADGE_ICONS.hiE}"`));
  });
  test("works without a class", () => {
    assert.match(d.badgeIcon({ icon: "varied", tip: "x" }), /class="ticon "/);
  });
});

describe("SVG drawing", () => {
  beforeEach(installFakeDocument);
  const svg = () => new FakeElement("svg");

  test("el creates an SVG element with its attributes, optionally added to a parent", () => {
    const parent = svg();
    const line = d.el("line", { x1: 0, y1: 5 }, parent);
    assert.equal(line.namespaceURI, "http://www.w3.org/2000/svg");
    assert.deepEqual(line.attrs, { x1: "0", y1: "5" });
    assert.equal(parent.children[0], line);
    assert.equal(d.el("g").parentNode, undefined);
  });
  test("drawFrame draws the outline, 4 grid rings and 3 axes, plus 6 labels when asked", () => {
    const plain = svg(), labeled = svg();
    d.drawFrame(plain, 58, false);
    d.drawFrame(labeled, 118, true);
    assert.equal(plain.querySelectorAll("polygon").length, 5);
    assert.equal(plain.querySelectorAll("line").length, 3);
    assert.equal(plain.querySelectorAll("text").length, 0);
    const labels = labeled.querySelectorAll("text").map(t => t.textContent);
    assert.deepEqual(labels.sort(), ["DENSITY", "DENSITY", "ENERGY", "ENERGY", "GRAVITY", "GRAVITY"]);
  });
  test("drawTop draws a half axis from the center for each score, ignoring the mouse", () => {
    const s = svg();
    d.drawTop(s, 58);
    const [g] = s.children;
    assert.equal(g.attrs["pointer-events"], "none");
    assert.equal(g.querySelectorAll("line").length, 3);
    assert.ok(g.querySelectorAll("line").every(l => l.attrs.x1 === "0" && l.attrs.y1 === "0"));
  });
  test("triangle draws a shape with a halo and a radial gradient fill in the track's color", () => {
    const s = svg();
    const g = d.triangle(s, [4, 3, 3], 100, "#BF8080");
    assert.equal(g.attrs.class, "tri");
    const stops = g.querySelectorAll("stop");
    assert.deepEqual(stops.map(x => [x.attrs.offset, x.attrs["stop-color"], x.attrs["stop-opacity"]]),
      [["0", "#BF8080", String(d.SINGLE[0])], ["1", "#BF8080", String(d.SINGLE[1])]]);
    const [halo, fill] = g.querySelectorAll("polygon");
    assert.equal(halo.attrs.stroke, "var(--halo)");
    assert.equal(halo.attrs["stroke-width"], "4");
    assert.equal(fill.attrs.class, "fill");
    assert.equal(fill.attrs.points, d.ps(d.shapePts([4, 3, 3], 100)));
    const id = g.querySelectorAll("radialGradient")[0].attrs.id;
    assert.equal(fill.attrs.fill, `url(#${id})`);
  });
  test("triangle takes a gradient, stroke width and dash pattern", () => {
    const g = d.triangle(svg(), [1, 1, 1], 58, "#000000", { grad: d.STACKED, w: 1.2, dash: "4 3" });
    const fill = g.querySelectorAll("polygon")[1];
    assert.equal(fill.attrs["stroke-width"], "1.2");
    assert.equal(fill.attrs["stroke-dasharray"], "4 3");
    assert.equal(g.querySelectorAll("stop")[0].attrs["stop-opacity"], String(d.STACKED[0]));
  });
  test("each shape gets its own gradient id", () => {
    const ids = [1, 2, 3].map(() => d.triangle(svg(), [3, 3, 3], 58, "#808080").querySelectorAll("radialGradient")[0].attrs.id);
    assert.equal(new Set(ids).size, 3);
  });
  test("setGrad changes a shape's gradient strength", () => {
    const g = d.triangle(svg(), [3, 3, 3], 58, "#808080");
    d.setGrad(g, d.STACKED);
    assert.deepEqual(g.querySelectorAll("stop").map(s => s.attrs["stop-opacity"]), d.STACKED.map(String));
  });
  test("drawSmallHexagon draws a frame, the track's shape if scored, and the top axes", () => {
    const scored = svg(), unscored = svg();
    d.drawSmallHexagon(scored, GAMES[0].tracks[0], 2);
    d.drawSmallHexagon(unscored, { vals: undefined }, 2);
    assert.equal(scored.children.length, 3);
    assert.equal(scored.children[1].attrs.class, "tri");
    assert.equal(unscored.children.length, 2);
    assert.equal(unscored.querySelectorAll("radialGradient").length, 0);
  });
});
