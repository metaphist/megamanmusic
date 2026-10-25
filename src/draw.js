// Drawing helpers: the hexagon chart (SVG), track sprites, score bars and badge icons
import { GAMES, AXES } from "./model.js";
import { SPRITES } from "../data/sprites.js";
import { BADGE_ICONS } from "../data/icons.js";

// ---- Hexagon chart ----

const NS = "http://www.w3.org/2000/svg";

// Creates an SVG element with these attributes, added to parent when given
export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// Each score runs from 0 at the center to 5 at both of its axis's opposite corners.
// side = 1 for the axis's high end, -1 for its low end.
const pt = (axis, v, R, side = 1) => {
  const a = AXES[axis].ang * Math.PI / 180, d = side * v / 5 * R;
  return [d * Math.cos(a), -d * Math.sin(a)];
};
// A track's shape: six points in order around the hexagon, E+, G-, D+, E-, G+, D-
const ORDER = [[0, 1], [2, -1], [1, 1], [0, -1], [2, 1], [1, -1]];
export const shapePts = (vals, R) => ORDER.map(([i, side]) => pt(i, vals[i], R, side));
const hexPts = r => [90, 30, -30, -90, -150, 150].map(deg => {
  const a = deg * Math.PI / 180;
  return [r * Math.cos(a), -r * Math.sin(a)];
});
// Points as an SVG points attribute
export const ps = points => points.map(p => p.map(n => n.toFixed(2)).join(",")).join(" ");

// The hexagon's outline, grid rings and axes, with the axis names at each end when labels is set
export function drawFrame(svg, R, labels) {
  const g = el("g", {}, svg);
  el("polygon", { points: ps(hexPts(R)), fill: "var(--bg)", stroke: "var(--line)", "stroke-width": 1.2 }, g);
  [1, 2, 3, 4].forEach(v => el("polygon", { points: ps(hexPts(R * v / 5)), fill: "none", stroke: "var(--grid)", "stroke-width": 1 }, g));
  AXES.forEach((ax, i) => {
    const [x1, y1] = pt(i, 5, R, -1), [x2, y2] = pt(i, 5, R);
    el("line", { x1, y1, x2, y2, stroke: `var(${ax.tok})`, "stroke-opacity": .35, "stroke-width": 1 }, g);
    if (!labels) return;
    [1, -1].forEach(side => {
      const [x, y] = pt(i, 5, R * 1.13, side);
      const anchor = Math.abs(x) < 4 ? "middle" : (x > 0 ? "start" : "end");
      const label = el("text", {
        x, y: y + (y < -R * 0.9 ? -2 : y > R * 0.9 ? 10 : 4), "text-anchor": anchor, "font-size": 11,
        fill: `var(${ax.tok})`, "font-weight": 700
      }, g);
      label.textContent = ax.label.toUpperCase();
    });
  });
}

// One half of each axis also sits above the shapes: Energy bottom, Density left, Gravity right
export function drawTop(svg, R) {
  const g = el("g", { "pointer-events": "none" }, svg);
  AXES.forEach((ax, i) => {
    const [x2, y2] = pt(i, 5, R, -1);
    el("line", { x1: 0, y1: 0, x2, y2, stroke: `var(${ax.tok})`, "stroke-opacity": .35, "stroke-width": 1 }, g);
  });
}

// A shape's fill is a radial gradient: strong at the center, fading toward the outer edge (a score of 5).
// [center, edge] opacity for one track on its own, and for all of a game's tracks stacked.
export const SINGLE = [.9, .15], STACKED = [.4, .05];
export function setGrad(shape, [center, edge]) {
  const [s0, s1] = shape.querySelectorAll("stop");
  s0.setAttribute("stop-opacity", center);
  s1.setAttribute("stop-opacity", edge);
}

// Draws a track's shape. opts: grad ([center, edge] opacity), w (stroke width), dash (stroke dash pattern)
let gradId = 0;
export function triangle(parent, vals, R, color, opts = {}) {
  const points = ps(shapePts(vals, R)), id = "sf" + (gradId++), w = opts.w || 2;
  const g = el("g", { class: "tri" }, parent);
  const grad = el("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: R }, el("defs", {}, g));
  const [center, edge] = opts.grad || SINGLE;
  [[0, center], [1, edge]].forEach(([offset, opacity]) => el("stop", { offset, "stop-color": color, "stop-opacity": opacity }, grad));
  el("polygon", { points, fill: "none", stroke: "var(--halo)", "stroke-width": w * 2, "stroke-linejoin": "round" }, g);
  el("polygon", {
    class: "fill", points, fill: `url(#${id})`, stroke: color, "stroke-width": w,
    "stroke-linejoin": "round", "stroke-dasharray": opts.dash || "none"
  }, g);
  return g;
}

// A track's small hexagon, as on the visualizer's cards and the report's rows
export function drawSmallHexagon(svg, t, w) {
  drawFrame(svg, 58, false);
  if (t.vals) triangle(svg, t.vals, 58, t.color, { w });
  drawTop(svg, 58);
}

// ---- Scores ----

// A bar of five blocks per score, filled up to the score (all empty, with dashes, for an unscored track)
export function scoreBars(vals) {
  return `<div class="bars">${AXES.map((ax, k) => {
    const blocks = [1, 2, 3, 4, 5].map(n => `<b style="${vals && n <= vals[k] ? `background:var(${ax.tok})` : ""}"></b>`).join("");
    return `<div class="bar"><span>${ax.label}</span><i>${blocks}</i><span>${vals ? vals[k] : "–"}</span></div>`;
  }).join("")}</div>`;
}

// ---- Sprites ----

// A track's sprite, for track objects and table rows alike (both carry gi/ti)
export function spriteOf(t) {
  const track = t && GAMES[t.gi] && GAMES[t.gi].tracks[t.ti];
  return track ? SPRITES[GAMES[t.gi].id + "|" + track.name] : null;
}

// A sprite image at the largest whole-number scale that fits the box (at most maxK); a sprite bigger than the box
// is shrunk to fit instead, and drawn smoothly.
// r is the sprite's pixel density: Mega Man 7's Super NES sprites and Mega Man 8's and & Bass's (r:2) are drawn with
// about twice as many pixels as the NES and Game Boy ones, so they're scaled by half as much to come out the same size.
export function sprImg(s, box, cls = "", maxK = Infinity) {
  const r = s.r || 1, size = Math.max(s.w, s.h) / r;
  const k = Math.min(maxK, Math.floor(box / size));
  const scale = (k < 1 ? box / size : k) / r, soft = scale < 1;
  return `<img class="spr${cls ? " " + cls : ""}${soft ? " soft" : ""}" src="${s.src}" alt="" loading="lazy" width="${Math.round(s.w * scale)}" height="${Math.round(s.h * scale)}">`;
}

// A track's sprite in one of the page's standard sizes: "spr-ghost" (the big faint one on cards), "spr-banner",
// or a small inline one
export function sprite(t, cls = "") {
  const s = spriteOf(t);
  if (!s) return "";
  if (cls === "spr-ghost") return sprImg(s, 200, "spr-ghost", 4);
  const banner = cls === "spr-banner";
  return `<span class="sprbox ${cls}">${sprImg(s, banner ? 48 : 28, "", banner ? 1 : Infinity)}</span>`;
}

// ---- Badges ----

export const badgeIcon = b => `<span class="ticon ${b.cls || ""}" role="img" aria-label="${b.tip}" data-tip="${b.tip}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${BADGE_ICONS[b.icon]}" fill="currentColor"/></svg></span>`;
