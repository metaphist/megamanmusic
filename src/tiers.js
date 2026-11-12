// The tier list page: every track's ratings (loaded by model.js from data/scores.csv; blank = not graded yet), grouped
// by the letter grade they add up to. See grades.js for the grading.
import { RELEASE_ORDER, tableTitle, trackKey, trackOf } from "./model.js";
import { GRADES, METRICS, RATINGS, gradeOf, rangeOf, totalOf } from "./grades.js";
import { spriteOf, sprImg } from "./draw.js";
import { ICON_PLAY, ICON_STOP, ICON_INFO } from "../data/icons.js";
import { inkOn } from "./colors.js";
import { liveAudio } from "./live.js";
import { $, esc, plural, setupTheme, track } from "./util.js";

// Every named track in release order, with its ratings (null when it isn't graded yet)
const ENTRIES = RELEASE_ORDER.flatMap(g => g.tracks.filter(t => t.name !== "???").map(t => (
  { t, g, ratings: t.ratings, total: t.ratings ? totalOf(t.ratings) : null }
)));

// A track's tile. One with audio is a button that plays it, and stops it on the next click.
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
  // The profile link sits beside the tile rather than in it, since a link can't go inside the play button
  const info = `<a class="tl-info" href="robot-master.html#${trackKey(t)}" aria-label="${esc(t.name)} profile" title="Profile">${ICON_INFO}</a>`;
  return t.audio
    ? `<li data-game="${g.id}"><button type="button" class="tl-tile" data-play="${trackKey(t)}" aria-pressed="false" aria-label="Play ${esc(label)}"${t.vals ? ` style="--track-ink:${inkOn(t.vals)}"` : ""}>
        <span class="tl-pi"><span class="i-play">${ICON_PLAY}</span><span class="i-stop">${ICON_STOP}</span></span>${body}</button>${info}</li>`
    : `<li data-game="${g.id}"><div class="tl-tile" role="group" aria-label="${esc(label)}">${body}</div>${info}</li>`;
}

// ---- The player ----

// One player for the page, so starting a track stops the one before it
export const player = new Audio();
const live = liveAudio(player);
let current = null;   // the key of the track the player was last given
let frameId = 0, flickering = null;   // the running animation, and the swatch it flickers

// Marks the tile of the track that's playing
function markPlaying() {
  document.querySelectorAll("[data-play]").forEach(b => b.setAttribute("aria-pressed", b.dataset.play === current && !player.paused));
}

// Plays a track from the start, or stops it if it's the one playing
function togglePlay(key) {
  if (key === current && !player.paused) { player.pause(); return; }
  const t = trackOf(key);
  current = key;
  if (!player.src.endsWith(t.audio)) player.src = t.audio;
  player.currentTime = 0;
  live.connect();
  player.play()
    .then(() => track("play_track", { track_name: t.name, game_id: t.game.id, game_title: t.game.title, custom_list: false }))
    .catch(() => { })   // interrupted by another click, or blocked by the browser
    .finally(markPlaying);
  markPlaying();
}

// The playing tile is filled with its track color, and that color flickers with the music
function startFlicker() {
  stopFlicker();
  if (!live.connected()) return;
  flickering = document.querySelector(`[data-play="${current}"] .tl-swatch`);
  const frame = () => {
    frameId = requestAnimationFrame(frame);
    live.update();
    flickering.style.filter = live.flickerFilter();
  };
  frameId = requestAnimationFrame(frame);
}

function stopFlicker() {
  cancelAnimationFrame(frameId);
  if (flickering) flickering.style.filter = "";
  flickering = null;
  live.reset();
}

function setupPlayer() {
  $("tiers").addEventListener("click", e => {
    const b = e.target.closest("[data-play]");
    if (b) togglePlay(b.dataset.play);
  });
  ["play", "pause", "ended"].forEach(e => player.addEventListener(e, markPlaying));
  player.addEventListener("playing", startFlicker);
  ["pause", "ended", "emptied"].forEach(e => player.addEventListener(e, stopFlicker));
}

// A tier's row: its letter and range of totals, then its tracks (the game filter fills in its label and what shows)
function tier(id, letter, range, entries) {
  return `<section class="tl-tier tl-${id}" data-tier="${id}" data-name="${id === "none" ? "Not graded" : `Grade ${letter}`}">
    <div class="tl-letter"><div><b>${letter}</b><span>${range}</span></div></div>
    <ol class="tl-tiles">${entries.map(tile).join("")}</ol>
    <p class="tl-empty"></p>
  </section>`;
}

function renderTiers(entries) {
  const graded = entries.filter(e => e.ratings);
  const rows = GRADES.map(g => {
    // Highest total first; ties stay in release order
    const inGrade = graded.filter(e => gradeOf(e.ratings) === g).sort((a, b) => b.total - a.total);
    return tier(g.letter, g.letter, rangeOf(g), inGrade);
  });
  const ungraded = entries.filter(e => !e.ratings);
  if (ungraded.length) rows.push(tier("none", "–", "Not graded", ungraded));
  $("tiers").innerHTML = rows.join("");
}

// ---- Game filter ----

// Shows one game's tiles, or every game's. Tiles are hidden rather than redrawn, so a track that's playing carries on.
// An empty grade keeps its row, to show where the game falls short, but "Not graded" goes away when it's empty.
// The link follows along (?game=mm2), keeping any other query parameters.
function applyGameFilter() {
  const game = $("tlGame").value;
  let shown = 0, total = 0;
  document.querySelectorAll(".tl-tier").forEach(row => {
    const items = [...row.querySelectorAll("li")];
    items.forEach(li => { li.hidden = !!game && li.dataset.game !== game; });
    const n = items.filter(li => !li.hidden).length;
    row.querySelector(".tl-tiles").hidden = !n;
    const empty = row.querySelector(".tl-empty");
    empty.hidden = !!n;
    empty.textContent = game ? "No tracks from this game" : "No tracks yet";
    row.setAttribute("aria-label", `${row.dataset.name}: ${plural(n, "track")}`);
    if (row.dataset.tier === "none") row.hidden = !n;
    shown += n;
    total += items.length;
  });
  $("tlCount").textContent = game ? `Showing ${shown} of ${plural(total, "track")}` : plural(total, "track");
  const q = new URLSearchParams(location.search);
  if (game) q.set("game", game); else q.delete("game");
  const query = q.toString();
  try { history.replaceState(history.state, "", location.pathname + (query ? "?" + query : "")); } catch (e) { }
}

function setupGameFilter() {
  const select = $("tlGame");
  select.innerHTML += RELEASE_ORDER.map(g => `<option value="${g.id}">${esc(g.title)}</option>`).join("");
  select.value = new URLSearchParams(location.search).get("game") || "";
  if (select.selectedIndex < 0) select.value = "";   // a link to a game that doesn't exist
  select.addEventListener("change", applyGameFilter);
  $("tlFilters").hidden = false;
  applyGameFilter();
}

function renderKey() {
  $("metrics").innerHTML = METRICS.map(m => `<li><b>${m.label}</b><span>${m.question}</span></li>`).join("");
  $("ratings").innerHTML = RATINGS.map((word, k) => `<li><b>${k + 1}</b><span>${word}</span></li>`).join("");
  $("gradeKey").innerHTML = GRADES.map(g => `<tr class="tl-${g.letter}">
    <th scope="row"><span class="tl-chip">${g.letter}</span></th>
    <td class="n">${rangeOf(g)}</td>
    <td>${g.word}</td>
  </tr>`).join("");
}

setupTheme();
renderKey();
setupPlayer();
// With no ratings at all the scores file didn't load, so there's no list to show
if (ENTRIES.some(e => e.ratings)) { renderTiers(ENTRIES); setupGameFilter(); }
else $("tiers").innerHTML = `<p class="tl-empty">Couldn't load the rankings. Try reloading the page.</p>`;
