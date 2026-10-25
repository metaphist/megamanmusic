// Turning scores into colors. Energy is the red channel, Density green and Gravity blue,
// so each of the 125 possible score combinations is its own color.
import { COLOR_NAMES } from "./data/color-names.js";

// A score (1–5) as a color channel (0–255)
export const channel = v => Math.round((v - 1) / 4 * 255);

export const hex = vals => "#" + vals.map(v => channel(v).toString(16).padStart(2, "0")).join("").toUpperCase();

// Exact name for whole-number scores; averages get the name of the nearest possible color, marked ≈
export function colorName(vals) {
  const [e, d, g] = vals.map(v => Math.min(5, Math.max(1, Math.round(v))));
  const name = COLOR_NAMES[(e - 1) * 25 + (d - 1) * 5 + (g - 1)];
  return vals.every(Number.isInteger) ? name : "≈ " + name;
}

// Dark or light text, whichever reads better on the color
export const inkOn = vals => (0.3 * channel(vals[0]) + 0.59 * channel(vals[1]) + 0.11 * channel(vals[2])) > 140 ? "#141a2b" : "#f2f4fa";

// Intensity is the sum of the three scores, from 3 to 15
export const intensity = vals => vals[0] + vals[1] + vals[2];

// A score as written: whole numbers as they are, others to d decimal places
export const fmt = (v, d = 1) => Number.isInteger(v) ? v : v.toFixed(d);

// Scores as digits in their axis colors
export const digits = vals => vals.map((v, i) => `<span class="ch-${"rgb"[i]}">${fmt(v)}</span>`).join("");
