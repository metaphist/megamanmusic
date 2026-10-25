// The visualizer: the big hexagon chart, its legend and cards, the track banner, the shared player and its
// live audio response, the game picker and the custom track list.
// app.js hands over the data, drawing helpers and its own hooks (initViz), and reads the current game or list (G)
// and selected track (pinned) through the live exports; only this file changes them.

// From app.js, set by initViz. The hooks keep the link, track table, dot plot and favorite stars in step.
let GAMES, AXES, el, drawFrame, drawTop, triangle, ps, shapePts, hex, colorName, inkOn, digits, fmt, sprite, spriteOf, sprImg, badgeIcon, shortTitle, SINGLE, STACKED, setGrad, track;
let nav, syncHistory, markIntensity, markTable, markFavs;

// Static frame for the big chart (drawn in initViz)
const big = document.getElementById("big"), R = 118;
let layer, ringG, ringBars, ghost, syncCustom = () => { };

// One shared player, tied to the pinned track: pinning a track with audio plays it, unpinning pauses it
export const ICON_PLAY = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>`;
export const player = new Audio();
function audioIcons() {
  document.querySelectorAll("[data-pi]").forEach(s => {
    const on = +s.dataset.pi === pinned && !player.paused;
    s.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    s.classList.toggle("on", on);
  });
}
function syncAudio() {
  const t = pinned == null ? null : G.tracks[pinned];
  if (t && t.audio) {
    if (!player.src.endsWith(t.audio)) { player.src = t.audio; }
    player.currentTime = 0;
    ensureAnalyser();
    player.play().then(() => track("play_track", { track_name: t.name, game_id: t.game.id, game_title: t.game.title, custom_list: !!G.custom }))
      .catch(() => { }).finally(audioIcons);
  } else player.pause();
  audioIcons();
}

// Live audio response: the playing track's shape pulses with the bass and glows with loudness, and its swatches and
// card band flash on the beat. Two more effects are kept for testing but switched off: a spectrum ring around the
// hexagon, and a dashed "live reading" that maps low/mid/high frequencies to Energy/Density/Gravity.
// Off for reduced motion; everything resets when playback stops.
const LIVE = { pulse: true, flicker: true, ring: false, ghost: false };
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RING_N = 24, RING_R = R * 1.04, RING_LEN = 11;
// Per-band calibration from 13 tracks across the series: [5th percentile, median, 95th percentile] of each band's level.
// A band at its typical level reads 2.5; quiet passages fall toward 0.5 and loud ones rise toward 5.
const LIVE_CAL = [[.750, .948, .992], [.570, .760, .870], [.352, .588, .685]];
const toScale = (v, [lo, mid, hi]) => Math.max(.3, Math.min(5, v < mid ? .5 + 2 * (v - lo) / (mid - lo) : 2.5 + 2.5 * (v - mid) / (hi - mid)));
// Contrast between a hex color and the page background, to keep the ring visible on either theme
function contrastWithBg(hexColor) {
  const lum = rgb => { const c = rgb.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const bg = getComputedStyle(document.body).backgroundColor.match(/[0-9.]+/g).slice(0, 3).map(Number);
  const a = lum([1, 3, 5].map(i => parseInt(hexColor.slice(i, i + 2), 16))), b = lum(bg);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
let actx = null, analyser, freq, raf = 0, live = [0, 0, 0], bassS = 0, loudS = 0, bassSlow = 0, beatS = 0, beatAvg = 0, restS = 1;
const PULSE_REST = .82;   // resting size of the playing shape, as a share of its true size
// The playing track's swatches: legend chip, card band, side-panel banner, table-row swatch, dot-plot dot,
// game-profile strip, report row swatch and its bar in the report's all-colors strip
// (looked up each frame, so the dot keeps flashing after the dot plot switches score)
const flickerEls = () => pinned == null ? [] : [document.querySelector(`#lg${pinned} .chip`), document.querySelector(`#cd${pinned} .band`),
document.getElementById("rSw"), document.querySelector("#trackTable tr.on .cc i"),
document.querySelector(`#ibars .idot[data-gi="${G.tracks[pinned].gi}"][data-ti="${G.tracks[pinned].ti}"]`),
document.querySelector(`#compare .strip span[data-gi="${G.tracks[pinned].gi}"][data-ti="${G.tracks[pinned].ti}"]`),
document.querySelector(`#rpBody .rp-row[data-gi="${G.tracks[pinned].gi}"][data-ti="${G.tracks[pinned].ti}"] .rp-col i`),
document.querySelector(`#rpBody .rp-all button[data-to-gi="${G.tracks[pinned].gi}"][data-to-ti="${G.tracks[pinned].ti}"]`),
G.tracks[pinned].vals ? document.getElementById("vizFab") : null].filter(Boolean);
// The playing track's small hexagon shape in the full color report row, pulsed along with the big one
const reportShape = () => pinned == null ? null : document.querySelector(`#rpBody .rp-hex[data-gi="${G.tracks[pinned].gi}"][data-ti="${G.tracks[pinned].ti}"] .tri`);
function ensureAnalyser() {
  if (actx || REDUCED) { if (actx && actx.state === "suspended") actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser();
    analyser.fftSize = 512; analyser.smoothingTimeConstant = .75;
    actx.createMediaElementSource(player).connect(analyser);
    analyser.connect(actx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { actx = null; }
}
// Mean level (0–1) of the frequency bins between lo and hi Hz
function band(lo, hi) {
  const w = actx.sampleRate / analyser.fftSize;
  let sum = 0, n = 0;
  for (let i = Math.max(1, Math.round(lo / w)); i <= Math.min(freq.length - 1, Math.round(hi / w)); i++) { sum += freq[i]; n++; }
  return n ? sum / n / 255 : 0;
}
function liveFrame() {
  raf = requestAnimationFrame(liveFrame);
  const g = pinned == null ? null : tris[pinned];
  analyser.getByteFrequencyData(freq);
  const bass = band(30, 160);
  bassS += (bass - bassS) * .35;
  loudS += (band(30, 8000) - loudS) * .2;
  // A beat is bass rising above its slow average; it jumps on the beat and decays between beats
  bassSlow += (bass - bassSlow) * .04;
  beatS = Math.max(Math.min(1, Math.max(0, (bass - bassSlow) * 10)), beatS * .8);
  if (LIVE.flicker) {
    // Swing both ways around the base color: lighter on a beat, darker in the lull after it.
    // The beat is measured against its own slow average, so the flash centers on the base color.
    // Beats are short spikes with long lulls, so the dark side swings more gently to keep the two balanced.
    beatAvg += (beatS - beatAvg) * .03;
    const swing = beatS - beatAvg;
    const fx = `brightness(${Math.min(2.1, Math.max(.45, 1 + (swing > 0 ? 1.6 : .9) * swing)).toFixed(3)})`;
    flickerEls().forEach(e => e.style.filter = fx);
  }
  if (g && LIVE.pulse) {
    // Mostly beat-driven so the shape visibly pulses, plus a little steady swell from the overall bass level.
    // While playing, the shape eases down to a smaller resting size so each beat has more room to grow,
    // and the cap keeps the biggest beats inside the chart frame.
    restS += (PULSE_REST - restS) * .08;
    const sc = `scale(${Math.min(1.25, restS * (1 + .06 * bassS * bassS + .55 * beatS)).toFixed(4)})`, glow = 3 + 20 * loudS + 28 * beatS;
    g.setAttribute("transform", sc);
    g.style.filter = `drop-shadow(0 0 ${glow.toFixed(1)}px ${G.tracks[pinned].color})`;
    // Same pulse on the report row's small shape; its glow is halved to suit the smaller hexagon
    const m = reportShape();
    if (m) { m.setAttribute("transform", sc); m.style.filter = `drop-shadow(0 0 ${(glow / 2).toFixed(1)}px ${G.tracks[pinned].color})`; }
  }
  if (LIVE.ring) {
    const w = actx.sampleRate / analyser.fftSize, top = Math.min(freq.length - 1, Math.round(10000 / w));
    ringBars.forEach(({ x, y, line }, k) => {
      const j = k < RING_N ? k : RING_N * 2 - 1 - k;   // mirrored halves
      const v = freq[Math.round(1 + Math.pow(j / (RING_N - 1), 1.8) * (top - 1))] / 255;
      const r2 = RING_R + 1 + RING_LEN * v * v;
      line.setAttribute("x1", (x * RING_R).toFixed(1)); line.setAttribute("y1", (y * RING_R).toFixed(1));
      line.setAttribute("x2", (x * r2).toFixed(1)); line.setAttribute("y2", (y * r2).toFixed(1));
    });
  }
  if (LIVE.ghost) {
    const target = [band(30, 250), band(250, 2000), band(2000, 8000)].map((v, i) => toScale(v, LIVE_CAL[i]));
    live = live.map((v, i) => v + (target[i] - v) * .2);
    ghost.setAttribute("points", ps(shapePts(live, R)));
  }
}
function resetLive() {
  cancelAnimationFrame(raf); raf = 0;
  (tris || []).forEach(g => { if (g) { g.removeAttribute("transform"); g.style.filter = ""; } });
  document.querySelectorAll("#rpBody .rp-hex .tri").forEach(g => { g.removeAttribute("transform"); g.style.filter = ""; });
  ringG.setAttribute("opacity", 0); ghost.setAttribute("opacity", 0);
  document.querySelectorAll(".legend .chip, .card .band, #rSw, #trackTable .cc i, #ibars .idot, #compare .strip span, #rpBody .rp-col i, #rpBody .rp-all button").forEach(e => e.style.filter = "");
  const fab = document.getElementById("vizFab");
  if (fab) { fab.style.filter = fab.style.background = fab.style.color = fab.style.borderColor = ""; }
  live = [0, 0, 0]; bassS = loudS = bassSlow = beatS = beatAvg = 0; restS = 1;
}
function startLive() {
  if (!actx || !analyser) return;
  resetLive();
  const t = pinned == null ? null : G.tracks[pinned];
  if (!t) return;
  const fab = document.getElementById("vizFab");
  if (fab && t.vals && LIVE.flicker) { fab.style.background = t.color; fab.style.color = inkOn(t.vals); fab.style.borderColor = "var(--halo)"; }
  ringG.setAttribute("stroke", t.color && contrastWithBg(t.color) >= 1.6 ? t.color : "var(--muted)");   // too close to the background → gray
  if (LIVE.ring) ringG.setAttribute("opacity", .8);
  if (LIVE.ghost) ghost.setAttribute("opacity", .85);
  raf = requestAnimationFrame(liveFrame);
}

// The view (G) is either one game or the custom track list, which can mix tracks from any game.
// Both have the same shape: tracks, avg, color, cname, badges. pinned is an index into G.tracks.
export let G, pinned = null;
let tris;
export const CUSTOM = { id: "custom", title: "Custom track list", custom: true, tracks: [], badges: [] };
function refreshCustom() {
  const s = CUSTOM.scored = CUSTOM.tracks.filter(t => t.vals);
  CUSTOM.avg = s.length ? [0, 1, 2].map(i => s.reduce((a, t) => a + t.vals[i], 0) / s.length) : null;
  CUSTOM.color = CUSTOM.avg ? hex(CUSTOM.avg) : null;
  CUSTOM.cname = CUSTOM.avg ? colorName(CUSTOM.avg) : null;
}
export const viewIndex = (gi, ti) => G ? G.tracks.findIndex(t => t.gi === gi && t.ti === ti) : -1;
export const isPinned = (gi, ti) => pinned != null && G.tracks[pinned].gi === gi && G.tracks[pinned].ti === ti;
const viewTitle = () => G.custom ? `Custom list (${G.tracks.length} track${G.tracks.length === 1 ? "" : "s"})` : `${G.title} (${G.year || "upcoming"})`;
// Choosing a game clears the custom list (saved lists keep their copies)
export function setGame(gi) {
  if (CUSTOM.tracks.length) applyCustom([], false);
  setView(GAMES[gi]);
}
// keepPlaying: when the custom list changes, the playing track keeps playing if it is still in the list
export function setView(view, keepPlaying) {
  const prev = keepPlaying && pinned != null ? G.tracks[pinned] : null;
  G = view; pinned = null;
  const gi = GAMES.indexOf(G);
  syncHistory();
  document.getElementById("gameSel").value = G.custom ? "custom" : gi;
  document.querySelectorAll("[data-game]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.game === gi));

  layer.replaceChildren();
  tris = G.tracks.map(t => t.vals ? triangle(layer, t.vals, R, t.color, { grad: STACKED, w: 1.2 }) : null);

  if (!prev || !G.tracks.includes(prev)) player.pause();
  const hasAudio = G.tracks.some(t => t.audio);
  const legend = document.getElementById("legend");
  legend.classList.toggle("has-audio", hasAudio);
  const playSlot = (t, i) => !hasAudio ? "" : t.audio ? `<span class="pi" data-pi="${i}"></span>` : `<span></span>`;
  legend.innerHTML = G.tracks.map((t, i) => `<li><button type="button" id="lg${i}" ${t.vals || t.audio ? `data-i="${i}" aria-pressed="false"` : "disabled"}${t.audio ? ` aria-description="Plays the theme"` : ""}>${playSlot(t, i)}
  <span class="chip ${t.vals ? "" : "empty"}" style="${t.vals ? `background:${t.color}` : ""}"></span><span class="nm">${sprite(t, "spr-inline")}${t.name}${G.custom ? `<small>${t.game.title}</small>` : ""}</span>
  <span class="dln">${t.vals ? t.cname : "not scored"}</span><span class="digits">${t.vals ? digits(t.vals) : "–"}</span></button></li>`).join("")
    || `<li class="lgempty">No tracks yet. Use the custom track list above to add tracks from any game.</li>`;

  const cards = document.getElementById("cards");
  cards.replaceChildren();
  cards.style.setProperty("--cols", G.tracks.length % 3 === 0 ? 3 : 4);
  G.tracks.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "card" + (t.vals ? "" : " unscored"); b.id = "cd" + i;
    if (t.vals) { b.dataset.i = i; b.setAttribute("aria-pressed", "false"); } else b.disabled = true;
    b.innerHTML = `<div class="band" style="${t.vals ? `background:${t.color};color:${inkOn(t.vals)}` : ""}">${t.vals ? `${t.cname} · ${t.color}` : "not scored yet"}${sprite(t, "spr-ghost")}</div>
    <div class="body"><svg viewBox="-70 -64 140 128" aria-hidden="true"></svg><div>
      <div class="nm">${t.name}</div>
      ${(() => { const c = [G.custom ? t.game.title : "", t.composer || t.game.composer].filter(Boolean).join(" · "); return c ? `<div class="cmp">${c}</div>` : ""; })()}
      <div class="bars">${AXES.map((ax, k) => `<div class="bar"><span>${ax.label}</span><i>${[1, 2, 3, 4, 5].map(n => `<b style="${t.vals && n <= t.vals[k] ? `background:var(${ax.tok})` : ""}"></b>`).join("")}</i><span>${t.vals ? t.vals[k] : "–"}</span></div>`).join("")}</div>
    </div></div>`;
    cards.appendChild(b);
    const s = b.querySelector("svg");
    drawFrame(s, 58, false);
    if (t.vals) triangle(s, t.vals, 58, t.color, { w: 1.6 });
    drawTop(s, 58);
  });

  // Hover/focus previews another track, except while one is playing: the playing track's visualization stays put
  const playing = () => pinned != null && !player.paused;
  const preview = i => { if (!playing()) show(i); };
  document.querySelectorAll("[data-i]").forEach(b => {
    const i = +b.dataset.i;
    b.addEventListener("mouseenter", () => preview(i));
    b.addEventListener("mouseleave", () => preview(pinned));
    b.addEventListener("focus", () => preview(i));
    b.addEventListener("blur", () => preview(pinned));
    b.addEventListener("click", () => nav(() => setPinned(pinned === i ? null : i)));
  });
  show(null);
  audioIcons();
  markIntensity();
  markTable();
  // Re-select the track that was playing, without restarting it
  const k = prev ? G.tracks.indexOf(prev) : -1;
  if (k >= 0) {
    pinned = k;
    document.getElementById("lg" + k)?.setAttribute("aria-pressed", true);
    document.getElementById("cd" + k)?.setAttribute("aria-pressed", true);
    show(k); audioIcons(); markTable(); syncHistory();
  }
}

function show(i) {
  const t = i == null ? null : G.tracks[i];
  tris.forEach((g, k) => {
    if (!g) return;
    // Only the focused track is "on". A track with an identical shape is hidden while it's focused,
    // so a static copy never sits on top of (or peeks out from) the live, animating one.
    const on = t != null && k === i;
    const twin = t != null && k !== i && G.tracks[k].code === t.code;
    g.style.display = twin ? "none" : "";
    g.classList.toggle("dim", t != null && !on);
    setGrad(g, on ? SINGLE : STACKED);
    g.classList.toggle("stacked", !on);
  });
  if (t && tris[i]) layer.appendChild(tris[i]);
  const vals = t ? t.vals : G.avg, color = t ? t.color : G.color, cname = t ? t.cname : G.cname;
  const sw = document.getElementById("rSw");
  sw.classList.toggle("empty", !vals);
  // The game's badges sit in its banner; a hovered or selected track shows none
  const badges = t ? [] : G.badges;
  document.getElementById("rBadges").innerHTML = badges.map(b =>
    `<span class="rbadge" data-tip="${b.tip}">${badgeIcon(b).replace(/ data-tip="[^"]*"/, "")}</span>`).join("");
  sw.classList.toggle("has-badges", badges.length > 0);
  sw.style.setProperty("--nb", badges.length);
  const rs = document.getElementById("rSprite"), spr = spriteOf(t);
  rs.hidden = !spr; rs.innerHTML = spr ? sprImg(spr, 200, "", 4) : "";   // 4×, matching the faint sprites in the cards
  const serial = document.getElementById("rSerial");
  // In a custom list the track's game sits beside its serial here, not on the composer line
  serial.textContent = t ? [G.custom ? t.game.title : "", t.dln].filter(Boolean).join(" · ") : "";
  serial.style.color = vals ? inkOn(vals) : "var(--muted)";
  // The shown track (selected or hovered) gets a favorite star at the right of its composer and scores
  const rFav = document.getElementById("rFav"), favT = t && (t.vals || t.audio);
  rFav.hidden = !favT;
  if (favT) { rFav.dataset.fav = `${t.game.id}.${t.ti}`; rFav.setAttribute("aria-label", `Favorite ${t.name}, ${t.game.title}`); markFavs(); }
  if (!vals) {
    sw.style.background = "";
    document.getElementById("rName").style.color = "";
    // An unscored track (playable for its audio) or a game with nothing scored
    document.getElementById("rName").textContent = t ? t.name : viewTitle();
    document.getElementById("rSub").textContent = t ? "not scored yet"
      : G.custom ? (G.tracks.length ? "None of these tracks are scored yet" : "Pick tracks from any game with the custom track list") : "No stage themes scored yet";
    document.getElementById("rCode").innerHTML = "";
    return;
  }
  document.getElementById("rSw").style.background = color;
  document.getElementById("rName").style.color = inkOn(vals);   // dark or light title for contrast
  document.getElementById("rName").textContent = t ? t.name : viewTitle();
  document.getElementById("rSub").textContent = t ? (t.composer || t.game.composer || "")
    : G.custom ? `Averages of the ${G.scored.length} scored track${G.scored.length === 1 ? "" : "s"} in your list` : (G.composer || "");
  document.getElementById("rCode").innerHTML =
    AXES.map((ax, k) => `<span><span class="k">${ax.label.slice(0, 1)}</span> <span class="ch-${"rgb"[k]}">${fmt(vals[k], 2)}</span></span>`).join("") +
    `<span><b>${cname}</b> ${color}</span>`;
}
export function setPinned(i) {
  pinned = i;
  G.tracks.forEach((t, k) => {
    document.getElementById("lg" + k)?.setAttribute("aria-pressed", k === i);
    document.getElementById("cd" + k)?.setAttribute("aria-pressed", k === i);
  });
  show(i);
  syncAudio();
  markTable();
  syncHistory();
}
// show = false updates the list without switching the view to it (used when a game is chosen)
export function applyCustom(tracks, show = true) {
  CUSTOM.tracks = tracks; refreshCustom(); syncCustom();
  if (show) setView(CUSTOM, true);
  window.onCustomChange && window.onCustomChange();
}

export function initViz(ctx) {
  ({ GAMES, AXES, el, drawFrame, drawTop, triangle, ps, shapePts, hex, colorName, inkOn, digits, fmt, sprite, spriteOf, sprImg, badgeIcon, shortTitle, SINGLE, STACKED, setGrad, track, nav, syncHistory, markIntensity, markTable, markFavs } = ctx);
  drawFrame(big, R, true);
  layer = el("g", {}, big);
  drawTop(big, R);
  ["play", "pause", "ended"].forEach(e => player.addEventListener(e, audioIcons));

  // Live audio pieces: the spectrum ring and the dashed live reading (both switched off in LIVE)
  ringG = el("g", { "pointer-events": "none", opacity: 0, "stroke-linecap": "round", "stroke-width": 2.2 });
  big.insertBefore(ringG, big.firstChild);   // behind the frame labels
  ringBars = Array.from({ length: RING_N * 2 }, (_, k) => {
    const a = (k + .5) / (RING_N * 2) * 2 * Math.PI;   // clockwise from the top
    return { x: Math.sin(a), y: -Math.cos(a), line: el("line", {}, ringG) };
  });
  ghost = el("polygon", {
    fill: "none", stroke: "var(--ink)", "stroke-width": 1.4, "stroke-dasharray": "4 3",
    "stroke-linejoin": "round", opacity: 0, "pointer-events": "none"
  }, big);
  player.addEventListener("playing", startLive);
  ["pause", "ended", "emptied"].forEach(e => player.addEventListener(e, resetLive));

  // Game picker: every game, then the custom list
  document.getElementById("gameSel").innerHTML = GAMES.map((g, i) => `<option value="${i}">${g.title}${g.year ? ` (${g.year})` : ""}</option>`).join("")
    + `<option value="custom">Custom track list</option>`;
  document.getElementById("gameSel").addEventListener("change", e => {
    nav(() => { if (e.target.value === "custom") setView(CUSTOM); else setGame(+e.target.value); });
  });

  // Custom track list: a multi-select of every scored or playable track, grouped by game. Each checked track is added
  // to the end of the list (and the hexagon, legend and cards); unchecking removes it. Changes switch the view to the list.
  {
    const btn = document.getElementById("customBtn"), panel = document.getElementById("customPanel");
    const list = document.getElementById("customList"), filter = document.getElementById("customFilter");
    list.innerHTML = GAMES.map(g => {
      const opts = g.tracks.filter(t => t.vals || t.audio);
      return opts.length ? `<div class="cgrp"><div class="cgh">${g.title}</div>${opts.map(t => `<label class="copt" data-hay="${(t.name + " " + g.title + " " + shortTitle(g)).toLowerCase()}">
      <input type="checkbox" data-gi="${t.gi}" data-ti="${t.ti}"><i class="${t.vals ? "" : "chip empty"}" style="${t.vals ? `background:${t.color}` : ""}"></i>
      <span>${t.name}</span><span class="cd">${t.vals ? digits(t.vals) : "–"}</span></label>`).join("")}</div>` : "";
    }).join("");
    const sync = () => {
      const n = CUSTOM.tracks.length;
      document.getElementById("customBtnText").textContent = n ? `${n} track${n === 1 ? "" : "s"} selected` : "Pick tracks from any game";
      document.getElementById("customCount").textContent = `${n} selected`;
      list.querySelectorAll("input").forEach(c => { c.checked = CUSTOM.tracks.some(t => t.gi === +c.dataset.gi && t.ti === +c.dataset.ti); });
    };
    syncCustom = sync;
    list.addEventListener("change", e => {
      const c = e.target; if (!c.dataset.gi) return;
      const t = GAMES[+c.dataset.gi].tracks[+c.dataset.ti];
      // Editing the list on screen updates its history entry; switching to it from a game makes a new one
      const edit = () => applyCustom(c.checked ? [...CUSTOM.tracks, t] : CUSTOM.tracks.filter(x => x !== t));
      if (G.custom) edit(); else nav(edit);
    });
    const open = on => {
      panel.hidden = !on; btn.setAttribute("aria-expanded", on);
      if (on) { filter.value = ""; filter.dispatchEvent(new Event("input")); filter.focus(); }
    };
    btn.addEventListener("click", () => open(panel.hidden));
    document.getElementById("customDone").addEventListener("click", () => { open(false); btn.focus(); });
    document.getElementById("customClear").addEventListener("click", () => applyCustom([]));
    filter.addEventListener("input", () => {
      const q = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      list.querySelectorAll(".copt").forEach(o => o.hidden = !q.every(w => o.dataset.hay.includes(w)));
      list.querySelectorAll(".cgrp").forEach(g => g.hidden = !g.querySelector(".copt:not([hidden])"));
    });
    document.addEventListener("mousedown", e => { if (!panel.hidden && !e.target.closest(".cpick")) open(false); });
    panel.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); open(false); btn.focus(); } });
    refreshCustom(); sync();
  }
}
