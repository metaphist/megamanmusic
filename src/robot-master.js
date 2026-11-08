// The robot master profile page: one track's color, tier grade, song structure, color neighbors and the rest of its
// game, all worked out from the data. Pick the track with ?track=<game>.<index> (like mm5.3); Gyro Man is the default.
import { GAMES, AXES, trackKey, trackOf } from "./model.js";
import { inkOn, fmt, channel } from "./colors.js";
import { GRADES, METRICS, RATINGS, gradeOf, totalOf } from "./grades.js";
import { SPRITES } from "../data/sprites.js";
import { $, esc, setupTheme } from "./util.js";

const DEFAULT = "mm5|Gyro Man";
const ALL = GAMES.flatMap(g => g.tracks);
const GRADED = ALL.filter(t => t.ratings);
const player = $("player");

// ---- Data the model doesn't load ----

// Modern artwork, keyed like the sprites ("mm5|Gyro Man")
async function loadArt() {
  try {
    const r = await fetch("art/sources.json");
    if (!r.ok) throw new Error(r.status);
    return new Map((await r.json()).map(a => [a.game + "|" + a.name, "art/" + a.file]));
  } catch (e) { return new Map(); }
}

// Song structures from ranking.md's range notes, like "i a b o", keyed like the sprites. Each note names its track by
// the start of its name ("gyro"), and a few by a nickname.
const NICKNAMES = { flower: "plant", skill: "skull", phar: "pharaoh", grav: "gravity" };
async function loadStructures() {
  const out = new Map();
  try {
    const r = await fetch("ranking.md", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    let game = null;
    for (const line of (await r.text()).split(/\r?\n/)) {
      const h = line.match(/^#{2,3}\s+(mm\S*)\s*$/);
      if (h) { game = GAMES.find(g => g.id === h[1].replace("&", "")); continue; }
      const m = line.match(/^-\s*(\w+):\s*(.+?)\s*\((\d)\)\s*$/);
      if (!m || !game) continue;
      const start = NICKNAMES[m[1]] || m[1];
      const hits = game.tracks.filter(t => t.name.toLowerCase().startsWith(start));
      if (hits.length === 1) out.set(game.id + "|" + hits[0].name, { notes: m[2].split(/\s+/), score: +m[3] });
    }
  } catch (e) { }
  return out;
}

const [ART, STRUCTURES] = await Promise.all([loadArt(), loadStructures()]);
const keyOf = t => t.game.id + "|" + t.name;

// ---- Pieces ----

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

// Where a total stands among some graded tracks: "2nd" or "tied for 2nd", plus how many share it
function standing(t, pool) {
  const total = totalOf(t.ratings);
  const place = pool.filter(o => totalOf(o.ratings) > total).length + 1;
  const tied = pool.filter(o => o !== t && totalOf(o.ratings) === total);
  return { place, tied, of: pool.length, text: (tied.length ? "tied for " : "") + ordinal(place) };
}

function portrait(t, cls = "") {
  const art = ART.get(keyOf(t));
  if (art) return `<img class="rm-art ${cls}" src="${art}" alt="">`;
  const s = SPRITES[keyOf(t)];
  return s ? `<img class="rm-art rm-sprite ${cls}" src="${s.src}" width="${s.w}" height="${s.h}" alt="">` : "";
}

// Five pips with the first n lit
const pips = (n, cls) => `<span class="rm-pips ${cls}" aria-hidden="true">${[1, 2, 3, 4, 5].map(i =>
  `<i${i <= n ? ' class="on"' : ""}></i>`).join("")}</span>`;

function hero(t) {
  const g = t.game, ink = t.vals ? inkOn(t.vals) : "var(--ink)";
  const style = t.color ? `--c:${t.color};--ink-on:${ink}` : "";
  return `<section class="rm-hero${t.color ? "" : " rm-plain"}" style="${style}">
    <div class="rm-hero-art">${portrait(t)}</div>
    <div class="rm-hero-text">
      <p class="eyebrow">${esc(g.title)}${g.year ? " · " + g.year : ""}${t.dln ? " · " + esc(t.dln) : ""}</p>
      <h1>${esc(t.name)}</h1>
      ${g.composer ? `<p class="rm-composer">Music by ${esc(g.composer)}</p>` : ""}
      ${t.audio ? `<button type="button" class="rm-play" id="rmPlay" data-testid="rm-play" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" fill="currentColor" d="M8 5h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2H8V5Z"/><path class="i-stop" fill="currentColor" d="M6 6h12v12H6z"/></svg>
        <span>Play theme</span></button>` : ""}
    </div>
    <div class="rm-badges">
      ${t.color ? `<div class="rm-badge"><span class="rm-sw" style="background:${t.color}"></span><b>${esc(t.cname)}</b><code>${t.color}</code></div>` : ""}
      ${t.ratings ? (() => { const gr = gradeOf(t.ratings); return `<div class="rm-badge tl-${gr.letter}"><span class="rm-grade">${gr.letter}</span><b>${gr.word}</b><code>${totalOf(t.ratings)} / 15</code></div>`; })() : ""}
    </div>
  </section>`;
}

function colorSection(t) {
  if (!t.vals) return `<section class="rm-card"><h2 class="sh">Color</h2><p class="hint">Not scored yet.</p></section>`;
  const avg = t.game.avg;
  const uniq = ALL.filter(o => o.code === t.code);
  const rows = AXES.map((ax, k) => {
    const pos = v => `${(v - 1) / 4 * 100}%`;
    return `<div class="rm-axis">
      <div class="rm-axis-head"><b class="ch-${"rgb"[k]}">${ax.label}</b><span class="rm-num">${t.vals[k]}<small> · ${channel(t.vals[k])}</small></span></div>
      <div class="rm-track" style="--ax:var(${ax.tok})">
        <span class="rm-fill" style="width:${pos(t.vals[k])}"></span>
        ${avg ? `<span class="rm-avg" style="left:${pos(avg[k])}" title="${esc(t.game.title)} average: ${fmt(avg[k])}"></span>` : ""}
      </div>
      <div class="rm-ends"><span>${ax.lo}</span><span>${ax.hi}</span></div>
    </div>`;
  }).join("");
  return `<section class="rm-card" aria-labelledby="rmColorHead">
    <h2 class="sh" id="rmColorHead">Color</h2>
    <p class="hint">Each score from 1 to 5 sets one channel: Energy is red, Density green and Gravity blue.</p>
    <div class="rm-colorhead">
      <span class="rm-swatch" style="background:${t.color}"></span>
      <div><b>${esc(t.cname)}</b><code>${t.color} · ${t.code.split("").join("-")}</code>
        <span class="rm-sub">${uniq.length === 1 ? "The only track with this color" : `Shared with ${uniq.length - 1} other track${uniq.length > 2 ? "s" : ""}`}</span></div>
    </div>
    ${rows}
    ${avg ? `<p class="hint"><span class="rm-avgkey"></span> ${esc(t.game.title)} average (${esc(t.game.cname)}, <code>${t.game.color}</code>)</p>` : ""}
  </section>`;
}

function tierSection(t) {
  if (!t.ratings) return `<section class="rm-card"><h2 class="sh">Tier</h2><p class="hint">Not graded yet.</p></section>`;
  const gr = gradeOf(t.ratings), total = totalOf(t.ratings);
  const all = standing(t, GRADED), inGame = standing(t, GRADED.filter(o => o.game === t.game));
  const next = GRADES[GRADES.indexOf(gr) - 1];
  const rows = METRICS.map((m, k) => `<div class="rm-metric">
      <div class="rm-axis-head"><b>${m.label}</b><span class="rm-num">${t.ratings[k]} <small>${RATINGS[t.ratings[k] - 1]}</small></span></div>
      ${pips(t.ratings[k], "tier")}
      <span class="rm-q">${m.question}</span>
    </div>`).join("");
  return `<section class="rm-card tl-${gr.letter}" aria-labelledby="rmTierHead">
    <h2 class="sh" id="rmTierHead">Tier</h2>
    <div class="rm-colorhead">
      <span class="rm-swatch rm-grade">${gr.letter}</span>
      <div><b>${gr.word}</b><code>${total} / 15</code>
        <span class="rm-sub">${next ? `${next.min - total} point${next.min - total > 1 ? "s" : ""} short of ${next.letter}` : "The top grade"}</span></div>
    </div>
    ${rows}
    <dl class="rm-stand">
      <div><dt>Overall</dt><dd><b>${all.text}</b> of ${all.of}</dd></div>
      <div><dt>${esc(t.game.title)}</dt><dd><b>${inGame.text}</b> of ${inGame.of}</dd></div>
    </dl>
  </section>`;
}

// The range notes as a strip of sections: intros and outros muted, each unique inner section its own shade
function structureSection(t) {
  const s = STRUCTURES.get(keyOf(t));
  if (!s) return "";
  const letters = [...new Set(s.notes.map(n => n[0]).filter(l => /[a-e]/.test(l)))];
  const label = n => n.startsWith("i(") ? "intro, repeated in the loop" : n.startsWith("i-") ? "tiny intro" : n[0] === "i" ? "intro"
    : n[0] === "o" ? "outro" : "section " + n[0].toUpperCase() + (n.endsWith("+") ? ", extended" : "");
  const blocks = s.notes.map(n => {
    const k = letters.indexOf(n[0]);
    const cls = n[0] === "i" ? "intro" : n[0] === "o" ? "outro" : "inner";
    const shade = k >= 0 ? `style="--k:${k / Math.max(1, letters.length - 1)}"` : "";
    return `<li class="rm-sec ${cls}${n.startsWith("i-") ? " tiny" : ""}" ${shade} title="${label(n)}"><b>${esc(n)}</b><span>${label(n)}</span></li>`;
  }).join("");
  return `<section class="rm-card rm-wide" aria-labelledby="rmStructHead" style="--c:${t.color || "var(--muted)"}">
    <h2 class="sh" id="rmStructHead">Structure</h2>
    <p class="hint">Range counts the unique sections, one point each. Repeats count once.</p>
    <ol class="rm-secs">${blocks}</ol>
    <p class="hint">${s.notes.length} parts, ${s.score} unique: a range of <b>${s.score}</b>.</p>
  </section>`;
}

function tile(o, current) {
  const gr = o.ratings && gradeOf(o.ratings);
  return `<a class="rm-tile${o === current ? " me" : ""}" href="?track=${trackKey(o)}" style="--c:${o.color || "var(--grid)"}" ${o === current ? 'aria-current="page"' : ""}>
    <span class="rm-tile-art">${portrait(o)}</span>
    <span class="rm-tile-name">${esc(o.name)}</span>
    <span class="rm-tile-meta">${o.cname ? esc(o.cname) : "Unscored"}${gr ? ` · <b class="rm-mini tl-${gr.letter}">${gr.letter}</b>` : ""}</span>
  </a>`;
}

function neighborsSection(t) {
  if (!t.vals) return "";
  const near = ALL.filter(o => o !== t && o.vals)
    .map(o => ({ o, d: Math.hypot(...o.vals.map((v, i) => v - t.vals[i])) }))
    .sort((a, b) => a.d - b.d || (totalOf(b.o.ratings || [0]) - totalOf(a.o.ratings || [0]))).slice(0, 6);
  return `<section class="rm-card rm-wide" aria-labelledby="rmNearHead">
    <h2 class="sh" id="rmNearHead">Color Neighbors</h2>
    <p class="hint">The six closest colors across every game.</p>
    <div class="rm-tiles">${near.map(n => tile(n.o, t)).join("")}</div>
  </section>`;
}

function gameSection(t) {
  const g = t.game;
  return `<section class="rm-card rm-wide" aria-labelledby="rmGameHead">
    <h2 class="sh" id="rmGameHead">${esc(g.title)}</h2>
    <div class="rm-tiles">${g.tracks.map(o => tile(o, t)).join("")}</div>
  </section>`;
}

// ---- Page ----

function render(t) {
  document.title = `${t.name} · Robot Master Profile`;
  $("rmPick").value = trackKey(t);
  $("profile").innerHTML = hero(t)
    + `<div class="rm-grid">${colorSection(t)}${tierSection(t)}${structureSection(t)}${neighborsSection(t)}${gameSection(t)}</div>`;
  frameOpaqueArt();
  stop();
  $("rmPlay")?.addEventListener("click", () => player.paused || player.dataset.key !== trackKey(t) ? play(t) : stop());
}

// Some artwork (most of Mega Man 7, 8, & Bass and V) has a solid white background instead of transparency.
// Those go in a framed box rather than straight onto the track's color.
const opaque = new Map();
function frameOpaqueArt() {
  document.querySelectorAll("img.rm-art:not(.rm-sprite)").forEach(img => {
    const check = () => {
      if (!opaque.has(img.src)) {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 1;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
          opaque.set(img.src, ctx.getImageData(0, 0, 1, 1).data[3] > 250);
        } catch (e) { opaque.set(img.src, false); }
      }
      img.classList.toggle("rm-boxed", opaque.get(img.src));
    };
    img.complete && img.naturalWidth ? check() : img.addEventListener("load", check, { once: true });
  });
}

function play(t) {
  player.src = t.audio;
  player.dataset.key = trackKey(t);
  player.currentTime = 0;
  player.play().catch(() => { });
}
function stop() { player.pause(); }
player.addEventListener("play", () => setPlaying(true));
player.addEventListener("pause", () => setPlaying(false));
player.addEventListener("ended", () => setPlaying(false));
function setPlaying(on) {
  const b = $("rmPlay");
  if (!b) return;
  b.setAttribute("aria-pressed", on);
  b.querySelector("span").textContent = on ? "Stop" : "Play theme";
}

function current() {
  const key = new URLSearchParams(location.search).get("track");
  const t = key && trackOf(key);
  return t || ALL.find(o => keyOf(o) === DEFAULT);
}

function setupPicker() {
  $("rmPick").innerHTML = GAMES.map(g => `<optgroup label="${esc(g.title)}">${g.tracks.map(t =>
    `<option value="${trackKey(t)}">${esc(t.name)}</option>`).join("")}</optgroup>`).join("");
  $("rmPick").addEventListener("change", e => {
    history.pushState(null, "", "?track=" + e.target.value);
    render(trackOf(e.target.value));
    scrollTo({ top: 0 });
  });
}

// Tiles move between profiles without reloading, and the back button follows
document.addEventListener("click", e => {
  const a = e.target.closest("a.rm-tile");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  history.pushState(null, "", a.getAttribute("href"));
  render(current());
  scrollTo({ top: 0, behavior: "smooth" });
});
addEventListener("popstate", () => render(current()));

setupTheme();
setupPicker();
render(current());
