// A robot master's profile page, drafted for Gyro Man: everything the project knows about one track, worked out from the
// same data as the other pages (model.js and scores.csv), so it follows any score change.
import { AXES, GAMES, RELEASE_ORDER, average, tableTitle } from "./model.js";
import { METRICS, RATINGS, gradeOf, rangeOf, totalOf } from "./grades.js";
import { digits, hex, inkOn, intensity } from "./colors.js";
import { drawFrame, drawTop, spriteOf, sprImg, triangle } from "./draw.js";
import { ICON_PLAY, ICON_STOP } from "../data/icons.js";
import { liveAudio } from "./live.js";
import { $, esc, plural, setupTheme, track } from "./util.js";

const game = GAMES.find(g => g.id === "mm5");
const me = game.tracks.find(t => t.name === "Gyro Man");

// The track's sections and movement score, typed in from ranking.md, the only place they're recorded. "Highest in its
// game" is checked against that file's Mega Man 5 list by hand, so it needs updating if those scores change.
const MOVEMENT = {
  score: 5,
  note: "the highest in its game",
  sections: [["i", "Intro"], ["a", "Section"], ["b", "Section"], ["c", "Section"], ["o", "Outro"]],
};

const named = t => t.name !== "???";
const allTracks = RELEASE_ORDER.flatMap(g => g.tracks).filter(named);
const scored = allTracks.filter(t => t.vals);
const graded = allTracks.filter(t => t.ratings);
const ratingTotal = t => t.ratings ? totalOf(t.ratings) : -1;

const ordinal = n => {
  const v = n % 100, suffix = ["th", "st", "nd", "rd"];
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
};

// This track's place by total rating in some graded tracks, like "Tied for 3rd of 121"
function placeIn(pool) {
  const above = pool.filter(t => ratingTotal(t) > ratingTotal(me)).length;
  const tied = pool.filter(t => ratingTotal(t) === ratingTotal(me)).length > 1;
  return `${tied ? "Tied for " : ""}${ordinal(above + 1)} of ${pool.length}`;
}

// A score in words, from its axis's two ends
function reading(ax, v) {
  const lo = ax.lo.toLowerCase(), hi = ax.hi.toLowerCase();
  return [`Fully ${lo}`, `Leans ${lo}`, `Between ${lo} and ${hi}`, `Leans ${hi}`, `Fully ${hi}`][v - 1];
}

// A link that opens a track in the visualizer
const vizLink = t => `./?game=${t.game.id}&track=${t.ti}`;

// ---- Sections ----

function hero() {
  const grade = gradeOf(me.ratings);
  const facts = [
    ["Serial", esc(me.dln)],
    ["Game", `${esc(game.title)} (${game.year})`],
    ["Composer", esc(me.composer || game.composer)],
    ["Color", `${esc(me.cname)} <span class="pf-mono">${me.color}</span>`],
    ["Scores", `<span class="pf-digits">${digits(me.vals)}</span>`],
    ["Grade", `<span class="tl-${grade.letter} pf-grade"><span class="tl-chip">${grade.letter}</span>${grade.word}</span>`],
    ["Length", `<span class="pf-mono" id="pfLength">–</span>`],
  ];
  return `<section class="pf-hero" aria-label="Overview">
    <div class="pf-panel"><span class="pf-flick" id="pfFlick" style="background:${me.color}"></span>${sprImg(spriteOf(me), 180, "", 6)}</div>
    <div class="pf-facts">
      <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      <div class="pf-actions">
        <button type="button" class="pf-btn" id="pfPlay" aria-pressed="false"><span class="i-play">${ICON_PLAY}</span><span class="i-stop">${ICON_STOP}</span><span id="pfPlayText">Play</span></button>
        <a class="pf-btn" href="${vizLink(me)}" data-testid="viz-link">Open in Visualizer</a>
      </div>
    </div>
  </section>`;
}

// How the three scores mix into the color: each score alone as its color channel, then all three together
function colorMix() {
  const parts = AXES.map((ax, k) => {
    const alone = me.vals.map((v, i) => i === k ? v : 1);
    return `<li style="background:${hex(alone)};color:${inkOn(alone)}"><b>${ax.label} ${me.vals[k]}</b><span>${hex(alone)}</span></li>`;
  }).join("");
  return `<ol class="pf-mix" aria-label="How the scores mix into the color">${parts}
    <li style="background:${me.color};color:${inkOn(me.vals)}"><b>${esc(me.cname)}</b><span>${me.color}</span></li>
  </ol>`;
}

// The track's scores beside the averages of its game and the whole series
function compareTable() {
  const gameAvg = average(game.tracks.filter(t => t.vals)), allAvg = average(scored);
  const atScore = val => plural(scored.filter(t => val(t) === val(me)).length, "track");
  const rows = AXES.map((ax, k) => `<tr>
    <th scope="row"><span class="ch-${"rgb"[k]}">${ax.label}</span><small>${reading(ax, me.vals[k])}</small></th>
    <td class="n"><b>${me.vals[k]}</b></td>
    <td class="n">${gameAvg[k].toFixed(1)}</td>
    <td class="n">${allAvg[k].toFixed(1)}</td>
    <td class="n">${atScore(t => t.vals[k])}</td>
  </tr>`);
  rows.push(`<tr>
    <th scope="row">Intensity<small>The sum, from 3 to 15</small></th>
    <td class="n"><b>${intensity(me.vals)}</b></td>
    <td class="n">${intensity(gameAvg).toFixed(1)}</td>
    <td class="n">${intensity(allAvg).toFixed(1)}</td>
    <td class="n">${atScore(t => intensity(t.vals))}</td>
  </tr>`);
  return `<table class="tl-grades pf-table">
    <thead><tr><th scope="col">Score</th><th scope="col" class="n">${esc(me.name)}</th><th scope="col" class="n">MM ${esc(tableTitle(game))} avg</th><th scope="col" class="n">Series avg</th><th scope="col" class="n">At this score</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

function colorProfile() {
  return `<section aria-labelledby="pfColorHead">
    <h2 class="sh" id="pfColorHead">Color Profile</h2>
    <div class="intro">
      <div class="pf-hexbox"><svg id="pfHex" viewBox="-160 -128 320 256" role="img" aria-label="${esc(me.name)}'s shape on the hexagon chart: ${AXES.map((ax, k) => `${ax.label.toLowerCase()} ${me.vals[k]}`).join(", ")}"></svg></div>
      <div class="pf-stack">
        ${colorMix()}
        ${compareTable()}
      </div>
    </div>
  </section>`;
}

function tierRanking() {
  const grade = gradeOf(me.ratings), total = totalOf(me.ratings);
  const rows = METRICS.map((m, k) => {
    const v = me.ratings[k];
    const blocks = [1, 2, 3, 4, 5].map(n => `<b class="${n <= v ? "on" : ""}"></b>`).join("");
    return `<li><div><b>${m.label}</b><span>${m.question}</span></div><i>${blocks}</i><span class="pf-rating"><b>${v}</b> ${RATINGS[v - 1]}</span></li>`;
  }).join("");
  const facts = [
    ["Total", `${total} of 15`],
    ["In the series", placeIn(graded)],
    [`In ${game.title}`, placeIn(game.tracks.filter(t => t.ratings))],
  ];
  return `<section aria-labelledby="pfTierHead">
    <h2 class="sh" id="pfTierHead">Tier Ranking</h2>
    <div class="tl-tier tl-${grade.letter} pf-tier">
      <div class="tl-letter"><div><b>${grade.letter}</b><span>${rangeOf(grade)}</span></div></div>
      <div class="pf-tierbody">
        <ul class="pf-ratings">${rows}</ul>
        <dl class="pf-places">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      </div>
    </div>
  </section>`;
}

function structure() {
  const cells = MOVEMENT.sections.map(([letter, word]) => `<li class="${letter === "i" || letter === "o" ? "edge" : ""}"><b>${letter}</b><span>${word}</span></li>`).join("");
  return `<section aria-labelledby="pfFormHead">
    <h2 class="sh" id="pfFormHead">Song Structure</h2>
    <ol class="pf-form" style="--track-color:${me.color}">${cells}</ol>
    <p class="hint">Movement score: <b>${MOVEMENT.score}</b>, ${MOVEMENT.note}. Each distinct section is worth a point. The intro isn't part of the loop, and the outro is a short ending of its own. Sections are in order and not to scale.</p>
  </section>`;
}

// One track in a list: sprite, name, color, scores and grade. note is an optional line under the name.
function trackRow(t, note = "") {
  const s = spriteOf(t), g = t.ratings && gradeOf(t.ratings);
  return `<li class="${t === me ? "pf-me" : ""}">
    <span class="pf-rspr">${s ? sprImg(s, 40, "", 1) : ""}</span>
    <span class="pf-rname">${t === me ? `<b>${esc(t.name)}</b>` : `<a href="${vizLink(t)}">${esc(t.name)}</a>`}${note ? `<small>${note}</small>` : ""}</span>
    <span class="pf-rcolor"><i style="background:${t.color}"></i><span class="pf-mono">${t.color}</span></span>
    <span class="pf-digits">${digits(t.vals)}</span>
    <span class="pf-rgrade">${g ? `<span class="tl-${g.letter}"><span class="tl-chip">${g.letter}</span></span><span class="pf-mono">${totalOf(t.ratings)}</span>` : `<small>Not graded</small>`}</span>
  </li>`;
}

function inTheGame() {
  const rows = game.tracks.filter(t => t.vals).sort((a, b) => ratingTotal(b) - ratingTotal(a));
  const badges = game.badges.map(b => `<li>${esc(b.text)}</li>`).join("");
  return `<section aria-labelledby="pfGameHead">
    <h2 class="sh" id="pfGameHead">In ${esc(game.title)}</h2>
    <p class="pf-gameline"><i style="background:${game.color}"></i><span>Game average: ${esc(game.cname)} <span class="pf-mono">${game.color}</span></span></p>
    ${badges ? `<ul class="pf-badges">${badges}</ul>` : ""}
    <ol class="pf-rows" data-testid="game-rows">${rows.map(t => trackRow(t)).join("")}</ol>
  </section>`;
}

// The nearest tracks on the three color scores, in any game: every track as close as the sixth nearest, so tracks that
// are equally close are never cut off, in order of distance and then release
function neighbors() {
  const away = t => Math.hypot(...t.vals.map((v, k) => v - me.vals[k]));
  const others = scored.filter(t => t !== me).sort((a, b) => away(a) - away(b));
  const limit = others.length > 5 ? away(others[5]) : Infinity;
  const closest = others.filter(t => away(t) <= limit);
  const same = others.filter(t => away(t) === 0).length;
  const note = t => `MM ${esc(tableTitle(t.game))} · ${away(t) === 0 ? "Same color" : `${away(t).toFixed(1)} away`}`;
  return `<section aria-labelledby="pfNearHead">
    <h2 class="sh" id="pfNearHead">Closest Colors</h2>
    <p class="hint pf-nearnote">${same ? `${plural(same, "other track")} ${same === 1 ? "shares" : "share"} this exact color.` : "No other track has this exact color."} Distance counts the steps between the three scores, so 1.0 means one score is one point apart.</p>
    <ol class="pf-rows" data-testid="neighbor-rows">${closest.map(t => trackRow(t, note(t))).join("")}</ol>
  </section>`;
}

function drawHexagon() {
  const svg = $("pfHex"), R = 100;
  drawFrame(svg, R, true);
  triangle(svg, me.vals, R, me.color);
  drawTop(svg, R);
}

// ---- The player ----

// Starts from the beginning when clicked, and stops on the next click, like the tier list's cards
export const player = new Audio();
const live = liveAudio(player);
let frameId = 0;

function setupPlayer() {
  const button = $("pfPlay"), flick = $("pfFlick");
  player.preload = "metadata";
  player.src = me.audio;

  const mark = () => {
    const on = !player.paused;
    button.setAttribute("aria-pressed", on);
    $("pfPlayText").textContent = on ? "Stop" : "Play";
  };
  const stopFlicker = () => {
    cancelAnimationFrame(frameId);
    flick.style.filter = "";
    live.reset();
  };
  const startFlicker = () => {
    stopFlicker();
    if (!live.connected()) return;
    const frame = () => {
      frameId = requestAnimationFrame(frame);
      live.update();
      flick.style.filter = live.flickerFilter();
    };
    frameId = requestAnimationFrame(frame);
  };

  button.addEventListener("click", () => {
    if (!player.paused) { player.pause(); return; }
    player.currentTime = 0;
    live.connect();
    player.play()
      .then(() => track("play_track", { track_name: me.name, game_id: game.id, game_title: game.title, custom_list: false }))
      .catch(() => { });   // blocked by the browser
  });
  player.addEventListener("loadedmetadata", () => {
    const s = Math.round(player.duration);
    $("pfLength").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  });
  ["play", "pause", "ended"].forEach(e => player.addEventListener(e, mark));
  player.addEventListener("playing", startFlicker);
  ["pause", "ended"].forEach(e => player.addEventListener(e, stopFlicker));
}

// ---- Start ----

setupTheme();
// With no scores the file didn't load, so there's nothing to show
if (me.vals && me.ratings) {
  $("pfLede").textContent = `The ${game.title} stage theme for ${me.name}, by ${me.composer || game.composer}. Its color comes from three scores for how the track feels, and its grade from three ratings of how well it works.`;
  $("profile").innerHTML = hero() + colorProfile() + tierRanking() + structure() + inTheGame() + neighbors();
  drawHexagon();
  setupPlayer();
} else {
  $("profile").innerHTML = `<p class="tl-empty">Couldn't load this profile. Try reloading the page.</p>`;
}
