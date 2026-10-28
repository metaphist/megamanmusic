import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { channel, hex, colorName, inkOn, intensity, fmt, digits } from "../../src/colors.js";
import { COLOR_NAMES } from "../../data/color-names.js";

describe("channel", () => {
  test("maps scores 1–5 evenly onto 0–255", () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(channel), [0, 64, 128, 191, 255]);
  });
  test("handles averages between whole scores", () => {
    assert.equal(channel(1.5), 32);
  });
});

describe("hex", () => {
  test("Energy is red, Density green, Gravity blue", () => {
    assert.equal(hex([5, 1, 1]), "#FF0000");
    assert.equal(hex([1, 5, 1]), "#00FF00");
    assert.equal(hex([1, 1, 5]), "#0000FF");
  });
  test("covers the extremes and a real track", () => {
    assert.equal(hex([1, 1, 1]), "#000000");
    assert.equal(hex([5, 5, 5]), "#FFFFFF");
    assert.equal(hex([4, 3, 3]), "#BF8080");
  });
  test("is uppercase and zero-padded", () => {
    assert.match(hex([2, 1, 2]), /^#[0-9A-F]{6}$/);
    assert.equal(hex([1, 2, 1]), "#004000");
  });
});

describe("colorName", () => {
  test("names whole-number scores exactly, in code order 111 … 555", () => {
    assert.equal(colorName([1, 1, 1]), "Black");
    assert.equal(colorName([1, 1, 2]), "Abyss");
    assert.equal(colorName([4, 3, 3]), "Rosy Brown");
    assert.equal(colorName([5, 1, 1]), "Red");
    assert.equal(colorName([5, 5, 5]), "White");
  });
  test("names an average after the nearest whole-number color, marked ≈", () => {
    assert.equal(colorName([3.75, 2.63, 3.63]), "≈ " + colorName([4, 3, 4]));
  });
  test("clamps out-of-range values to 1–5", () => {
    assert.equal(colorName([0, 6, 3]), colorName([1, 5, 3]));
    assert.equal(colorName([0.2, 9.5, 3]), "≈ " + colorName([1, 5, 3]));
  });
  test("every one of the 125 colors has its own name", () => {
    const names = [];
    for (let e = 1; e <= 5; e++) for (let d = 1; d <= 5; d++) for (let g = 1; g <= 5; g++) names.push(colorName([e, d, g]));
    assert.equal(new Set(names).size, 125);
    assert.deepEqual(names, COLOR_NAMES);
  });
});

describe("inkOn", () => {
  const DARK = "#141a2b", LIGHT = "#f2f4fa";
  test("dark text on light colors, light text on dark ones", () => {
    assert.equal(inkOn([5, 5, 5]), DARK);
    assert.equal(inkOn([1, 1, 1]), LIGHT);
    assert.equal(inkOn([5, 5, 1]), DARK);    // yellow
    assert.equal(inkOn([1, 1, 5]), LIGHT);   // blue
  });
  test("weights green most, then red, then blue", () => {
    assert.equal(inkOn([1, 5, 1]), DARK);    // 0.59 × 255 = 150 > 140
    assert.equal(inkOn([5, 1, 1]), LIGHT);   // 0.3 × 255 = 77
  });
});

describe("intensity", () => {
  test("is the sum of the three scores", () => {
    assert.equal(intensity([1, 1, 1]), 3);
    assert.equal(intensity([4, 3, 3]), 10);
    assert.equal(intensity([5, 5, 5]), 15);
    assert.equal(intensity([1.5, 2.5, 3]), 7);
  });
});

describe("fmt", () => {
  test("keeps whole numbers as they are", () => {
    assert.equal(fmt(3), 3);
    assert.equal(fmt(3, 2), 3);
  });
  test("rounds others to the given decimal places (1 by default)", () => {
    assert.equal(fmt(2.5), "2.5");
    assert.equal(fmt(2.6667), "2.7");
    assert.equal(fmt(2.6667, 2), "2.67");
  });
});

describe("digits", () => {
  test("writes each score in its axis color", () => {
    assert.equal(digits([4, 3, 3]), '<span class="ch-r">4</span><span class="ch-g">3</span><span class="ch-b">3</span>');
  });
  test("formats averages to one decimal", () => {
    assert.equal(digits([3.75, 2, 1.25]), '<span class="ch-r">3.8</span><span class="ch-g">2</span><span class="ch-b">1.3</span>');
  });
});
