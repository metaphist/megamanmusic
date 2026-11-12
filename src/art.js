// Robot master pictures: the modern artwork in art/ (listed in art/sources.json), falling back to the stand sprite.
// Importing this module waits for the artwork list to load.
import { SPRITES } from "../data/sprites.js";

// A track's key here matches the sprites' and the artwork list's: "mm5|Gyro Man"
export const artKey = t => t.game.id + "|" + t.name;

async function loadArt() {
  try {
    const r = await fetch("art/sources.json");
    if (!r.ok) throw new Error(r.status);
    return new Map((await r.json()).map(a => [a.game + "|" + a.name, "art/" + a.file]));
  } catch (e) { return new Map(); }
}

export const ART = await loadArt();

// The small version of a picture, made by scripts/make-thumbs.mjs: art/thumbs/mm5-gyroman.webp for art/mm5-gyroman.png
export const thumbOf = src => src.replace(/^art\/(.+)\.\w+$/, "art/thumbs/$1.webp");

// The picture as an <img> with class rm-art (plus rm-sprite for a sprite), or "" when there's neither. thumb uses the
// artwork's small version, for the home page's tiles (at most 100px tall).
export function portrait(t, cls = "", lazy = false, thumb = false) {
  const load = lazy ? ' loading="lazy" decoding="async"' : "";
  const art = ART.get(artKey(t));
  if (art) return `<img class="rm-art ${cls}" src="${thumb ? thumbOf(art) : art}" alt=""${load}>`;
  const s = SPRITES[artKey(t)];
  return s ? `<img class="rm-art rm-sprite ${cls}" src="${s.src}" width="${s.w}" height="${s.h}" alt=""${load}>` : "";
}
