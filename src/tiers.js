// The tier list page: every track's ratings from data/ranking.csv (game,name,expression,synergy,arrangement; blank
// ratings = not graded yet), grouped by the letter grade they add up to. See grades.js for the grading.
import { RELEASE_ORDER, parseScores, selectable, tableTitle } from "./model.js";
import { GRADES, METRICS, RATINGS, gradeOf, totalOf } from "./grades.js";
import { spriteOf, sprImg } from "./draw.js";
import { $, esc, plural, setupTheme } from "./util.js";

async function loadRatings() {
  const r = await fetch("data/ranking.csv", { cache: "no-cache" });
  if (!r.ok) throw new Error("ranking.csv " + r.status);
  return parseScores(await r.text());
}

// Every named track in release order, with its ratings (null when it isn't graded yet)
function entriesFrom(codes) {
  return RELEASE_ORDER.flatMap(g => g.tracks.filter(t => t.name !== "???").map(t => {
    const code = codes.get(g.id + "|" + t.name);
    const ratings = code ? [...code].map(Number) : null;
    return { t, g, ratings, total: ratings ? totalOf(ratings) : null };
  }));
}

// A track's tile. One that can be played links to it in the visualizer.
function tile({ t, g, ratings, total }) {
  const s = spriteOf(t);
  const scores = ratings
    ? `<span class="tl-scores"><span>${ratings.join(" ")}</span><b>${total}</b></span>`
    : `<span class="tl-scores tl-none">Not graded</span>`;
  const label = `${t.name}, ${g.title}` + (ratings
    ? ": " + METRICS.map((m, k) => `${m.label.toLowerCase()} ${ratings[k]}`).join(", ") + `, total ${total}`
    : ": not graded");
  const body = `<span class="tl-swatch"${t.color ? ` style="background:${t.color}"` : ""}></span>
    <span class="tl-spr">${s ? sprImg(s, 128, "", 2) : ""}</span>
    <span class="tl-name">${esc(t.name)}</span>
    <span class="tl-game" title="${esc(g.title)}">MM ${esc(tableTitle(g))}</span>
    ${scores}`;
  return selectable(t)
    ? `<li><a class="tl-tile" href="./?game=${g.id}&amp;track=${t.ti}" aria-label="${esc(label)}">${body}</a></li>`
    : `<li><div class="tl-tile" role="group" aria-label="${esc(label)}">${body}</div></li>`;
}

// A tier's row: its letter and range of totals, then its tracks
function tier(id, letter, range, entries) {
  const tiles = entries.length ? `<ol class="tl-tiles">${entries.map(tile).join("")}</ol>` : `<p class="tl-empty">No tracks yet</p>`;
  return `<section class="tl-tier tl-${id}" data-tier="${id}" aria-label="${id === "none" ? "Not graded" : `Grade ${letter}`}: ${plural(entries.length, "track")}">
    <div class="tl-letter"><div><b>${letter}</b><span>${range}</span></div></div>
    ${tiles}
  </section>`;
}

function renderTiers(entries) {
  const graded = entries.filter(e => e.ratings);
  const rows = GRADES.map(g => {
    // Highest total first; ties stay in release order
    const inGrade = graded.filter(e => gradeOf(e.ratings) === g).sort((a, b) => b.total - a.total);
    return tier(g.letter, g.letter, `${g.min}–${g.max}`, inGrade);
  });
  const ungraded = entries.filter(e => !e.ratings);
  if (ungraded.length) rows.push(tier("none", "–", "Not graded", ungraded));
  $("tiers").innerHTML = rows.join("");
}

function renderKey() {
  $("metrics").innerHTML = METRICS.map(m => `<li><b>${m.label}</b><span>${m.question}</span></li>`).join("");
  $("ratings").innerHTML = RATINGS.map((word, k) => `<li><b>${k + 1}</b><span>${word}</span></li>`).join("");
  $("gradeKey").innerHTML = GRADES.map(g => `<tr class="tl-${g.letter}">
    <th scope="row"><span class="tl-chip">${g.letter}</span></th>
    <td class="n">${g.min}–${g.max}</td>
    <td>${g.word}</td>
  </tr>`).join("");
}

setupTheme();
renderKey();
try {
  renderTiers(entriesFrom(await loadRatings()));
} catch (e) {
  console.error("Couldn't load the rankings", e);
  $("tiers").innerHTML = `<p class="tl-empty">Couldn't load the rankings. Try reloading the page.</p>`;
}
