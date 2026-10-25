// The games and their tracks, with the scores from scores.csv and everything worked out from them:
// each track's color, each game's average scores and color, and the distinction badges.
// Importing this module waits for the scores to load (see "Start" at the bottom).
import { GAMES } from "../data/games.js";
import { AXES } from "../data/axes.js";
import { hex, colorName, intensity } from "./colors.js";

export { GAMES, AXES };

// ---- Lookups ----

// Games in release order (same-year games keep series order; undated ones go last)
export const RELEASE_ORDER = [...GAMES].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity) || GAMES.indexOf(a) - GAMES.indexOf(b));

// A track's key, as used in links, saved lists and favorites: game id and track index, like "mm2.3"
export const trackKey = t => `${t.game.id}.${t.ti}`;
export const trackOf = key => {
  const [id, ti] = key.split(".");
  const g = GAMES.find(g => g.id === id);
  return g && g.tracks[+ti];
};

// A track can be selected (and listed, saved or favorited) when it's scored or has audio
export const selectable = t => !!(t.vals || t.audio);

// The average scores of some scored tracks (null for none)
export const average = tracks => tracks.length
  ? [0, 1, 2].map(k => tracks.reduce((sum, t) => sum + t.vals[k], 0) / tracks.length)
  : null;

// Short game names drop the shared "Mega Man" prefix ("Mega Man" alone becomes "1")
export const shortTitle = g => g.title === "Mega Man" ? "1" : g.title.replace(/^Mega Man\s*/, "");
// The tightest names, for the track table and the report's jump bar: the longer suffixes abbreviated
const TABLE_ABBR = { "Powered Up": "PU", "& Bass": "&B", "Dual Override": "DO" };
export const tableTitle = g => TABLE_ABBR[shortTitle(g)] || shortTitle(g);

// ---- Loading ----

// Scores live in data/scores.csv (game,name,energy,density,gravity; blank scores = not scored yet), matched to tracks by
// game id and name. Each scored track gets a code of its three scores, like "352"; the rest get null.
async function loadScores() {
  let codes = new Map();
  try {
    const r = await fetch("data/scores.csv", { cache: "no-cache" });
    if (!r.ok) throw new Error("scores.csv " + r.status);
    codes = parseScores(await r.text());
  } catch (e) {
    console.error("Couldn't load scores", e);
  }
  GAMES.forEach(g => g.tracks.forEach(t => { t.code = codes.get(g.id + "|" + t.name) || null; }));
}

// Each scored track's scores and color, and each game's scored tracks, averages and average color
function deriveColors() {
  for (const g of GAMES) {
    for (const t of g.tracks) {
      if (!t.code) continue;
      t.vals = [...t.code].map(Number);
      t.color = hex(t.vals);
      t.cname = colorName(t.vals);
    }
    g.scored = g.tracks.filter(t => t.vals);
    g.avg = average(g.scored);
    g.color = g.avg ? hex(g.avg) : null;
    g.cname = g.avg ? colorName(g.avg) : null;
  }
}

function parseScores(csv) {
  const codes = new Map();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    // Cells may be quoted, with "" for a quote inside
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)
      .map(c => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    const [game, name, ...vals] = cells;
    const scores = vals.slice(0, 3);
    if (scores.length === 3 && scores.every(v => /^[1-5]$/.test(v))) codes.set(game + "|" + name, scores.join(""));
  }
  return codes;
}

// ---- Distinction badges ----

// Computed from the scores, so they follow any score change. Only games with 4+ scored tracks qualify,
// and ties within 0.005 share a badge.
function awardBadges() {
  GAMES.forEach(g => { g.badges = []; g.variety = variety(g); });
  const pool = GAMES.filter(g => g.variety != null);
  const award = (value, highest, badge) => {
    const best = (highest ? Math.max : Math.min)(...pool.map(value));
    pool.forEach(g => { if (Math.abs(value(g) - best) < .005) g.badges.push(badge); });
  };

  award(g => g.variety, true, { text: "Most varied", icon: "varied", tip: "Most varied: its tracks differ from each other the most" });
  award(g => g.variety, false, { text: "Most uniform", icon: "uniform", tip: "Most uniform: its tracks are the most alike" });

  const most = word => ({ simple: "simplest", light: "lightest", busy: "busiest" })[word.toLowerCase()] || "most " + word.toLowerCase();
  AXES.forEach((ax, k) => {
    const letter = "EDG"[k], cls = `ch-${"rgb"[k]}`;
    award(g => g.avg[k], true, { text: `▲ Highest ${ax.label.toLowerCase()}`, cls, icon: "hi" + letter, tip: `Highest average ${ax.label} (${most(ax.hi)})` });
    award(g => g.avg[k], false, { text: `▼ Lowest ${ax.label.toLowerCase()}`, cls, icon: "lo" + letter, tip: `Lowest average ${ax.label} (${most(ax.lo)})` });
  });

  // A game's average intensity is the sum of its three averages
  award(g => intensity(g.avg), true, { text: "▲ Highest intensity", icon: "hiI", tip: "Highest average intensity (most intense)" });
  award(g => intensity(g.avg), false, { text: "▼ Lowest intensity", icon: "loI", tip: "Lowest average intensity (calmest)" });
}

// Variety: the average distance between a game's track shapes, each track as an Energy/Density/Gravity point
function variety(g) {
  const points = g.scored.map(t => t.vals);
  if (points.length < 4) return null;
  let total = 0, pairs = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const [a, b] = [points[i], points[j]];
      total += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      pairs++;
    }
  }
  return total / pairs;
}

// ---- Start ----

// At the bottom, so everything above is defined first
await loadScores();
deriveColors();
// Every track knows its own game and position, so a custom list can mix tracks from different games
GAMES.forEach((g, gi) => g.tracks.forEach((t, ti) => Object.assign(t, { gi, ti, game: g })));
awardBadges();
