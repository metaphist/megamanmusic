// The home page: every robot master, grouped by game, each linking to its profile (robot-master.html?track=mm5.3).
import { GAMES, trackKey, shortTitle } from "./model.js";
import { gradeOf } from "./grades.js";
import { portrait } from "./art.js";
import { $, esc, plural, setupTheme } from "./util.js";

function tile(t) {
  const gr = t.ratings && gradeOf(t.ratings);
  const label = [t.name, t.cname, gr && `grade ${gr.letter}`].filter(Boolean).join(", ");
  return `<a class="rm-tile" href="robot-master.html?track=${trackKey(t)}" style="--c:${t.color || "var(--grid)"}"
      data-name="${esc(t.name.toLowerCase())}" aria-label="${esc(label)}">
    <span class="rm-tile-art">${portrait(t, "", true)}</span>
    <span class="rm-tile-name">${esc(t.name)}</span>
    <span class="rm-tile-meta">${t.cname ? esc(t.cname) : "Unscored"}${gr ? ` · <b class="rm-mini tl-${gr.letter}">${gr.letter}</b>` : ""}</span>
  </a>`;
}

function section(g) {
  return `<section class="hm-game" id="game-${g.id}" aria-labelledby="hm-${g.id}">
    <div class="hm-gamehead">
      ${g.color ? `<span class="hm-gamesw" style="background:${g.color}" title="Average color: ${esc(g.cname)}"></span>` : ""}
      <h2 class="sh" id="hm-${g.id}">${esc(g.title)}</h2>
      <span class="hm-gamemeta">${[g.year, g.composer && esc(g.composer)].filter(Boolean).join(" · ")}</span>
    </div>
    <div class="rm-tiles">${g.tracks.map(tile).join("")}</div>
  </section>`;
}

function render() {
  $("hmJump").innerHTML = GAMES.map(g => `<a href="#game-${g.id}">${esc(shortTitle(g))}</a>`).join("");
  $("roster").innerHTML = GAMES.map(section).join("");
  count();
}

// The search hides the tiles that don't match, and the games left with none
function filter() {
  const q = $("hmSearch").value.trim().toLowerCase();
  document.querySelectorAll(".hm-game").forEach(s => {
    let shown = 0;
    s.querySelectorAll(".rm-tile").forEach(a => { a.hidden = !!q && !a.dataset.name.includes(q); if (!a.hidden) shown++; });
    s.hidden = !shown;
  });
  count();
}

function count() {
  const n = document.querySelectorAll(".hm-game:not([hidden]) .rm-tile:not([hidden])").length;
  const total = GAMES.reduce((s, g) => s + g.tracks.length, 0);
  $("hmCount").textContent = n === total ? `${plural(total, "robot master")} across ${GAMES.length} games`
    : n ? `${n} of ${total} robot masters` : "No robot masters match";
}

setupTheme();
render();
$("hmSearch").addEventListener("input", filter);
