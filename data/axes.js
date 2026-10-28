// The three scores, each 1–5. The high end of each axis points at a hexagon vertex and the low end at the opposite one.
// tok is the axis's CSS color token; ang is the angle of its high end in degrees (0 = right, counterclockwise).
export const AXES = [
  { label: "Energy", lo: "Chill", hi: "Hype", tok: "--r", ang: 90 },
  { label: "Density", lo: "Simple", hi: "Busy", tok: "--g", ang: -30 },
  { label: "Gravity", lo: "Light", hi: "Serious", tok: "--b", ang: 210 },
];
