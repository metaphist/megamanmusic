// The page: the full color report (the main view) and the visualizer (viz.js), and everything around them:
// links and back button history, the theme toggle, game profiles, the track table, color buddies, the score
// distribution, favorites and saved lists.
//
// The data lives in data/, and model.js loads the scores and works out colors, averages and badges.
// Each section below sets itself up with a function; "Start" at the bottom runs them in order.
import { GAMES, AXES, RELEASE_ORDER, trackKey, trackOf, selectable, shortTitle, tableTitle } from "./model.js";
import { inkOn, intensity } from "./colors.js";
import { el, drawSmallHexagon, scoreBars, sprite, spriteOf, sprImg, badgeIcon } from "./draw.js";
import { ICON_STAR, ICON_PLAY } from "../data/icons.js";
import { $, esc, track, readStored, writeStored } from "./util.js";
import { G, pinned, player, CUSTOM, initViz, setGame, setPinned, togglePinned, viewIndex, isPinned, applyCustom } from "./viz.js";

// ---- Links ----

// The link's query: ?game=mm2 or ?list=mm2.0,mmii.0, plus track=3 for the track at that place in the game or list,
// and view=report for the report. Older hash links (#mm2/3, #custom=mm2.0,mmii.0/1, #report/mm2/3) read the same way.
const LINK_KEYS = ["view", "game", "list", "track"];

function linkParams() {
  const q = new URLSearchParams(location.search);
  if (q.has("game") || q.has("list") || !location.hash) return q;
  let h = decodeURIComponent(location.hash).slice(1);
  if (h === "report" || h.startsWith("report/")) { q.set("view", "report"); h = h.slice(7); }
  const [target = "", idx = ""] = h.split("/");
  if (target.startsWith("custom")) q.set("list", target.split("=")[1] || "");
  else if (target) q.set("game", target);
  if (idx !== "") q.set("track", idx);
  return q;
}

// A link to a game or list opens the visualizer, unless it says view=report
const linkedView = q => (q.has("game") || q.has("list")) && q.get("view") !== "report" ? "viz" : "report";

// Loads the link's game or list and selects its track, without playing it until it's clicked.
// Returns the view the link asks for.
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
  return linkedView(q);
}

// The link for what's on screen: the visualizer keeps its game or list and selected track; the report keeps a plain
// link unless a track is selected. Other query parameters (like campaign tags) are kept, and the commas and dots in
// a list stay readable, unescaped.
function currentLink(viz) {
  const q = new URLSearchParams(location.search);
  LINK_KEYS.forEach(k => q.delete(k));
  const ours = !viz && pinned == null ? [] : [
    viz ? "" : "view=report",
    G.custom ? "list=" + G.tracks.map(trackKey).join(",") : "game=" + G.id,
    pinned != null ? "track=" + pinned : "",
  ].filter(Boolean);
  const query = [...ours, q.toString()].filter(Boolean).join("&");
  return location.pathname + (query ? "?" + query : "");
}

// ---- Back button history ----

// Each entry keeps the view, the game or custom list, and the selected track. Picking a game or a track pushes an
// entry (via nav); other changes, like editing the list, update the current one. The link follows along.
let navDepth = 0;   // above 0 while a pick or Back/Forward is being applied, so its steps don't each record history

function syncHistory(push) {
  if (navDepth || !G) return;
  const viz = document.documentElement.dataset.view === "viz";
  const state = {
    view: viz ? "viz" : "report",
    game: G.custom ? null : G.id,
    list: G.custom ? G.tracks.map(trackKey) : null,
    pin: pinned != null ? trackKey(G.tracks[pinned]) : null,
  };
  if (push && JSON.stringify(state) === JSON.stringify(history.state)) return;
  try { history[push ? "pushState" : "replaceState"](state, "", currentLink(viz)); } catch (e) { }
}

// Runs a user's pick, then records one history entry for everything it changed
function nav(fn) {
  navDepth++;
  try { fn(); } finally { navDepth--; }
  syncHistory(true);
}

// Back and forward restore the entry's game or list, its selected track and its view.
// An entry without saved state (a link typed or edited in the address bar) is read from the link instead.
addEventListener("popstate", e => {
  if (!G) return;
  navDepth++;
  try {
    if (e.state) restoreHistory(e.state);
    else showView(fromLink());
  } finally { navDepth--; }
  syncHistory();
});

function restoreHistory(state) {
  if (state.list) {
    const same = G.custom && G.tracks.map(trackKey).join() === state.list.join();
    if (!same) applyCustom(state.list.map(trackOf).filter(Boolean));
  } else if (G.custom || G.id !== state.game) {
    const gi = GAMES.findIndex(g => g.id === state.game);
    setGame(gi < 0 ? 0 : gi);
  }
  const t = state.pin && trackOf(state.pin), k = t ? G.tracks.indexOf(t) : -1;
  if ((k < 0 ? null : k) !== pinned) setPinned(k < 0 ? null : k);
  showView(state.view);
}

// ---- Views ----

// Two views: the full color report (the main one) and the visualizer
function showView(v) {
  const root = document.documentElement, viz = v === "viz";
  if (root.dataset.view === v && $("viewViz").hidden !== viz) return;
  root.dataset.view = v;
  $("viewViz").hidden = !viz;
  $("viewReport").hidden = viz;
  $("viewBtnLong").textContent = viz ? "View full color report" : "Open the visualizer";
  $("viewBtnShort").textContent = viz ? "Report" : "Visualizer";
  syncFab();
  syncHistory();
}

// On phones, switching views lands somewhere useful instead of the top of the page:
// the visualizer opens on its hexagon chart, and the report opens on the playing track's row (if one is playing).
const PHONE = matchMedia("(max-width:780px)");
function landView(v) {
  scrollTo({ top: 0 });
  if (!PHONE.matches) return;
  let target = null;
  if (v === "viz") target = document.querySelector("#viewViz .stage");
  else if (pinned != null && !player.paused) { openSelectedGame(); target = reportRow(G.tracks[pinned]); }
  if (target) target.scrollIntoView({ block: v === "viz" ? "start" : "center" });
}

// The title bar's view button, and the floating buttons (visualizer and favorites) that stand in for it on the
// report while it's scrolled out of sight
let viewBtnSeen = true;
function syncFab() {
  const off = viewBtnSeen !== false || document.documentElement.dataset.view !== "report";
  const viz = $("vizFab"); if (viz) viz.hidden = off;
  const fav = $("favFab"); if (fav) fav.hidden = off || !favs.length;
}
function setupViewButtons() {
  $("viewBtn").addEventListener("click", () => {
    const v = document.documentElement.dataset.view === "viz" ? "report" : "viz";
    showView(v);
    landView(v);
    syncFab();
  });
  try {
    new IntersectionObserver(([e]) => { viewBtnSeen = e.isIntersecting; syncFab(); }).observe($("viewBtn"));
  } catch (e) { }
  $("vizFab").addEventListener("click", () => { showView("viz"); landView("viz"); syncFab(); });
}

// ---- Theme ----

// Light/dark toggle. With no saved choice the page follows the system setting.
function setupTheme() {
  const root = document.documentElement, btn = $("themeToggle");
  const system = matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.dataset.theme || (system.matches ? "dark" : "light");
  const sync = () => {
    const to = current() === "dark" ? "light" : "dark";
    btn.dataset.to = to;
    btn.querySelector(".tlabel").textContent = to === "dark" ? "Dark" : "Light";
    btn.setAttribute("aria-label", `Switch to ${to} mode`);
  };
  let saved = null;
  try { saved = localStorage.getItem("rmcp-theme"); } catch (e) { }
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("rmcp-theme", next); } catch (e) { }
    sync();
  });
  system.addEventListener("change", sync);
  sync();
}

// ---- Tracks across the page ----

// A click on a track outside the visualizer's legend and cards (table, buddies, dot plot, report rows):
// a track in the current game or list is toggled in place; otherwise its game is loaded first
function toggleTrack(gi, ti) {
  nav(() => {
    let k = viewIndex(gi, ti);
    if (k < 0) { setGame(gi); k = ti; }
    togglePinned(k);
  });
}

// Marks the selected track in the table, the color buddies and the report
function markTable() {
  const mark = sel => document.querySelectorAll(sel).forEach(e => e.classList.toggle("on", isPinned(+e.dataset.gi, +e.dataset.ti)));
  mark("#trackTable tbody tr[data-gi]");
  mark("#buddies li button");
  mark("#rpBody .rp-row[data-gi]");
}

// Delegated click handling for elements carrying data-gi/data-ti
const trackClicks = (container, selector) => container.addEventListener("click", e => {
  const b = e.target.closest(selector);
  if (b) toggleTrack(+b.dataset.gi, +b.dataset.ti);
});

// ---- Color profile by game ----

// One row per scored game, in release order: name, badges, average color, a strip of its track colors and its
// averages. Clicking a row opens that game in the visualizer.
function renderGameProfiles() {
  const box = $("compare");
  box.innerHTML = RELEASE_ORDER.filter(g => g.avg).map(gameProfile).join("");
  // The badge column is as wide as the most-decorated game, so swatches and strips line up across rows
  box.style.setProperty("--maxb", Math.max(0, ...GAMES.filter(g => g.avg).map(g => g.badges.length)));
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

function setupGameButtons() {
  document.querySelectorAll("[data-game]").forEach(b => b.addEventListener("click", () => {
    const profile = b.classList.contains("crow");
    nav(() => { setGame(+b.dataset.game); if (profile) showView("viz"); });
    if (profile) $("gamePick").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

// ---- Tooltips and info notes ----

// Badges show their tip on hover. Delegated, so badges added later (the game banner) get the tooltip too.
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

// Info icons (hexagon chart, track table): a tap or click pins the note open (for touch screens);
// a click elsewhere or Escape closes it, and opening one closes the others
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

// ---- Track table ----

// One row per track in every game; the table, color buddies, score distribution and report all draw from these
const ROWS = GAMES.flatMap(g => g.tracks.map(t => ({
  gi: t.gi, ti: t.ti, game: g.title, dln: t.dln, name: t.name, e: t.vals?.[0], d: t.vals?.[1], g: t.vals?.[2],
  cname: t.cname, color: t.color, vals: t.vals, composer: t.composer || g.composer || "", total: t.vals ? intensity(t.vals) : null,
})));
const SCORED = ROWS.filter(r => r.vals);

// A composer credit like "arr. Kenji Yamazaki · orig. Takashi Tateishi" counts for each person it names
const composersOf = credit => credit.split(/\s*·\s*|,\s*|\s+&\s+/).map(x => x.replace(/^(arr\.|orig\.)\s*/, "").trim())
  .filter(x => x && !/guest series composers/.test(x));
ROWS.forEach(r => {
  r.people = composersOf(r.composer);
  // What the free-text filter searches: robot master, serial, game, color name, hex and composer
  r.hay = [r.name, r.dln, r.game, GAMES[r.gi].id, r.cname, r.color, r.composer].join(" ").toLowerCase();
});

const fText = $("fText"), fGame = $("fGame"), fColor = $("fColor"), fComposer = $("fComposer");
let sortKey = null, sortDir = 1;

// Scored tracks only, filtered by free text, game, color name and composer
function setupTable() {
  // Each filter lists only what the scored tracks have, with counts for colors and composers
  const count = values => values.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map());
  const options = counts => [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([v, n]) => `<option value="${v}">${v} (${n})</option>`).join("");
  fGame.innerHTML += GAMES.map((g, i) => SCORED.some(r => r.gi === i) ? `<option value="${i}">${g.title}</option>` : "").join("");
  fColor.innerHTML += options(count(SCORED.map(r => r.cname)));
  fComposer.innerHTML += options(count(SCORED.flatMap(r => [...new Set(r.people)])));
  [fText, fGame, fColor, fComposer].forEach(f => f.addEventListener(f === fText ? "input" : "change", () => renderTable()));
  $("fClear").addEventListener("click", () => {
    fText.value = fGame.value = fColor.value = fComposer.value = "";
    renderTable();
    fText.focus();
  });

  // Clicking a row, or Enter or Space on it, plays its track (or stops it)
  const tbody = document.querySelector("#trackTable tbody");
  trackClicks(tbody, "tr[data-gi]");
  tbody.addEventListener("keydown", e => {
    const tr = e.target.closest("tr[data-gi]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleTrack(+tr.dataset.gi, +tr.dataset.ti); }
  });
  // Clicking a column heading sorts by it; clicking it again reverses the order
  document.querySelectorAll("#trackTable th button").forEach(b => b.addEventListener("click", () => {
    const k = b.parentElement.dataset.key;
    if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
    renderTable();
  }));
  renderTable();
}

function renderTable() {
  const words = fText.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = SCORED.filter(r => words.every(w => r.hay.includes(w))
    && (fGame.value === "" || r.gi === +fGame.value)
    && (fColor.value === "" || r.cname === fColor.value)
    && (fComposer.value === "" || r.people.includes(fComposer.value)));
  const filtered = words.length || fGame.value || fColor.value || fComposer.value;
  $("fCount").textContent = filtered ? `Showing ${rows.length} of ${SCORED.length} tracks` : `${SCORED.length} tracks`;
  $("fClear").hidden = !filtered;
  if (sortKey) rows.sort(compareRows);
  document.querySelector("#trackTable tbody").innerHTML = rows.map(tableRow).join("")
    || `<tr><td class="none" colspan="10">No tracks match these filters.</td></tr>`;
  document.querySelectorAll("#trackTable th").forEach(th => {
    if (th.dataset.key === sortKey) th.setAttribute("aria-sort", sortDir > 0 ? "ascending" : "descending");
    else th.removeAttribute("aria-sort");
  });
  markTable();
}

// Sorts by the chosen column, then series order. Games sort in series order; serials sort by their number only
// (DWN-009 → 9). Rows without a value (like serials without a number) stay at the bottom either way.
function compareRows(a, b) {
  const serialNum = d => { const m = /-(\d+)/.exec(d || ""); return m ? +m[1] : null; };
  const value = r => sortKey === "game" ? r.gi : sortKey === "dln" ? serialNum(r.dln) : r[sortKey];
  const seriesOrder = a.gi - b.gi || a.ti - b.ti;
  const x = value(a), y = value(b);
  if (x == null && y == null) return seriesOrder;
  if (x == null) return 1;
  if (y == null) return -1;
  return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * sortDir || seriesOrder;
}

function tableRow(r) {
  const playable = r.vals || GAMES[r.gi].tracks[r.ti].audio;
  const attrs = playable ? ` data-gi="${r.gi}" data-ti="${r.ti}" tabindex="0" aria-label="Play ${r.name}, ${r.game}"` : "";
  const scores = [r.e, r.d, r.g].map((v, k) => `<td class="n ${v ? `ch-${"rgb"[k]}` : ""}">${v ?? "–"}</td>`).join("");
  const color = r.vals ? `<span class="cc"><i style="background:${r.color}"></i>${r.cname}</span>` : "not scored";
  return `<tr class="${r.vals ? "" : "unscored"}"${attrs}>
    <td><span class="vh">Mega Man </span>${tableTitle(GAMES[r.gi])}</td><td class="mono">${r.dln}</td><td class="rm">${sprite(r, "spr-inline")}${r.name}</td>
    ${scores}<td class="n">${r.total ?? "–"}</td>
    <td>${color}</td>
    <td class="mono">${r.color || "–"}</td><td class="cmp">${r.composer}</td></tr>`;
}

// ---- Color buddies ----

// Tracks with identical scores (so the same exact color), biggest groups first, then lightest color first.
// Each track plays when clicked, and a group can be loaded as a custom list.
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
      nav(() => { applyCustom(groups[+load.dataset.k].map(t => GAMES[t.gi].tracks[t.ti])); showView("viz"); });
      $("rSw").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  markTable();
}

function buddyGroup(group, k) {
  const r = group[0];
  const tracks = group.map(t => `<li><button type="button" data-gi="${t.gi}" data-ti="${t.ti}" aria-label="Play ${t.name}, ${t.game}"><span>${sprite(t, "spr-inline")}${t.name}</span><small>${tableTitle(GAMES[t.gi])}</small></button></li>`).join("");
  return `<div class="bud">
    <div class="bud-sw" style="background:${r.color};color:${inkOn(r.vals)}"><b>${r.cname}</b><span>${r.color}</span></div>
    <div class="bud-meta"><span class="digits">${r.vals.map((v, i) => `<span class="ch-${"rgb"[i]}">${v}</span>`).join(" ")}</span><span>${group.length} tracks</span></div>
    <ul>${tracks}</ul>
    <button type="button" class="bud-load" data-k="${k}">Load as custom list</button>
  </div>`;
}

// ---- Score distribution ----

// One column per possible score, one dot per track, stacked bottom-up. The tabs pick the score:
// Intensity (the sum, 3–15) or one of the three axes (1–5).
const ibars = $("ibars"), itip = $("itip"), ibox = $("intensity"), metricTabs = $("metricTabs");
const METRICS = {
  total: {
    label: "Intensity", min: 3, max: 15, lo: "Low intensity", hi: "High intensity", val: r => r.total,
    hint: "Intensity is the sum of a track's three scores, from 3 (all 1s) to 15 (all 5s)."
  },
  ...Object.fromEntries(AXES.map((ax, k) => [k, {
    label: ax.label, min: 1, max: 5, lo: ax.lo, hi: ax.hi, cls: `ch-${"rgb"[k]}`,
    val: r => r.vals ? r.vals[k] : null, hint: `${ax.label} runs from 1 (${ax.lo.toLowerCase()}) to 5 (${ax.hi.toLowerCase()}).`
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

// Highlights the dots of the tracks in the visualizer's game or list
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
  // Delegated, so the listeners survive re-rendering when the score changes
  const dotOf = e => e.target.closest && e.target.closest(".idot");
  ibars.addEventListener("mouseover", e => { const d = dotOf(e); if (d) showDotTip(d); });
  ibars.addEventListener("focusin", e => { const d = dotOf(e); if (d) showDotTip(d); });
  ibars.addEventListener("mouseout", e => { if (dotOf(e)) itip.hidden = true; });
  ibars.addEventListener("focusout", e => { if (dotOf(e)) itip.hidden = true; });
  // Same as clicking the track's table row: select it and play, or click again to clear it and stop
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

// ---- Favorites and saved lists ----

// Both are kept in this browser. Favorites are tracks starred in the report; they act as a special saved list,
// listed first whenever there are any.
const FAVORITES_KEY = "rmcp-favorites", LISTS_KEY = "rmcp-saved-lists", FAV = "fav";
let favs = readStored(FAVORITES_KEY, []);
let chosen = "";   // id of the saved list on screen ("" for none)

const savedSel = $("savedSel"), saveBtn = $("saveBtn"), delBtn = $("delBtn");
const saveForm = $("saveForm"), saveName = $("saveName"), saveNote = $("saveNote");

// Saved keys (see trackKey) back to tracks, dropping any that no longer exist or can't be selected
const fromKeys = keys => keys.map(trackOf).filter(t => t && selectable(t));
const storedLists = () => readStored(LISTS_KEY, []);
const savedLists = () => storedLists().sort((a, b) => a.name.localeCompare(b.name));
const listsWithFavs = () => [...(favs.length ? [{ id: FAV, name: "★ Favorites", tracks: favs }] : []), ...savedLists()];
const matchesCustom = list => list.tracks.join() === CUSTOM.tracks.map(trackKey).join();

// Every favorite star on the page, plus the favorites buttons
function markFavs() {
  document.querySelectorAll("[data-fav]").forEach(b => {
    const on = favs.includes(b.dataset.fav);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
  });
  const btn = $("favBtn");
  btn.disabled = !favs.length;
  btn.title = favs.length ? `Open favorites (${favs.length})` : "Star tracks in the report to add favorites";
  $("favFab").title = btn.title;
  syncFab();
}

// The saved-list picker. It keeps its selection while the list on screen still matches what was saved.
function renderSavedLists() {
  const lists = listsWithFavs();
  savedSel.innerHTML = lists.length
    ? `<option value="">Choose a saved list…</option>` + lists.map(l => `<option value="${esc(l.id)}">${esc(l.name)} (${l.tracks.length})</option>`).join("")
    : `<option value="">No saved lists yet</option>`;
  const match = lists.find(l => l.id === chosen && G && G.custom && matchesCustom(l));
  chosen = savedSel.value = match ? chosen : "";
  delBtn.hidden = !savedSel.value || savedSel.value === FAV;
  delBtn.classList.remove("confirm");
  delBtn.textContent = "Delete";
  saveBtn.disabled = !CUSTOM.tracks.length;
}

// Saving under an existing name replaces that list
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
  } else saveNote.textContent = "Couldn't save here. Copy the page link to keep this list.";
  renderSavedLists();
}

// Deleting asks once more before it happens
function deleteList() {
  if (!delBtn.classList.contains("confirm")) { delBtn.classList.add("confirm"); delBtn.textContent = "Really delete?"; return; }
  const list = savedLists().find(l => l.id === chosen);
  writeStored(LISTS_KEY, storedLists().filter(l => l.id !== chosen));
  chosen = "";
  saveNote.textContent = list ? `Deleted “${list.name}”.` : "";
  renderSavedLists();
}

// A star adds or removes its track; if the favorites list is on screen it follows along
function toggleFavorite(key) {
  const on = !favs.includes(key), t = fromKeys([key])[0];
  favs = on ? [...favs, key] : favs.filter(k => k !== key);
  writeStored(FAVORITES_KEY, favs);
  markFavs();
  if (t) track(on ? "favorite_add" : "favorite_remove", { track_name: t.name, game_id: t.game.id });
  if (chosen === FAV && G.custom) applyCustom(fromKeys(favs)); else renderSavedLists();
}

function openFavorites() {
  if (!favs.length) return;
  chosen = FAV;
  nav(() => { applyCustom(fromKeys(favs)); showView("viz"); });
  landView("viz");
  syncFab();
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
  $("favBtn").addEventListener("click", openFavorites);
  $("favFab").addEventListener("click", openFavorites);
  markFavs();
  renderSavedLists();
}

// ---- Full color report ----

// The main view: every game in release order and every robot master in it, with sprite, serial, composer, scores,
// intensity, shape and color. A sticky bar jumps to each game and searches for robot masters.
const reportBody = $("rpBody"), jumpBar = $("rpJump");
const reportRow = t => reportBody.querySelector(`.rp-row[data-gi="${t.gi}"][data-ti="${t.ti}"]`);

function renderReport() {
  reportBody.innerHTML = reportIntro() + RELEASE_ORDER.map(reportGame).join("");
  markFavs();
  jumpBar.innerHTML = RELEASE_ORDER.map(g => `<button type="button" data-jump="rp-${g.id}" title="${esc(g.title)}" aria-label="${esc(g.title)}"><i style="${g.color ? `background:${g.color}` : ""}" class="${g.color ? "" : "chip empty"}"></i>${esc(tableTitle(g))}</button>`).join("");
  // Each robot master's own hexagon, drawn the same way as the visualizer's cards
  reportBody.querySelectorAll(".rp-hex").forEach(slot => {
    const svg = el("svg", { viewBox: "-70 -64 140 128", "aria-hidden": "true" });
    drawSmallHexagon(svg, GAMES[+slot.dataset.gi].tracks[+slot.dataset.ti], 2);
    slot.appendChild(svg);
  });
}

// A strip of every scored track's color in release order (each jumps to its row), and totals (hidden for now)
function reportIntro() {
  const colors = new Set(SCORED.map(r => r.color));
  const strip = RELEASE_ORDER.flatMap(g => g.scored).map(t => `<button type="button" data-to-gi="${t.gi}" data-to-ti="${t.ti}" style="background:${t.color}" title="${esc(t.name)} · ${esc(t.game.title)} · ${t.color}" aria-label="Go to ${esc(t.name)}, ${esc(t.game.title)}"></button>`).join("");
  return `<section class="rp-intro">
      <div class="rp-stats" hidden><!-- hidden for now; remove the hidden attribute to show the totals again -->
        <div class="rp-stat"><b>${RELEASE_ORDER.length}</b><span>games</span></div>
        <div class="rp-stat"><b>${GAMES.reduce((n, g) => n + g.tracks.length, 0)}</b><span>stage themes</span></div>
        <div class="rp-stat"><b>${SCORED.length}</b><span>scored</span></div>
        <div class="rp-stat"><b>${colors.size}</b><span>distinct colors of 125</span></div>
      </div>
      <div class="rp-all" aria-label="Every scored track's color, in release order">${strip}</div>
      <p class="rp-note" hidden>Every scored track's color, left to right in release order. Click any robot master below to play its theme.</p>
    </section>`;
}

// A game's section: a banner in its average color (with its averages, sprite lineup, badges and "Play all"),
// then a row per robot master
function reportGame(g) {
  const ink = g.avg ? inkOn(g.avg) : "var(--ink)";
  const badges = g.badges.length ? `<span class="ticons rp-badges">${g.badges.map(badgeIcon).join("")}</span>` : "";
  const stats = g.avg ? `<div class="rp-gstats">
          ${g.avg.map((v, k) => `<div><b>${v.toFixed(1)}</b><span>${AXES[k].label}</span></div>`).join("")}
          <div><b>${intensity(g.avg).toFixed(1)}</b><span>Intensity</span></div>
          <div><b>${esc(g.cname)}</b><span>${g.color}</span></div>
        </div>` : `<div class="rp-gstats"><div><b>–</b><span>Not scored yet</span></div></div>`;
  const lineup = g.tracks.map(t => { const s = spriteOf(t); return s ? sprImg(s, 48, "", 1) : ""; }).join("");
  const playAll = g.tracks.some(t => t.audio)
    ? `<button type="button" class="rp-viz" data-viz-game="${GAMES.indexOf(g)}" aria-label="Play all of ${esc(g.title)} in the visualizer">${ICON_PLAY}Play all</button>` : "";
  const bandClass = g.avg ? (ink === "#f2f4fa" ? " ink-light" : "") : " empty";
  // The title is the button that opens the game's rows (a click anywhere else on the banner does too)
  const toggle = `<button type="button" class="rp-toggle" aria-expanded="false" aria-controls="rpt-${g.id}">${esc(g.title)}<span class="rp-chev" aria-hidden="true"></span></button>`;
  return `<section class="rp-game" id="rp-${g.id}" aria-labelledby="rph-${g.id}">
        <header class="rp-band${bandClass}" style="${g.avg ? `background:${g.color};color:${ink};` : ""}--nb:${g.badges.length}">
          <div><div class="rp-eyebrow">${g.year || "Upcoming"}${g.composer ? " · " + esc(g.composer) : ""}</div><h3 id="rph-${g.id}">${toggle}</h3></div>
          <div class="rp-right">${stats}</div>
          <div class="rp-foot"><div class="rp-lineup" aria-hidden="true">${lineup}</div><div class="rp-actions">${badges}${playAll}</div></div>
        </header>
        <div class="rp-drop" id="rpt-${g.id}"><ol class="rp-tracks">${g.tracks.map(t => reportTrack(t, g)).join("")}</ol></div>
      </section>`;
}

// A robot master's row: sprite, name, serial and composer, small hexagon (drawn after), score bars, intensity and
// color. Selectable rows are buttons, with a favorite star beside them.
function reportTrack(t, g) {
  const play = selectable(t), tag = play ? "button" : "div";
  const attrs = play ? ` type="button" data-gi="${t.gi}" data-ti="${t.ti}" aria-label="Play ${esc(t.name)}, ${esc(g.title)}"` : "";
  const s = spriteOf(t);
  const bars = t.vals ? scoreBars(t.vals) : `<span class="rp-none">Not scored yet</span>`;
  const star = play ? `<button type="button" class="rp-fav" data-fav="${trackKey(t)}" aria-pressed="false" aria-label="Favorite ${esc(t.name)}, ${esc(g.title)}">${ICON_STAR}</button>` : "";
  return `<li><${tag} class="rp-row"${attrs}>
          <span class="rp-spr">${s ? sprImg(s, 128, "", 2) : ""}</span>
          <span class="rp-id"><b>${esc(t.name)}</b><span>${esc(t.dln)}</span><small>${esc(t.composer || g.composer || "")}</small></span>
          <span class="rp-hex" data-gi="${t.gi}" data-ti="${t.ti}"></span>
          <span class="rp-bars">${bars}</span>
          <span class="rp-int"><b>${t.vals ? intensity(t.vals) : "–"}</b><span>Intensity</span></span>
          <span class="rp-col"><i class="${t.vals ? "" : "empty"}" style="${t.vals ? `background:${t.color}` : ""}"></i><div><b>${t.vals ? esc(t.cname) : "No color yet"}</b><span>${t.vals ? t.color : "–"}</span></div></span>
        </${tag}>${star}</li>`;
}

// Scrolls to a robot master's row and flashes it
function goToRow(gi, ti) {
  const row = reportBody.querySelector(`.rp-row[data-gi="${gi}"][data-ti="${ti}"]`);
  if (!row) return;
  openGame(GAMES[gi], { instantly: true });
  row.scrollIntoView({ block: "center", behavior: "smooth" });
  row.classList.remove("flash");
  void row.offsetWidth;   // restarts the flash animation
  row.classList.add("flash");
}

// Each game's rows start hidden behind its banner, and drop down when it's clicked.
// instantly skips the animation, so the rows are in place to scroll to straight away.
function openGame(g, { open = true, instantly = false } = {}) {
  const section = $("rp-" + g.id);
  if (!section || section.classList.contains("open") === open) return;
  if (instantly) section.classList.add("no-anim");
  section.classList.toggle("open", open);
  section.querySelector(".rp-toggle").setAttribute("aria-expanded", open);
  if (instantly) { void section.offsetHeight; section.classList.remove("no-anim"); }
}

// The banner toggles its game's rows, except where it has buttons of its own (Play all)
function setupGameToggles() {
  reportBody.addEventListener("click", e => {
    const band = e.target.closest(".rp-band");
    if (!band || e.target.closest(".rp-viz")) return;
    const g = GAMES.find(g => "rp-" + g.id === band.parentElement.id);
    openGame(g, { open: !band.parentElement.classList.contains("open") });
  });
}

// The selected track's game opens, so its row shows (when a link opens the report on a track, or a phone lands on it)
function openSelectedGame() {
  if (pinned != null) openGame(G.tracks[pinned].game, { instantly: true });
}

// A game banner's "Play all" loads that game in the visualizer, switches to it and plays its tracks in order.
// Each track moves on to the next when it ends, until the last one, or until someone picks a track themselves.
function setupPlayAll() {
  let autoIdx = null;
  const nextPlayable = from => { for (let k = from; k < G.tracks.length; k++) if (G.tracks[k].audio) return k; return -1; };
  reportBody.addEventListener("click", e => {
    const b = e.target.closest("[data-viz-game]");
    if (!b) return;
    let k = -1;
    nav(() => {
      setGame(+b.dataset.vizGame);
      showView("viz");
      k = nextPlayable(0);
      if (k >= 0) setPinned(k);
    });
    scrollTo({ top: 0 });
    if (k >= 0) { track("play_all", { game_id: G.id, game_title: G.title }); autoIdx = k; }
  });
  player.addEventListener("ended", () => {
    if (autoIdx == null || pinned !== autoIdx) { autoIdx = null; return; }
    const k = nextPlayable(autoIdx + 1);
    if (k >= 0) { setPinned(k); autoIdx = k; } else autoIdx = null;
  });
}

// Robot master search in the sticky bar: matches names, games and serials; Enter or a click jumps to the row
function setupReportSearch() {
  const input = $("rpFind"), list = $("rpFindList");
  const norm = x => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pool = GAMES.flatMap(g => g.tracks.filter(t => t.name !== "???").map(t => ({
    t, gi: t.gi, ti: t.ti,
    name: norm(t.name), hay: norm(`${t.name} ${g.title} ${shortTitle(g)} ${g.id} ${t.dln}`),
  })));
  let hits = [], sel = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    sel = -1;
  };
  const mark = i => {
    sel = i;
    list.querySelectorAll("li[role=option]").forEach((li, k) => li.setAttribute("aria-selected", k === i ? "true" : "false"));
    const li = list.querySelector(`#rpf${i}`);
    if (li) { input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
  };
  // Names starting with the query rank first, then names with a word starting with its first word
  const search = () => {
    const q = norm(input.value);
    if (!q) return close();
    const words = q.split(" ");
    hits = pool.filter(p => words.every(w => p.hay.includes(w)))
      .map(p => ({ ...p, rank: p.name.startsWith(q) ? 0 : p.name.split(" ").some(w => w.startsWith(words[0])) ? 1 : 2 }))
      .sort((a, b) => a.rank - b.rank || a.gi - b.gi).slice(0, 12);
    list.innerHTML = hits.length ? hits.map(searchHit).join("")
      : `<li class="none" role="presentation">No robot master matches “${esc(input.value.trim())}”</li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    mark(hits.length ? 0 : -1);
  };
  const pick = i => {
    const h = hits[i];
    if (!h) return;
    close();
    input.value = "";
    input.blur();
    goToRow(h.gi, h.ti);
  };

  input.addEventListener("input", search);
  input.addEventListener("focus", () => { if (input.value) search(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (list.hidden) search();
      if (hits.length) { e.preventDefault(); mark((sel + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length); }
    } else if (e.key === "Enter") { e.preventDefault(); pick(sel < 0 ? 0 : sel); }
    else if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); close(); } else input.value = ""; }
  });
  // pointerdown keeps focus in the box until the pick lands
  list.addEventListener("pointerdown", e => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  input.addEventListener("blur", () => setTimeout(close, 120));
}

function searchHit(h, i) {
  const s = spriteOf(h.t);
  return `<li role="option" id="rpf${i}" aria-selected="false" data-i="${i}"><span class="sprbox">${s ? sprImg(s, 32, "", 1) : ""}</span>` +
    `<span><b>${esc(h.t.name)}</b><small>${esc(h.t.game.title)} · ${esc(h.t.dln)}</small></span>` +
    `<i class="${h.t.vals ? "" : "empty"}" style="${h.t.vals ? `background:${h.t.color}` : ""}"></i></li>`;
}

function setupReport() {
  renderReport();
  setupGameToggles();
  setupPlayAll();
  // Each color in the intro strip jumps to its robot master's row
  reportBody.addEventListener("click", e => { const b = e.target.closest("[data-to-gi]"); if (b) goToRow(b.dataset.toGi, b.dataset.toTi); });
  setupReportSearch();
  // The jump bar's scrollbar height, for the sticky bar's layout
  const syncScrollbar = () => jumpBar.parentElement.style.setProperty("--sbh", (jumpBar.offsetHeight - jumpBar.clientHeight) + "px");
  try { new ResizeObserver(syncScrollbar).observe(jumpBar); } catch (e) { addEventListener("resize", syncScrollbar); }
  syncScrollbar();
  jumpBar.addEventListener("click", e => { const b = e.target.closest("[data-jump]"); if (b) $(b.dataset.jump).scrollIntoView({ block: "start" }); });
  // Playing from the report works like a table row: it loads the track's game in the visualizer and plays it
  trackClicks(reportBody, ".rp-row[data-gi]");
}

// ---- Start ----

document.documentElement.dataset.view = linkedView(linkParams());
setupTheme();
initViz({ nav, syncHistory, markIntensity, markTable, markFavs, onCustomChange: renderSavedLists });
renderGameProfiles();
setupTooltips();
setupInfoNotes();
setupGameButtons();
setupTable();
setupBuddies();
setupDistribution();
setupSavedLists();
setupReport();
fromLink();
openSelectedGame();
markIntensity();
showView(document.documentElement.dataset.view);
setupViewButtons();
