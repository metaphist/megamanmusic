// The tier list's grading: a track's three ratings (each 1-5, equally weighted) add up to a total from 3 to 15,
// and each grade covers a range of totals. The tier list page and its "How Grades Work" key both read from here.

export const METRICS = [
  { label: "Expression", question: "Does it conjure a vivid image?" },
  { label: "Synergy", question: "Does the expression match the robot master?" },
  { label: "Arrangement", question: "Is the idea fully realized?" },
];

// What each rating means, from 1 to 5
export const RATINGS = ["Poor", "Lacking", "Decent", "Excellent", "Exemplary"];

// Best first. Together the ranges cover every possible total exactly once.
export const GRADES = [
  { letter: "S+", min: 15, max: 15, word: "Masterpiece" },
  { letter: "S", min: 14, max: 14, word: "Exemplary" },
  { letter: "A", min: 12, max: 13, word: "Excellent" },
  { letter: "B", min: 10, max: 11, word: "Good" },
  { letter: "C", min: 8, max: 9, word: "Decent" },
  { letter: "D", min: 6, max: 7, word: "Lacking" },
  { letter: "F", min: 3, max: 5, word: "Poor" },
];

// A grade's totals as text, like "12–13", or just "15" for a single total
export const rangeOf = g => g.min === g.max ? `${g.min}` : `${g.min}–${g.max}`;

export const totalOf = ratings => ratings.reduce((sum, n) => sum + n, 0);
export const gradeOf = ratings => {
  const total = totalOf(ratings);
  return GRADES.find(g => total >= g.min && total <= g.max);
};
