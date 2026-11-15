// The tier list's grading: how three ratings become a letter grade
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GRADES, METRICS, RATINGS, gradeOf, rangeOf, totalOf, wholeRating } from "../../src/grades.js";

const letter = (...ratings) => gradeOf(ratings).letter;

describe("grades", () => {
  test("every possible total falls in exactly one grade", () => {
    for (let total = 3; total <= 15; total++) {
      assert.equal(GRADES.filter(g => total >= g.min && total <= g.max).length, 1, `total ${total}`);
    }
  });
  test("run from best to worst, covering 3 to 15 with no gaps", () => {
    assert.equal(GRADES[0].max, 15);
    assert.equal(GRADES.at(-1).min, 3);
    GRADES.slice(1).forEach((g, k) => assert.equal(g.max + 1, GRADES[k].min, g.letter));
  });
  test("change at the edge of each range", () => {
    const cuts = [[5, 5, 5, "S+"], [5, 5, 4, "S"], [5, 4, 4, "A"], [4, 4, 4, "A"], [4, 4, 3, "B"], [4, 3, 3, "B"], [3, 3, 3, "C"],
      [3, 3, 2, "C"], [3, 2, 2, "D"], [2, 2, 2, "D"], [2, 2, 1, "F"], [1, 1, 1, "F"]];
    for (const [a, b, c, want] of cuts) assert.equal(letter(a, b, c), want, `${a} ${b} ${c}`);
  });
  test("count all three metrics equally", () => {
    assert.equal(totalOf([5, 1, 3]), 9);
    assert.equal(letter(5, 1, 3), letter(1, 3, 5));
    assert.equal(letter(5, 1, 3), letter(3, 5, 1));
  });
  test("scores near each rating get the grades that share its meaning", () => {
    assert.equal(gradeOf([5, 5, 4]).word, RATINGS[4]);
    assert.equal(gradeOf([4, 4, 4]).word, RATINGS[3]);
    assert.equal(gradeOf([3, 3, 3]).word, RATINGS[2]);
    assert.equal(gradeOf([2, 2, 2]).word, RATINGS[1]);
    assert.equal(gradeOf([1, 1, 1]).word, RATINGS[0]);
  });
  test("show a single total on its own, and a range with a dash", () => {
    assert.equal(rangeOf(GRADES[0]), "15");
    assert.equal(rangeOf(GRADES.find(g => g.letter === "A")), "12–13");
  });
  test("show and count a rating as a whole number, a half rounding down", () => {
    assert.deepEqual([3, 3.4, 3.5, 3.6, 4.5, 5].map(wholeRating), [3, 3, 3, 4, 4, 5]);
  });
  test("there are three metrics", () => {
    assert.deepEqual(METRICS.map(m => m.label), ["Expression", "Synergy", "Range"]);
  });
});
