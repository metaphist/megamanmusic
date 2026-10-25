// The visualizer: the big hexagon chart with its legend and cards, the banner for the shown track, the shared
// audio player and its live response to the music, the game picker and the custom track list.
//
// app.js hands over its data, drawing helpers and hooks once with initViz, then reads what's on screen through
// the live exports G (the game or custom list) and pinned (the selected track). Only this file changes them.

// ---- From app.js (set by initViz) ----

// Data and drawing helpers
let GAMES, AXES, el, drawFrame, drawTop, triangle, ps, shapePts, hex, colorName, inkOn, digits, fmt;
let sprite, spriteOf, sprImg, badgeIcon, shortTitle, SINGLE, STACKED, setGrad, track;
// Hooks that keep the rest of the page in step: the link and history, the track table, the dot plot and favorite stars
let nav, syncHistory, markIntensity, markTable, markFavs;

const $ = id => document.getElementById(id);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---- State ----

// What's on screen: one game, or the custom list, which can mix tracks from any game.
// Both have the same shape: tracks, avg, color, cname, badges.
let current;
export { current as G };
// The selected track, as an index into current.tracks (null for none). Selecting a track with audio plays it.
export let pinned = null;
// The custom track list; its averages are refreshed whenever its tracks change
export const CUSTOM = { id: "custom", title: "Custom track list", custom: true, tracks: [], badges: [] };

// The big chart, and one shape in it per track (null for unscored tracks)
const big = $("big"), R = 118;
let layer, shapes = [];

const trackAt = i => i == null ? null : current.tracks[i];
const selected = () => trackAt(pinned);
// Where a track (by game and track index) sits in what's on screen, or -1
export const viewIndex = (gi, ti) => current ? current.tracks.findIndex(t => t.gi === gi && t.ti === ti) : -1;
export const isPinned = (gi, ti) => { const t = selected(); return !!t && t.gi === gi && t.ti === ti; };
const viewTitle = () => current.custom
  ? `Custom list (${plural(current.tracks.length, "track")})`
  : `${current.title} (${current.year || "upcoming"})`;

// ---- Choosing what's on screen ----

// Choosing a game clears the custom list (saved lists keep their copies)
export function setGame(gi) {
  if (CUSTOM.tracks.length) applyCustom([], false);
  setView(GAMES[gi]);
}

// Replaces the custom list. show = false updates it without switching the view to it (used when a game is chosen).
export function applyCustom(tracks, show = true) {
  CUSTOM.tracks = tracks;
  refreshCustom();
  syncCustomPicker();
  if (show) setView(CUSTOM, true);
  window.onCustomChange && window.onCustomChange();
}

function refreshCustom() {
  const scored = CUSTOM.scored = CUSTOM.tracks.filter(t => t.vals);
  CUSTOM.avg = scored.length ? [0, 1, 2].map(k => scored.reduce((sum, t) => sum + t.vals[k], 0) / scored.length) : null;
  CUSTOM.color = CUSTOM.avg ? hex(CUSTOM.avg) : null;
  CUSTOM.cname = CUSTOM.avg ? colorName(CUSTOM.avg) : null;
}

// Shows a game or the custom list, with nothing selected.
// keepPlaying: when the custom list changes, the playing track keeps playing if it is still in the list.
export function setView(view, keepPlaying) {
  const wasPlaying = keepPlaying ? selected() : null;
  current = view;
  pinned = null;
  const gi = GAMES.indexOf(current);
  syncHistory();
  $("gameSel").value = current.custom ? "custom" : gi;
  document.querySelectorAll("[data-game]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.game === gi));

  layer.replaceChildren();
  shapes = current.tracks.map(t => t.vals ? triangle(layer, t.vals, R, t.color, { grad: STACKED, w: 1.2 }) : null);
  if (!wasPlaying || !current.tracks.includes(wasPlaying)) player.pause();

  renderLegend();
  renderCards();
  listenToTrackButtons();
  show(null);
  audioIcons();
  markIntensity();
  markTable();

  // Re-select the track that was playing, without restarting it
  const k = wasPlaying ? current.tracks.indexOf(wasPlaying) : -1;
  if (k >= 0) {
    pinned = k;
    $("lg" + k)?.setAttribute("aria-pressed", true);
    $("cd" + k)?.setAttribute("aria-pressed", true);
    show(k);
    audioIcons();
    markTable();
    syncHistory();
  }
}

// Selects a track (null for none): marks it in the legend and cards, shows it and plays it
export function setPinned(i) {
  pinned = i;
  current.tracks.forEach((_, k) => {
    $("lg" + k)?.setAttribute("aria-pressed", k === i);
    $("cd" + k)?.setAttribute("aria-pressed", k === i);
  });
  show(i);
  syncAudio();
  markTable();
  syncHistory();
}

// ---- Legend and cards ----

function renderLegend() {
  const hasAudio = current.tracks.some(t => t.audio);
  const legend = $("legend");
  legend.classList.toggle("has-audio", hasAudio);
  legend.innerHTML = current.tracks.map((t, i) => legendItem(t, i, hasAudio)).join("")
    || `<li class="lgempty">No tracks yet. Use the custom track list above to add tracks from any game.</li>`;
}

// One legend row: play icon (when any track in the list has audio), color chip, name, color name and scores
function legendItem(t, i, hasAudio) {
  const selectable = t.vals || t.audio;
  const attrs = (selectable ? `data-i="${i}" aria-pressed="false"` : "disabled") + (t.audio ? ` aria-description="Plays the theme"` : "");
  const playSlot = !hasAudio ? "" : t.audio ? `<span class="pi" data-pi="${i}"></span>` : `<span></span>`;
  const chip = `<span class="chip ${t.vals ? "" : "empty"}" style="${t.vals ? `background:${t.color}` : ""}"></span>`;
  const game = current.custom ? `<small>${t.game.title}</small>` : "";
  return `<li><button type="button" id="lg${i}" ${attrs}>${playSlot}
  ${chip}<span class="nm">${sprite(t, "spr-inline")}${t.name}${game}</span>
  <span class="dln">${t.vals ? t.cname : "not scored"}</span><span class="digits">${t.vals ? digits(t.vals) : "–"}</span></button></li>`;
}

function renderCards() {
  const cards = $("cards");
  cards.replaceChildren();
  cards.style.setProperty("--cols", current.tracks.length % 3 === 0 ? 3 : 4);
  current.tracks.forEach((t, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card" + (t.vals ? "" : " unscored");
    card.id = "cd" + i;
    if (t.vals) { card.dataset.i = i; card.setAttribute("aria-pressed", "false"); }
    else card.disabled = true;
    card.innerHTML = cardHtml(t);
    cards.appendChild(card);

    const svg = card.querySelector("svg");
    drawFrame(svg, 58, false);
    if (t.vals) triangle(svg, t.vals, 58, t.color, { w: 1.6 });
    drawTop(svg, 58);
  });
}

// A card: color band, small hexagon (drawn after), name, credit line and a bar for each score
function cardHtml(t) {
  const bandStyle = t.vals ? `background:${t.color};color:${inkOn(t.vals)}` : "";
  const bandText = t.vals ? `${t.cname} · ${t.color}` : "not scored yet";
  // In a custom list the credit line also names the track's game
  const credit = [current.custom ? t.game.title : "", t.composer || t.game.composer].filter(Boolean).join(" · ");
  const bars = AXES.map((ax, k) => {
    const blocks = [1, 2, 3, 4, 5].map(n => `<b style="${t.vals && n <= t.vals[k] ? `background:var(${ax.tok})` : ""}"></b>`).join("");
    return `<div class="bar"><span>${ax.label}</span><i>${blocks}</i><span>${t.vals ? t.vals[k] : "–"}</span></div>`;
  }).join("");
  return `<div class="band" style="${bandStyle}">${bandText}${sprite(t, "spr-ghost")}</div>
    <div class="body"><svg viewBox="-70 -64 140 128" aria-hidden="true"></svg><div>
      <div class="nm">${t.name}</div>
      ${credit ? `<div class="cmp">${credit}</div>` : ""}
      <div class="bars">${bars}</div>
    </div></div>`;
}

// Legend rows and cards: hovering or focusing one previews it; clicking selects it, or clears it if it was selected.
// Previews are skipped while a track is playing, so the playing track's visualization stays put.
function listenToTrackButtons() {
  const preview = i => { if (pinned == null || player.paused) show(i); };
  document.querySelectorAll("[data-i]").forEach(b => {
    const i = +b.dataset.i;
    b.addEventListener("mouseenter", () => preview(i));
    b.addEventListener("mouseleave", () => preview(pinned));
    b.addEventListener("focus", () => preview(i));
    b.addEventListener("blur", () => preview(pinned));
    b.addEventListener("click", () => nav(() => setPinned(pinned === i ? null : i)));
  });
}

// ---- The chart and banner ----

// Shows a track (an index into current.tracks) in the chart and banner, or with null the game or list as a whole
function show(i) {
  highlightShape(i);
  renderBanner(trackAt(i));
}

// The shown track's shape stands out at full strength and the rest dim; with none shown, all are stacked evenly
function highlightShape(i) {
  const t = trackAt(i);
  shapes.forEach((shape, k) => {
    if (!shape) return;
    // A track with an identical shape is hidden while the shown one is focused,
    // so a static copy never sits on top of (or peeks out from) the live, animating one.
    const on = t != null && k === i;
    const twin = t != null && k !== i && current.tracks[k].code === t.code;
    shape.style.display = twin ? "none" : "";
    shape.classList.toggle("dim", t != null && !on);
    setGrad(shape, on ? SINGLE : STACKED);
    shape.classList.toggle("stacked", !on);
  });
  if (t && shapes[i]) layer.appendChild(shapes[i]);   // bring it to the front
}

// The banner above the chart: swatch, badges, sprite, serial, name, credit line, scores and the favorite star.
// For a game or list (t = null) it shows the averages and the game's badges.
function renderBanner(t) {
  const vals = t ? t.vals : current.avg, color = t ? t.color : current.color, cname = t ? t.cname : current.cname;
  const swatch = $("rSw"), name = $("rName");
  swatch.classList.toggle("empty", !vals);

  // The game's badges sit in its banner; a hovered or selected track shows none
  const badges = t ? [] : current.badges;
  $("rBadges").innerHTML = badges.map(b =>
    `<span class="rbadge" data-tip="${b.tip}">${badgeIcon(b).replace(/ data-tip="[^"]*"/, "")}</span>`).join("");
  swatch.classList.toggle("has-badges", badges.length > 0);
  swatch.style.setProperty("--nb", badges.length);

  const spriteBox = $("rSprite"), spr = spriteOf(t);
  spriteBox.hidden = !spr;
  spriteBox.innerHTML = spr ? sprImg(spr, 200, "", 4) : "";   // 4×, matching the faint sprites in the cards

  // In a custom list the track's game sits beside its serial here, not on the credit line
  const serial = $("rSerial");
  serial.textContent = t ? [current.custom ? t.game.title : "", t.dln].filter(Boolean).join(" · ") : "";
  serial.style.color = vals ? inkOn(vals) : "var(--muted)";

  // The shown track (selected or hovered) gets a favorite star at the right of its credit line and scores
  const star = $("rFav"), canFavorite = t && (t.vals || t.audio);
  star.hidden = !canFavorite;
  if (canFavorite) {
    star.dataset.fav = `${t.game.id}.${t.ti}`;
    star.setAttribute("aria-label", `Favorite ${t.name}, ${t.game.title}`);
    markFavs();
  }

  name.textContent = t ? t.name : viewTitle();
  if (!vals) {
    // An unscored track (playable for its audio), or a game or list with nothing scored
    swatch.style.background = "";
    name.style.color = "";
    $("rSub").textContent = t ? "not scored yet"
      : !current.custom ? "No stage themes scored yet"
        : current.tracks.length ? "None of these tracks are scored yet"
          : "Pick tracks from any game with the custom track list";
    $("rCode").innerHTML = "";
    return;
  }
  swatch.style.background = color;
  name.style.color = inkOn(vals);   // dark or light title for contrast
  $("rSub").textContent = t ? (t.composer || t.game.composer || "")
    : current.custom ? `Averages of the ${plural(current.scored.length, "scored track")} in your list`
      : (current.composer || "");
  $("rCode").innerHTML =
    AXES.map((ax, k) => `<span><span class="k">${ax.label.slice(0, 1)}</span> <span class="ch-${"rgb"[k]}">${fmt(vals[k], 2)}</span></span>`).join("") +
    `<span><b>${cname}</b> ${color}</span>`;
}

// ---- The player ----

// One shared player, tied to the selected track: selecting a track with audio plays it from the start;
// selecting one without audio, or none, pauses it
export const ICON_PLAY = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>`;
export const player = new Audio();

function syncAudio() {
  const t = selected();
  if (t && t.audio) {
    if (!player.src.endsWith(t.audio)) player.src = t.audio;
    player.currentTime = 0;
    connectAnalyser();
    player.play()
      .then(() => track("play_track", { track_name: t.name, game_id: t.game.id, game_title: t.game.title, custom_list: !!current.custom }))
      .catch(() => { })   // blocked until the visitor has interacted with the page
      .finally(audioIcons);
  } else player.pause();
  audioIcons();
}

// The play or pause icon in each legend row
function audioIcons() {
  document.querySelectorAll("[data-pi]").forEach(icon => {
    const on = +icon.dataset.pi === pinned && !player.paused;
    icon.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    icon.classList.toggle("on", on);
  });
}

// ---- Live audio response ----

// The playing track's shape pulses with the bass and glows with loudness, and its swatches and card band flash
// on the beat. Two more effects are kept for testing but switched off: a spectrum ring around the hexagon, and a
// dashed "live reading" that maps low/mid/high frequencies to Energy/Density/Gravity.
// Off for reduced motion; everything resets when playback stops.
const LIVE = { pulse: true, flicker: true, ring: false, ghost: true };
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PULSE_REST = .82;   // resting size of the playing shape, as a share of its true size
// Spectrum ring: bars in each mirrored half, inner radius and longest bar
const RING_BARS = 24, RING_R = R * 1.04, RING_LEN = 11;
// Per-band calibration from 13 tracks across the series: [5th percentile, median, 95th percentile] of each band's level.
// A band at its typical level reads 2.5; quiet passages fall toward 0.5 and loud ones rise toward 5.
const LIVE_CAL = [[.750, .948, .992], [.570, .760, .870], [.352, .588, .685]];
const toScale = (v, [lo, mid, hi]) => {
  const score = v < mid ? .5 + 2 * (v - lo) / (mid - lo) : 2.5 + 2.5 * (v - mid) / (hi - mid);
  return Math.max(.3, Math.min(5, score));
};

let audioCtx = null, analyser, bins, frameId = 0;
let ring, ringBars, ghost;   // drawn in initViz
// Smoothed readings, updated every frame
let bassLevel = 0;      // bass, following quickly
let loudness = 0;       // overall level
let bassAvg = 0;        // bass, slow average: a beat is bass rising above it
let beat = 0;           // jumps on a beat and decays between beats
let beatAvg = 0;        // slow average of beat, so the flicker centers on the base color
let restScale = 1;      // the playing shape's resting size, easing down to PULSE_REST
let reading = [0, 0, 0];   // the live reading's Energy, Density and Gravity

// Routes the player through an analyser the first time something plays (skipped for reduced motion)
function connectAnalyser() {
  if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
  if (REDUCED_MOTION) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = .75;
    audioCtx.createMediaElementSource(player).connect(analyser);
    analyser.connect(audioCtx.destination);
    bins = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { audioCtx = null; }
}

// Mean level (0–1) of the frequency bins between lo and hi Hz
function bandLevel(lo, hi) {
  const binHz = audioCtx.sampleRate / analyser.fftSize;
  const first = Math.max(1, Math.round(lo / binHz)), last = Math.min(bins.length - 1, Math.round(hi / binHz));
  let sum = 0;
  for (let i = first; i <= last; i++) sum += bins[i];
  return last >= first ? sum / (last - first + 1) / 255 : 0;
}

function startLive() {
  if (!audioCtx || !analyser) return;
  resetLive();
  const t = selected();
  if (!t) return;
  const fab = $("vizFab");
  if (fab && t.vals && LIVE.flicker) {
    fab.style.background = t.color;
    fab.style.color = inkOn(t.vals);
    fab.style.borderColor = "var(--halo)";
  }
  ring.setAttribute("stroke", t.color && contrastWithBg(t.color) >= 1.6 ? t.color : "var(--muted)");   // too close to the background → gray
  if (LIVE.ring) ring.setAttribute("opacity", .8);
  if (LIVE.ghost) ghost.setAttribute("opacity", .85);
  frameId = requestAnimationFrame(liveFrame);
}

function liveFrame() {
  frameId = requestAnimationFrame(liveFrame);
  analyser.getByteFrequencyData(bins);
  const bass = bandLevel(30, 160);
  bassLevel += (bass - bassLevel) * .35;
  loudness += (bandLevel(30, 8000) - loudness) * .2;
  bassAvg += (bass - bassAvg) * .04;
  beat = Math.max(Math.min(1, Math.max(0, (bass - bassAvg) * 10)), beat * .8);

  if (LIVE.flicker) flicker();
  if (LIVE.pulse) pulse();
  if (LIVE.ring) drawRing();
  if (LIVE.ghost) drawReading();
}

// Swings the swatches both ways around the base color: lighter on a beat, darker in the lull after it.
// The beat is measured against its own slow average, so the flash centers on the base color.
// Beats are short spikes with long lulls, so the dark side swings more gently to keep the two balanced.
function flicker() {
  beatAvg += (beat - beatAvg) * .03;
  const swing = beat - beatAvg;
  const brightness = Math.min(2.1, Math.max(.45, 1 + (swing > 0 ? 1.6 : .9) * swing));
  flickerTargets().forEach(e => e.style.filter = `brightness(${brightness.toFixed(3)})`);
}

// The selected track's swatches: legend chip, card band, banner, table-row swatch, dot-plot dot, game-profile strip,
// report row swatch, its bar in the report's all-colors strip, and the floating visualizer button.
// Looked up each frame, so the dot keeps flashing after the dot plot switches score.
function flickerTargets() {
  const t = selected();
  if (!t) return [];
  const q = sel => document.querySelector(sel), at = `[data-gi="${t.gi}"][data-ti="${t.ti}"]`;
  return [
    q(`#lg${pinned} .chip`), q(`#cd${pinned} .band`), $("rSw"), q("#trackTable tr.on .cc i"),
    q(`#ibars .idot${at}`), q(`#compare .strip span${at}`), q(`#rpBody .rp-row${at} .rp-col i`),
    q(`#rpBody .rp-all button[data-to-gi="${t.gi}"][data-to-ti="${t.ti}"]`),
    t.vals ? $("vizFab") : null,
  ].filter(Boolean);
}

// Pulses the playing shape: mostly beat-driven so it visibly pulses, plus a little steady swell from the bass level.
// While playing, the shape eases down to a smaller resting size so each beat has more room to grow,
// and the cap keeps the biggest beats inside the chart frame.
function pulse() {
  const shape = pinned == null ? null : shapes[pinned];
  if (!shape) return;
  restScale += (PULSE_REST - restScale) * .08;
  const scale = `scale(${Math.min(1.25, restScale * (1 + .06 * bassLevel * bassLevel + .55 * beat)).toFixed(4)})`;
  const glow = 3 + 20 * loudness + 28 * beat, color = current.tracks[pinned].color;
  shape.setAttribute("transform", scale);
  shape.style.filter = `drop-shadow(0 0 ${glow.toFixed(1)}px ${color})`;
  // Same pulse on the report row's small shape; its glow is halved to suit the smaller hexagon
  const small = reportShape();
  if (small) {
    small.setAttribute("transform", scale);
    small.style.filter = `drop-shadow(0 0 ${(glow / 2).toFixed(1)}px ${color})`;
  }
}

// The selected track's small hexagon shape in its full color report row
function reportShape() {
  const t = selected();
  return t && document.querySelector(`#rpBody .rp-hex[data-gi="${t.gi}"][data-ti="${t.ti}"] .tri`);
}

// Spectrum ring (off): bars around the hexagon, low frequencies at the top, mirrored left and right
function drawRing() {
  const binHz = audioCtx.sampleRate / analyser.fftSize, top = Math.min(bins.length - 1, Math.round(10000 / binHz));
  ringBars.forEach(({ x, y, line }, k) => {
    const j = k < RING_BARS ? k : RING_BARS * 2 - 1 - k;   // mirrored halves
    const v = bins[Math.round(1 + Math.pow(j / (RING_BARS - 1), 1.8) * (top - 1))] / 255;
    const outer = RING_R + 1 + RING_LEN * v * v;
    line.setAttribute("x1", (x * RING_R).toFixed(1));
    line.setAttribute("y1", (y * RING_R).toFixed(1));
    line.setAttribute("x2", (x * outer).toFixed(1));
    line.setAttribute("y2", (y * outer).toFixed(1));
  });
}

// Live reading (off): a dashed shape from the low, mid and high bands, eased toward each new reading
function drawReading() {
  const target = [bandLevel(30, 250), bandLevel(250, 2000), bandLevel(2000, 8000)].map((v, i) => toScale(v, LIVE_CAL[i]));
  reading = reading.map((v, i) => v + (target[i] - v) * .2);
  ghost.setAttribute("points", ps(shapePts(reading, R)));
}

function resetLive() {
  cancelAnimationFrame(frameId);
  frameId = 0;
  const unpulse = shape => { shape.removeAttribute("transform"); shape.style.filter = ""; };
  shapes.forEach(shape => shape && unpulse(shape));
  document.querySelectorAll("#rpBody .rp-hex .tri").forEach(unpulse);
  ring.setAttribute("opacity", 0);
  ghost.setAttribute("opacity", 0);
  document.querySelectorAll(".legend .chip, .card .band, #rSw, #trackTable .cc i, #ibars .idot, #compare .strip span, #rpBody .rp-col i, #rpBody .rp-all button")
    .forEach(e => e.style.filter = "");
  const fab = $("vizFab");
  if (fab) fab.style.filter = fab.style.background = fab.style.color = fab.style.borderColor = "";
  bassLevel = loudness = bassAvg = beat = beatAvg = 0;
  restScale = 1;
  reading = [0, 0, 0];
}

// Contrast between a hex color and the page background, to keep the ring visible on either theme
function contrastWithBg(hexColor) {
  const channel = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const luminance = rgb => { const [r, g, b] = rgb.map(channel); return .2126 * r + .7152 * g + .0722 * b; };
  const fg = [1, 3, 5].map(i => parseInt(hexColor.slice(i, i + 2), 16));
  const bg = getComputedStyle(document.body).backgroundColor.match(/[0-9.]+/g).slice(0, 3).map(Number);
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

// ---- Pickers ----

// Game picker: every game, then the custom list
function setupGamePicker() {
  const sel = $("gameSel");
  sel.innerHTML = GAMES.map((g, i) => `<option value="${i}">${g.title}${g.year ? ` (${g.year})` : ""}</option>`).join("")
    + `<option value="custom">Custom track list</option>`;
  sel.addEventListener("change", () => {
    nav(() => { if (sel.value === "custom") setView(CUSTOM); else setGame(+sel.value); });
  });
}

// Custom track list: a multi-select of every scored or playable track, grouped by game. Each checked track is added
// to the end of the list (and the hexagon, legend and cards); unchecking removes it. Changes switch the view to the list.
function setupCustomPicker() {
  const btn = $("customBtn"), panel = $("customPanel"), list = $("customList"), filter = $("customFilter");
  list.innerHTML = GAMES.map(g => {
    const opts = g.tracks.filter(t => t.vals || t.audio);
    if (!opts.length) return "";
    return `<div class="cgrp"><div class="cgh">${g.title}</div>${opts.map(t => customOption(t, g)).join("")}</div>`;
  }).join("");

  list.addEventListener("change", e => {
    const c = e.target;
    if (!c.dataset.gi) return;
    const t = GAMES[+c.dataset.gi].tracks[+c.dataset.ti];
    // Editing the list on screen updates its history entry; switching to it from a game makes a new one
    const edit = () => applyCustom(c.checked ? [...CUSTOM.tracks, t] : CUSTOM.tracks.filter(x => x !== t));
    if (current.custom) edit(); else nav(edit);
  });

  const open = on => {
    panel.hidden = !on;
    btn.setAttribute("aria-expanded", on);
    if (on) { filter.value = ""; filter.dispatchEvent(new Event("input")); filter.focus(); }
  };
  btn.addEventListener("click", () => open(panel.hidden));
  $("customDone").addEventListener("click", () => { open(false); btn.focus(); });
  $("customClear").addEventListener("click", () => applyCustom([]));
  document.addEventListener("mousedown", e => { if (!panel.hidden && !e.target.closest(".cpick")) open(false); });
  panel.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); open(false); btn.focus(); } });

  // The filter box matches every word against the track name and game
  filter.addEventListener("input", () => {
    const words = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    list.querySelectorAll(".copt").forEach(o => o.hidden = !words.every(w => o.dataset.hay.includes(w)));
    list.querySelectorAll(".cgrp").forEach(g => g.hidden = !g.querySelector(".copt:not([hidden])"));
  });

  refreshCustom();
  syncCustomPicker();
}

// One checkbox row: color chip, track name and scores
function customOption(t, g) {
  const hay = (t.name + " " + g.title + " " + shortTitle(g)).toLowerCase();
  return `<label class="copt" data-hay="${hay}">
      <input type="checkbox" data-gi="${t.gi}" data-ti="${t.ti}"><i class="${t.vals ? "" : "chip empty"}" style="${t.vals ? `background:${t.color}` : ""}"></i>
      <span>${t.name}</span><span class="cd">${t.vals ? digits(t.vals) : "–"}</span></label>`;
}

// The picker's button text, count and checkboxes follow the list
function syncCustomPicker() {
  const n = CUSTOM.tracks.length;
  $("customBtnText").textContent = n ? `${plural(n, "track")} selected` : "Pick tracks from any game";
  $("customCount").textContent = `${n} selected`;
  $("customList").querySelectorAll("input").forEach(c => {
    c.checked = CUSTOM.tracks.some(t => t.gi === +c.dataset.gi && t.ti === +c.dataset.ti);
  });
}

// ---- Setup ----

export function initViz(deps) {
  ({
    GAMES, AXES, el, drawFrame, drawTop, triangle, ps, shapePts, hex, colorName, inkOn, digits, fmt,
    sprite, spriteOf, sprImg, badgeIcon, shortTitle, SINGLE, STACKED, setGrad, track,
    nav, syncHistory, markIntensity, markTable, markFavs,
  } = deps);
  drawChart();
  ["play", "pause", "ended"].forEach(e => player.addEventListener(e, audioIcons));
  player.addEventListener("playing", startLive);
  ["pause", "ended", "emptied"].forEach(e => player.addEventListener(e, resetLive));
  setupGamePicker();
  setupCustomPicker();
}

// The big chart's frame and the layer its shapes go in, plus the live ring and reading (hidden until used)
function drawChart() {
  drawFrame(big, R, true);
  layer = el("g", {}, big);
  drawTop(big, R);

  ring = el("g", { "pointer-events": "none", opacity: 0, "stroke-linecap": "round", "stroke-width": 2.2 });
  big.insertBefore(ring, big.firstChild);   // behind the frame labels
  ringBars = Array.from({ length: RING_BARS * 2 }, (_, k) => {
    const a = (k + .5) / (RING_BARS * 2) * 2 * Math.PI;   // clockwise from the top
    return { x: Math.sin(a), y: -Math.cos(a), line: el("line", {}, ring) };
  });
  ghost = el("polygon", {
    fill: "none", stroke: "var(--ink)", "stroke-width": 1.4, "stroke-dasharray": "4 3",
    "stroke-linejoin": "round", opacity: 0, "pointer-events": "none"
  }, big);
}
