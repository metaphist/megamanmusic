// colors.html: the color page, one view in the home page's style. The visualizer (viz.js) sits in the middle with the
// all-colors bar above it, and the report's summaries around it: the score distribution, the color comparison by game
// and the color buddies. Favorites and saved playlists share their storage with the deprecated colors-classic.html.
//
// Much of this follows app.js (colors-classic.html's script); the master list, track table, view switching and back
// button history are left out.
import { GAMES, AXES, RELEASE_ORDER, trackKey, trackOf, selectable, tableTitle } from "./model.js";
import { inkOn, intensity } from "./colors.js";
import { sprite, badgeIcon } from "./draw.js";
import { $, esc, track, readStored, writeStored, setupTheme } from "./util.js";
import { G, pinned, player, CUSTOM, initViz, setGame, setPinned, togglePinned, viewIndex, isPinned, applyCustom } from "./viz.js";
// ---- Link ----

// The address bar follows what's on screen (?game=mm2 or ?list=mm2.0,mmii.0, plus track=3), so it can be shared.
// It's replaced, not pushed, so Back leaves the page.
const LINK_KEYS = ["game", "list", "track"];

function syncLink() {
  if (!G) return;
  const q = new URLSearchParams(location.search);
  [...LINK_KEYS, "view"].forEach(k => q.delete(k));   // view=report is the old page's, so it's dropped
  // The page's opening view (the first game, nothing selected) keeps a plain link
  const plain = G === GAMES[0] && pinned == null;
  const ours = plain ? [] : [
    G.custom ? "list=" + G.tracks.map(trackKey).join(",") : "game=" + G.id,
    pinned != null ? "track=" + pinned : "",
  ].filter(Boolean);
  const query = [...ours, q.toString()].filter(Boolean).join("&");
  try { history.replaceState(null, "", location.pathname + (query ? "?" + query : "")); } catch (e) { }
}

// Older hash links read the same way: #mm2/3, #custom=mm2.0,mmii.0/1 and #report/mm2/3
function linkParams() {
  const q = new URLSearchParams(location.search);
  if (q.has("game") || q.has("list") || !location.hash) return q;
  let h = decodeURIComponent(location.hash).slice(1);
  if (h === "report" || h.startsWith("report/")) h = h.slice(7);
  const [target = "", idx = ""] = h.split("/");
  if (target.startsWith("custom")) q.set("list", target.split("=")[1] || "");
  else if (target) q.set("game", target);
  if (idx !== "") q.set("track", idx);
  return q;
}

function fromLink() {
  const q = linkParams(), idx = q.get("track") || "";
  if (q.has("list")) {
    const picks = q.get("list").split(",").filter(Boolean).map(trackOf).filter(t => t && selectable(t));
    applyCustom([...new Set(picks)]);
  } else {
    const start = GAMES.findIndex(g => g.id === q.get("game"));
    setGame(start < 0 ? 0 : start);
  }
  const t = idx === "" ? null : G.tracks[+idx];
  setPinned(t && selectable(t) ? +idx : null, false);
}

// The visualizer runs each pick through nav; here it only needs the link updated afterwards
function nav(fn) {
  fn();
  syncLink();
}

// Lands on the banner with the game or list's title, so on a phone (where the chart stacks above it) the playlist
// below it is in view
const scrollToViz = () => $("rSw").scrollIntoView({ behavior: "smooth", block: "start" });

// ---- Tracks across the page ----

const ROWS = GAMES.flatMap(g => g.tracks.map(t => ({
  gi: t.gi, ti: t.ti, game: g.title, name: t.name, cname: t.cname, color: t.color, vals: t.vals,
  total: t.vals ? intensity(t.vals) : null,
})));
const SCORED = ROWS.filter(r => r.vals);

// A click on a track outside the visualizer: toggled in place if it's on screen; otherwise its game is loaded first
function toggleTrack(gi, ti) {
  nav(() => {
    let k = viewIndex(gi, ti);
    if (k < 0) { setGame(gi); k = ti; }
    togglePinned(k);
  });
}

// Marks the selected track in the color bar and color buddies
function markTable() {
  const mark = (sel, gi = "gi", ti = "ti") => document.querySelectorAll(sel)
    .forEach(e => e.classList.toggle("on", isPinned(+e.dataset[gi], +e.dataset[ti])));
  mark("#buddies li button");
  mark("#colorbar button", "toGi", "toTi");
}

const trackClicks = (container, selector) => container.addEventListener("click", e => {
  const b = e.target.closest(selector);
  if (b) toggleTrack(+b.dataset.gi, +b.dataset.ti);
});

// ---- Color bar ----

// Every scored track's color in release order; a click plays it in the visualizer just below
function setupColorBar() {
  const bar = $("colorbar");
  bar.innerHTML = RELEASE_ORDER.flatMap(g => g.scored).map(t => `<button type="button" data-to-gi="${t.gi}" data-to-ti="${t.ti}" style="background:${t.color}" title="${esc(t.name)} · ${esc(t.game.title)} · ${t.color}" aria-label="Play ${esc(t.name)}, ${esc(t.game.title)}"></button>`).join("");
  bar.addEventListener("click", e => {
    const b = e.target.closest("[data-to-gi]");
    if (b) toggleTrack(+b.dataset.toGi, +b.dataset.toTi);
  });
}

// ---- Color comparison by game ----

function renderGameProfiles() {
  const box = $("compare");
  box.innerHTML = RELEASE_ORDER.filter(g => g.avg).map(gameProfile).join("");
  box.style.setProperty("--maxb", Math.max(0, ...GAMES.filter(g => g.avg).map(g => g.badges.length)));
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-game]");
    if (!b) return;
    // A color in the row's strip plays its track (loading its game), and the page stays where it is, like the color
    // bar. Anywhere else in the row loads the game and scrolls to it.
    const t = e.target.closest(".strip [data-gi]");
    if (t) { toggleTrack(+t.dataset.gi, +t.dataset.ti); return; }
    nav(() => setGame(+b.dataset.game));
    scrollToViz();
  });
}

function gameProfile(g) {
  const strip = [...g.scored].sort((a, b) => b.color.localeCompare(a.color))
    .map(t => `<span style="background:${t.color}" title="${t.name} ${t.color}" data-gi="${t.gi}" data-ti="${t.ti}"></span>`).join("");
  const averages = g.avg.map((v, k) => `<span class="ch-${"rgb"[k]}">${v.toFixed(1)}</span>`).join(" ");
  const total = intensity(g.avg).toFixed(1);
  return `<button type="button" class="crow" data-game="${GAMES.indexOf(g)}" aria-pressed="false">
    <span class="nm">${g.title}<small>${g.year || "upcoming"} · ${g.color}</small></span>
    <span class="ticons cbadges">${g.badges.map(badgeIcon).join("")}</span>
    <span class="big" style="background:${g.color}"></span>
    <span class="strip">${strip}</span>
    <span class="digits">${averages}<span class="ctot" title="Intensity: the sum of the three average scores (3–15)" aria-label="Intensity ${total}">${total}</span></span>
  </button>`;
}

// ---- Tooltips and info notes ----

function setupTooltips() {
  const tip = $("gtip");
  const tipOf = e => e.target.closest && e.target.closest("[data-tip]");
  document.addEventListener("mouseover", e => {
    const icon = tipOf(e);
    if (!icon) return;
    tip.textContent = icon.dataset.tip;
    tip.hidden = false;
    const r = icon.getBoundingClientRect(), half = tip.offsetWidth / 2;
    tip.style.left = Math.min(Math.max(r.left + r.width / 2, half + 8), innerWidth - half - 8) + "px";
    tip.style.top = r.top + "px";
  });
  document.addEventListener("mouseout", e => { if (tipOf(e)) tip.hidden = true; });
  addEventListener("scroll", () => tip.hidden = true, { passive: true });
}

function setupInfoNotes() {
  const btns = [...document.querySelectorAll(".cinfo-btn")];
  const closeAll = except => btns.forEach(b => { if (b !== except) b.setAttribute("aria-expanded", "false"); });
  btns.forEach(btn => btn.addEventListener("click", e => {
    e.stopPropagation();
    closeAll(btn);
    btn.setAttribute("aria-expanded", btn.getAttribute("aria-expanded") !== "true");
  }));
  document.addEventListener("click", () => closeAll());
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
}

// ---- Color buddies ----

function setupBuddies() {
  const byColor = new Map();
  SCORED.forEach(r => { if (!byColor.has(r.color)) byColor.set(r.color, []); byColor.get(r.color).push(r); });
  const groups = [...byColor.values()].filter(g => g.length > 1)
    .sort((a, b) => b.length - a.length || (b[0].total - a[0].total) || a[0].color.localeCompare(b[0].color));
  const box = $("buddies");
  box.innerHTML = groups.map(buddyGroup).join("");
  box.addEventListener("click", e => {
    const b = e.target.closest("li button");
    if (b) { toggleTrack(+b.dataset.gi, +b.dataset.ti); return; }
    const load = e.target.closest(".bud-load");
    if (load) {
      nav(() => applyCustom(groups[+load.dataset.k].map(t => GAMES[t.gi].tracks[t.ti])));
      scrollToViz();
    }
  });
}

function buddyGroup(group, k) {
  const r = group[0];
  const tracks = group.map(t => `<li><button type="button" data-gi="${t.gi}" data-ti="${t.ti}" aria-label="Play ${t.name}, ${t.game}"><span>${sprite(t, "spr-inline")}${t.name}</span><small>${tableTitle(GAMES[t.gi])}</small></button></li>`).join("");
  return `<div class="bud">
    <div class="bud-sw" style="background:${r.color};color:${inkOn(r.vals)}"><b>${r.cname}</b><span>${r.color}</span></div>
    <div class="bud-meta"><span class="digits">${r.vals.map((v, i) => `<span class="ch-${"rgb"[i]}">${v}</span>`).join(" ")}</span><span>${group.length} tracks</span></div>
    <ul>${tracks}</ul>
    <button type="button" class="bud-load" data-k="${k}">Load as playlist</button>
  </div>`;
}

// ---- Score distribution ----

const ibars = $("ibars"), itip = $("itip"), ibox = $("intensity"), metricTabs = $("metricTabs");
const METRICS = {
  total: { label: "Intensity", min: 3, max: 15, lo: "Low intensity", hi: "High intensity", val: r => r.total },
  ...Object.fromEntries(AXES.map((ax, k) => [k, {
    label: ax.label, min: 1, max: 5, lo: ax.lo, hi: ax.hi, cls: `ch-${"rgb"[k]}`, val: r => r.vals ? r.vals[k] : null,
  }])),
};
let metric = METRICS.total;

function renderDots() {
  const m = metric, steps = Array.from({ length: m.max - m.min + 1 }, (_, k) => k + m.min);
  const at = n => ROWS.filter(r => m.val(r) === n);
  ibox.style.setProperty("--n", steps.length);
  $("metricHead").textContent = `${m.label} Distribution`;
  ibars.setAttribute("aria-label", `Tracks by ${m.label.toLowerCase()}, ${m.min} to ${m.max}`);
  ibars.innerHTML = steps.map(n => `<div class="icol">${at(n).map(r =>
    `<button type="button" class="idot" style="background:${r.color}" data-gi="${r.gi}" data-ti="${r.ti}"
      aria-label="${r.name}, ${r.game}: ${m.label.toLowerCase()} ${n}, ${r.cname}"></button>`).join("")}</div>`).join("");
  $("iaxis").innerHTML = steps.map(n => `<span${m.cls ? ` class="${m.cls}"` : ""}>${n}<b>${at(n).length}</b></span>`).join("");
  $("iLo").textContent = m.lo;
  $("iHi").textContent = m.hi;
  itip.hidden = true;
  if (G) markIntensity();
}

// Highlights the dots of the tracks in the visualizer's game or playlist
function markIntensity() {
  const inView = new Set(G.tracks.map(t => t.gi + "." + t.ti));
  ibars.querySelectorAll(".idot").forEach(d => d.classList.toggle("cur", inView.has(d.dataset.gi + "." + d.dataset.ti)));
}

function showDotTip(dot) {
  const r = ROWS.find(r => r.gi === +dot.dataset.gi && r.ti === +dot.dataset.ti);
  const score = metric === METRICS.total ? `intensity ${r.total}` : `${metric.label.toLowerCase()} ${metric.val(r)}`;
  itip.innerHTML = `${sprite(r, "spr-tip")}<b>${r.name}</b> · ${r.game}<br><span>${GAMES[r.gi].tracks[r.ti].code}</span> · ${score} · ${r.cname}`;
  itip.hidden = false;
  const box = ibox.getBoundingClientRect(), p = dot.getBoundingClientRect();
  const half = itip.offsetWidth / 2, x = Math.min(Math.max(p.left + p.width / 2 - box.left, half + 4), box.width - half - 4);
  itip.style.left = x + "px";
  itip.style.top = (p.top - box.top) + "px";
}

function setupDistribution() {
  const dotOf = e => e.target.closest && e.target.closest(".idot");
  ibars.addEventListener("mouseover", e => { const d = dotOf(e); if (d) showDotTip(d); });
  ibars.addEventListener("focusin", e => { const d = dotOf(e); if (d) showDotTip(d); });
  ibars.addEventListener("mouseout", e => { if (dotOf(e)) itip.hidden = true; });
  ibars.addEventListener("focusout", e => { if (dotOf(e)) itip.hidden = true; });
  trackClicks(ibars, ".idot");
  metricTabs.addEventListener("click", e => {
    const b = e.target.closest("[data-metric]");
    if (!b) return;
    metric = METRICS[b.dataset.metric];
    metricTabs.querySelectorAll("[data-metric]").forEach(x => x.setAttribute("aria-pressed", x === b));
    renderDots();
  });
  renderDots();
}

// ---- Random track ----

// Each score can be held to a band, as in the Intensity to Color key: low is 1–2, mid is 3, high is 4–5
const BANDS = { any: null, lo: [1, 2], mid: [3, 3], hi: [4, 5] };
const BAND_LABELS = { any: "Any", lo: "Low", mid: "Mid", hi: "High" };
const randBands = AXES.map(() => "any");
// Scored tracks with audio, so every pick plays
const PLAYABLE = GAMES.flatMap(g => g.tracks.filter(t => t.vals && t.audio));

const inBand = (v, band) => !BANDS[band] || (v >= BANDS[band][0] && v <= BANDS[band][1]);
const randPool = () => PLAYABLE.filter(t => t.vals.every((v, k) => inBand(v, randBands[k])));

// Fisher–Yates
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderRandNote(loaded) {
  const n = randPool().length;
  $("randBtn").disabled = !n;
  $("randNote").textContent = loaded ? `Shuffled ${n} ${n === 1 ? "track" : "tracks"} into the playlist`
    : n ? `${n} ${n === 1 ? "track matches" : "tracks match"}` : "No tracks match. Try a wider band.";
}

// Loads every matching track as a shuffled playlist and plays the first
function playRandom() {
  const list = shuffle(randPool());
  if (!list.length) return;
  // Don't open on the track that's already selected when there's anything else to start with
  if (list.length > 1 && isPinned(list[0].gi, list[0].ti)) [list[0], list[1]] = [list[1], list[0]];
  nav(() => { applyCustom(list); setPinned(0); });
  renderRandNote(true);
  track("random_playlist", { track_count: list.length, bands: randBands.join(",") });
}

// ---- Repeat ----

// With repeat on, a track that plays to its end is followed by the next one in the game or playlist, starting over
// after the last
let repeat = false;

function nextPlayable(from) {
  const n = G.tracks.length;
  for (let s = 1; s <= n; s++) {
    const k = (from + s) % n;
    if (G.tracks[k].audio) return k;
  }
  return -1;
}

function setupRepeat() {
  const btn = $("repeatBtn");
  btn.addEventListener("click", () => {
    repeat = !repeat;
    btn.setAttribute("aria-pressed", repeat);
    track("repeat_toggle", { on: repeat });
  });
  player.addEventListener("ended", () => {
    if (!repeat || pinned == null) return;
    const k = nextPlayable(pinned);
    if (k >= 0) nav(() => setPinned(k));
  });
}

function setupRandom() {
  const box = $("randFilters");
  box.innerHTML = AXES.map((ax, k) => `<div class="rfilter" role="group" aria-labelledby="randAx${k}">
    <span class="plabel" id="randAx${k}"><b class="ch-${"rgb"[k]}">${ax.label}</b> ${ax.lo.toLowerCase()} → ${ax.hi.toLowerCase()}</span>
    <div class="rseg">${Object.keys(BANDS).map(b => `<button type="button" class="tab" data-ax="${k}" data-band="${b}" aria-pressed="${b === randBands[k]}">${BAND_LABELS[b]}</button>`).join("")}</div>
  </div>`).join("");
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-band]");
    if (!b) return;
    const k = +b.dataset.ax;
    randBands[k] = b.dataset.band;
    box.querySelectorAll(`[data-ax="${k}"]`).forEach(x => x.setAttribute("aria-pressed", x === b));
    renderRandNote();
  });
  $("randBtn").addEventListener("click", () => { playRandom(); scrollToViz(); });
  renderRandNote();
}

// ---- Favorites and saved playlists ----

// Same storage as colors-classic.html, so favorites and lists carry over between the two pages
const FAVORITES_KEY = "rmcp-favorites", LISTS_KEY = "rmcp-saved-lists", FAV = "fav";
let favs = readStored(FAVORITES_KEY, []);
let chosen = "";

const savedSel = $("savedSel"), saveBtn = $("saveBtn"), delBtn = $("delBtn");
const saveForm = $("saveForm"), saveName = $("saveName"), saveNote = $("saveNote");

const fromKeys = keys => keys.map(trackOf).filter(t => t && selectable(t));
const storedLists = () => readStored(LISTS_KEY, []);
const savedLists = () => storedLists().sort((a, b) => a.name.localeCompare(b.name));
const listsWithFavs = () => [...(favs.length ? [{ id: FAV, name: "★ Favorites", tracks: favs }] : []), ...savedLists()];
const matchesCustom = list => list.tracks.join() === CUSTOM.tracks.map(trackKey).join();

function markFavs() {
  document.querySelectorAll("[data-fav]").forEach(b => {
    const on = favs.includes(b.dataset.fav);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
  });
}

function renderSavedLists() {
  const lists = listsWithFavs();
  savedSel.innerHTML = lists.length
    ? `<option value="">Choose a saved playlist…</option>` + lists.map(l => `<option value="${esc(l.id)}">${esc(l.name)} (${l.tracks.length})</option>`).join("")
    : `<option value="">No saved playlists yet</option>`;
  const match = lists.find(l => l.id === chosen && G && G.custom && matchesCustom(l));
  chosen = savedSel.value = match ? chosen : "";
  delBtn.hidden = !savedSel.value || savedSel.value === FAV;
  delBtn.classList.remove("confirm");
  delBtn.textContent = "Delete";
  saveBtn.disabled = !CUSTOM.tracks.length;
}

function saveList(e) {
  e.preventDefault();
  const name = saveName.value.trim();
  if (!name || !CUSTOM.tracks.length) return;
  const tracks = CUSTOM.tracks.map(trackKey), updatedAt = new Date().toISOString();
  const existing = savedLists().find(l => l.name.toLowerCase() === name.toLowerCase());
  saveForm.hidden = true;
  const others = storedLists().filter(l => !(existing && l.id === existing.id));
  const id = existing ? existing.id : "l" + Date.now().toString(36);
  if (writeStored(LISTS_KEY, [...others, { id, name, tracks, updatedAt }])) {
    chosen = id;
    saveNote.textContent = `Saved “${name}”.`;
    track(existing ? "update_playlist" : "create_playlist", { track_count: tracks.length });
  } else saveNote.textContent = "Couldn't save here. Copy the page link to keep this playlist.";
  renderSavedLists();
}

function deleteList() {
  if (!delBtn.classList.contains("confirm")) { delBtn.classList.add("confirm"); delBtn.textContent = "Really delete?"; return; }
  const list = savedLists().find(l => l.id === chosen);
  writeStored(LISTS_KEY, storedLists().filter(l => l.id !== chosen));
  chosen = "";
  saveNote.textContent = list ? `Deleted “${list.name}”.` : "";
  renderSavedLists();
}

function toggleFavorite(key) {
  const on = !favs.includes(key), t = fromKeys([key])[0];
  favs = on ? [...favs, key] : favs.filter(k => k !== key);
  writeStored(FAVORITES_KEY, favs);
  markFavs();
  if (t) track(on ? "favorite_add" : "favorite_remove", { track_name: t.name, game_id: t.game.id });
  if (chosen === FAV && G.custom) applyCustom(fromKeys(favs)); else renderSavedLists();
}

function setupSavedLists() {
  savedSel.addEventListener("change", () => {
    const list = listsWithFavs().find(l => l.id === savedSel.value);
    chosen = list ? list.id : "";
    if (list) { nav(() => applyCustom(fromKeys(list.tracks))); saveNote.textContent = ""; }
    renderSavedLists();
  });
  saveBtn.addEventListener("click", () => {
    const list = savedLists().find(l => l.id === chosen);
    saveForm.hidden = false;
    saveName.value = list ? list.name : "";
    saveName.focus();
    saveName.select();
  });
  $("saveCancel").addEventListener("click", () => { saveForm.hidden = true; saveBtn.focus(); });
  saveForm.addEventListener("keydown", e => { if (e.key === "Escape") { saveForm.hidden = true; saveBtn.focus(); } });
  saveForm.addEventListener("submit", saveList);
  delBtn.addEventListener("click", deleteList);
  document.addEventListener("click", e => { const b = e.target.closest("[data-fav]"); if (b) toggleFavorite(b.dataset.fav); });
  markFavs();
  renderSavedLists();
}

// ---- Start ----

setupTheme();
setupColorBar();
initViz({ nav, syncHistory: syncLink, markIntensity, markTable, markFavs, onCustomChange: renderSavedLists });
renderGameProfiles();
setupTooltips();
setupInfoNotes();
setupBuddies();
setupDistribution();
setupSavedLists();
setupRandom();
setupRepeat();
fromLink();
markIntensity();
markTable();
