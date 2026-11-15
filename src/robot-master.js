// The robot master profile page: one track's color, tier grade, song structure, color neighbors and the rest of its
// game, all worked out from the data. Pick the track with #<game>.<index> (like #mm5.3); Gyro Man is the default.
import { GAMES, AXES, trackKey, trackOf, shortTitle, rangeOf, rangeParts, rangeRating, selectable } from "./model.js";
import { spriteOf, sprImg } from "./draw.js";
import { inkOn, fmt, channel } from "./colors.js";
import { GRADES, METRICS, RATINGS, gradeOf, totalOf, gem, specialOf } from "./grades.js";
import { portrait, artKey as keyOf } from "./art.js";
import { $, esc, setupTheme, track, readStored, writeStored } from "./util.js";
import { ICON_INFO_TIP, ICON_STAR } from "../data/icons.js";

const DEFAULT = "mm5|Gyro Man";
const ALL = GAMES.flatMap(g => g.tracks);
const GRADED = ALL.filter(t => t.ratings);
const player = $("player");

// ---- Pieces ----

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

// Where a total stands among some graded tracks: "2nd" or "tied for 2nd", plus how many share it
function standing(t, pool) {
  const total = totalOf(t.ratings);
  const place = pool.filter(o => totalOf(o.ratings) > total).length + 1;
  const tied = pool.filter(o => o !== t && totalOf(o.ratings) === total);
  return { place, tied, of: pool.length, text: (tied.length ? "tied for " : "") + ordinal(place) };
}

// Five pips with the first n lit; extra (like " special") is added to the lit ones
const pips = (n, cls, extra = "") => `<span class="rm-pips ${cls}" aria-hidden="true">${[1, 2, 3, 4, 5].map(i =>
  `<i${i <= n ? ` class="on${extra}"` : ""}></i>`).join("")}</span>`;

function hero(t) {
  const g = t.game, ink = t.vals ? inkOn(t.vals) : "var(--ink)";
  const style = t.color ? `--c:${t.color};--ink-on:${ink}` : "";
  return `<section class="rm-hero${t.color ? "" : " rm-plain"}" style="${style}">
    <div class="rm-hero-art">${portrait(t)}</div>
    <div class="rm-hero-text">
      <span class="eyebrow">${esc(g.title)}${g.year ? " · " + g.year : ""}${t.dln ? " · " + esc(t.dln) : ""}</span>
      <h1>${esc(t.name)}</h1>
      ${g.composer ? `<p class="rm-composer">Music by ${esc(g.composer)}</p>` : ""}
      ${t.audio ? `<button type="button" class="rm-play" id="rmPlay" data-testid="rm-play" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-play" fill="currentColor" d="M8 5h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2H8V5Z"/><path class="i-stop" fill="currentColor" d="M6 6h12v12H6z"/></svg>
        <span>Play theme</span></button>` : ""}
    </div>
    ${selectable(t) ? `<button type="button" class="rm-fav" id="rmFav" data-testid="rm-fav" aria-pressed="false" aria-label="Favorite ${esc(t.name)}, ${esc(g.title)}">${ICON_STAR}</button>` : ""}
    <div class="rm-badges">
      ${t.color ? `<div class="rm-badge"><span class="rm-sw" style="background:${t.color}"></span><b>${esc(t.cname)}</b><code>${t.color}</code></div>` : ""}
      ${t.ratings ? (() => { const gr = gradeOf(t.ratings); return `<div class="rm-badge tl-${gr.letter}"><span class="rm-grade${specialOf(gr.letter)}">${gr.letter}</span><b>${gr.word}</b><code>${totalOf(t.ratings)} / 15</code></div>`; })() : ""}
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
    <div class="shead">
      <h2 class="sh" id="rmColorHead">Color</h2>
      <a class="cinfo-btn rm-headlink" href="colors.html?game=${t.game.id}${selectable(t) ? `&track=${t.game.tracks.indexOf(t)}` : ""}" aria-label="See ${esc(t.name)} on the colors page" title="Colors page">${ICON_INFO_TIP}</a>
    </div>
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
      ${pips(t.ratings[k], "tier", specialOf(gr.letter))}
      <span class="rm-q">${m.question}</span>
    </div>`).join("");
  return `<section class="rm-card tl-${gr.letter}" aria-labelledby="rmTierHead">
    <div class="shead">
      <h2 class="sh" id="rmTierHead">Tier</h2>
      <a class="cinfo-btn rm-headlink" href="tiers.html?game=${t.game.id}" aria-label="See the ${esc(t.game.title)} tier list" title="Tier list">${ICON_INFO_TIP}</a>
    </div>
    <div class="rm-colorhead">
      <span class="rm-swatch rm-grade${specialOf(gr.letter)}">${gr.letter}</span>
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

// A count of half points as text: 3.5 is "3½", .5 is "½"
const halves = n => (Math.floor(n) || (n % 1 ? "" : "0")) + (n % 1 ? "½" : "");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// How a structure's range adds up, like "2 unique sections, 1 intro (+½), 1 outro (+½): a range of 3"
function rangeWorking(notes) {
  const p = rangeParts(notes), score = rangeOf(notes), rating = rangeRating(notes);
  const parts = [plural(p.letters, "unique section"),
    p.intros && `${plural(p.intros, "intro")} (+${halves(p.intros / 2)})`,
    p.outros && `${plural(p.outros, "outro")} (+${halves(p.outros / 2)})`,
    p.extended && `${plural(p.extended, "extension")} (+${halves(p.extended / 2)})`,
    p.shortened && `${plural(p.shortened, "tiny intro")} (−${halves(p.shortened / 2)})`].filter(Boolean);
  const how = score > 5 ? "capped at" : score < 1 ? "raised to" : score !== rating ? "rounded down to" : "";
  return `${parts.join(", ")}: ${how ? `${halves(score)}, ${how} a range of` : "a range of"} <b>${rating}</b>.`;
}

// The structure column as a strip of sections: intros and outros muted, each unique inner section its own shade
function structureSection(t) {
  if (!t.structure) return "";
  const s = { notes: t.structure };
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
    <p class="hint">Range counts each unique section a point (repeats count once), each intro, outro and extension half
      a point, and takes half a point off for a tiny intro. A half rounds down.</p>
    <ol class="rm-secs">${blocks}</ol>
    <p class="hint">${rangeWorking(s.notes)}</p>
  </section>`;
}

function tile(o, current) {
  const gr = o.ratings && gradeOf(o.ratings);
  return `<a class="rm-tile${o === current ? " me" : ""}${gem(o) ? " is-gem" : ""}" href="#${trackKey(o)}" style="--c:${o.color || "var(--grid)"}" ${o === current ? 'aria-current="page"' : ""}>
    <span class="rm-tile-art">${portrait(o)}</span>
    <span class="rm-tile-name">${esc(o.name)}</span>
    <span class="rm-tile-meta">${o.cname ? esc(o.cname) : "Unscored"}${gr ? ` · <b class="rm-mini tl-${gr.letter}${specialOf(gr.letter)}">${gr.letter}</b>` : ""}</span>
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
  picked = t;
  $("rmPick").value = t.name;
  $("profile").innerHTML = hero(t)
    + `<div class="rm-grid">${colorSection(t)}${tierSection(t)}${structureSection(t)}${neighborsSection(t)}${gameSection(t)}</div>`;
  // A perfect ranking (S+) turns the page's color surfaces into gems
  $("profile").classList.toggle("is-gem", gem(t));
  frameOpaqueArt();
  stop();
  $("rmPlay")?.addEventListener("click", () => player.paused || player.dataset.key !== trackKey(t) ? play(t) : stop());
  $("rmFav")?.addEventListener("click", () => toggleFavorite(t));
  markFav(t);
}

// ---- Favorites ----

// The same favorites the home and colors pages keep (their "★ Favorites" playlist). Read fresh each time, so a
// star added on another page in the meantime isn't lost.
const FAVORITES_KEY = "rmcp-favorites";
const favorites = () => readStored(FAVORITES_KEY, []);

function markFav(t) {
  const b = $("rmFav");
  if (!b) return;
  const on = favorites().includes(trackKey(t));
  b.classList.toggle("on", on);
  b.setAttribute("aria-pressed", on);
  b.title = on ? "Remove from favorites" : "Add to favorites";
}

function toggleFavorite(t) {
  const key = trackKey(t), favs = favorites(), on = !favs.includes(key);
  writeStored(FAVORITES_KEY, on ? [...favs, key] : favs.filter(k => k !== key));
  markFav(t);
  track(on ? "favorite_add" : "favorite_remove", { track_name: t.name, game_id: t.game.id });
}

// Another tab changing the favorites updates the star here
addEventListener("storage", e => { if (e.key === FAVORITES_KEY && picked) markFav(picked); });

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

// The track is in the hash, like #mm5.3. Servers that tidy URLs (dropping ".html") can lose a query string when they
// redirect, but the browser keeps the hash. Older ?track=mm5.3 links still work.
function current() {
  const key = decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get("track");
  const t = key && trackOf(key);
  return t || ALL.find(o => keyOf(o) === DEFAULT);
}

// The quick switch: a typeahead over every track. Focusing it lists them all by game, scrolled to the current one;
// typing narrows the list by name, game or serial. Enter or a click opens the pick, and Escape or leaving the box puts
// the current track's name back.
let picked = null;
function setupPicker() {
  const input = $("rmPick"), list = $("rmPickList");
  const norm = x => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pool = GAMES.flatMap((g, gi) => g.tracks.map(t => ({
    t, gi, name: norm(t.name), hay: norm(`${t.name} ${g.title} ${shortTitle(g)} ${g.id} ${t.dln || ""}`),
  })));
  let hits = [], sel = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    sel = -1;
  };
  const revert = () => { close(); if (picked) input.value = picked.name; };
  const mark = (i, block = "nearest") => {
    sel = i;
    list.querySelectorAll("li[role=option]").forEach((li, k) => li.setAttribute("aria-selected", k === i ? "true" : "false"));
    const li = list.querySelector(`#rmp${i}`);
    if (li) { input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block }); }
    else input.removeAttribute("aria-activedescendant");
  };
  // Until something's typed (the box still shows the current name), every track under its game's heading. With a
  // query, names starting with it rank first, then names with a word starting with its first word, then game order.
  const show = (all = false) => {
    const q = all ? "" : norm(input.value), words = q.split(" ");
    hits = !q ? pool : pool.filter(p => words.every(w => p.hay.includes(w)))
      .map(p => ({ ...p, rank: p.name.startsWith(q) ? 0 : p.name.split(" ").some(w => w.startsWith(words[0])) ? 1 : 2 }))
      .sort((a, b) => a.rank - b.rank || a.gi - b.gi);
    let game = null;
    list.innerHTML = hits.length ? hits.map((p, i) => {
      const head = !q && p.t.game !== game ? `<li class="grp" role="presentation">${esc((game = p.t.game).title)}</li>` : "";
      return head + pickHit(p.t, i);
    }).join("") : `<li class="none" role="presentation">No robot master matches “${esc(input.value.trim())}”</li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (q) mark(hits.length ? 0 : -1);
    else mark(hits.findIndex(p => p.t === picked), "center");
  };
  const pick = i => {
    const h = hits[i];
    if (!h) return;
    close();
    input.blur();
    if (h.t === picked) input.value = picked.name;
    else location.hash = trackKey(h.t);
  };

  // Focus selects the name, so typing replaces it, and lists everything
  const untouched = () => input.value === picked?.name;
  input.addEventListener("focus", () => { input.select(); show(true); });
  input.addEventListener("click", () => { if (list.hidden) show(untouched()); });
  input.addEventListener("input", () => show());
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (list.hidden) return show(untouched());
      if (hits.length) mark(sel < 0 ? (e.key === "ArrowDown" ? 0 : hits.length - 1)
        : (sel + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
    } else if (e.key === "Enter") { e.preventDefault(); if (!list.hidden) pick(sel < 0 ? 0 : sel); }
    else if (e.key === "Escape") { e.preventDefault(); revert(); input.select(); }
  });
  // pointerdown keeps focus in the box until the pick lands
  list.addEventListener("pointerdown", e => {
    e.preventDefault();
    const li = e.target.closest("li[data-i]");
    if (li) pick(+li.dataset.i);
  });
  input.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== input) revert(); }, 120));
}

function pickHit(t, i) {
  const s = spriteOf(t);
  return `<li role="option" id="rmp${i}" aria-selected="false" data-i="${i}"${t === picked ? ' class="me"' : ""}>` +
    `<span class="sprbox">${s ? sprImg(s, 32, "", 1) : ""}</span>` +
    `<span><b>${esc(t.name)}</b><small>${esc(t.game.title)}${t.dln ? " · " + esc(t.dln) : ""}</small></span>` +
    `<i class="${t.vals ? "" : "empty"}" style="${t.vals ? `background:${t.color}` : ""}"></i></li>`;
}

// Picking a track, clicking a tile, and Back and Forward all change the hash, which redraws the profile
addEventListener("hashchange", () => {
  render(current());
  scrollTo({ top: 0, behavior: "smooth" });
});

setupTheme();
setupPicker();
render(current());
