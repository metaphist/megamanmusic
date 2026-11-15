// The tier list's grading: a track's three ratings (each 1-5, equally weighted) add up to a total from 3 to 15,
// and each grade covers a range of totals. The tier list page and its "How Grades Work" key both read from here.

export const METRICS = [
  { label: "Expression", question: "Does it evoke a strong feeling?" },
  { label: "Synergy", question: "Does the feeling match the robot master?" },
  { label: "Range", question: "How many unique sections are there?" },
];

// What each rating means, from 1 to 5
export const RATINGS = ["Lacking", "Basic", "Decent", "Excellent", "Exemplary"];

// Best first. Together the ranges cover every possible total exactly once.
export const GRADES = [
  { letter: "S+", min: 15, max: 15, word: "Masterpiece" },
  { letter: "S", min: 14, max: 14, word: "Exemplary" },
  { letter: "A", min: 12, max: 13, word: "Excellent" },
  { letter: "B", min: 10, max: 11, word: "Good" },
  { letter: "C", min: 8, max: 9, word: "Decent" },
  { letter: "D", min: 6, max: 7, word: "Basic" },
  { letter: "F", min: 3, max: 5, word: "Lacking" },
];

// A rating as the whole number it shows and counts as: a half rounds down (3.5 is 3) and anything above it up (3.6 is 4)
export const wholeRating = n => Math.ceil(n - .5);

// A grade's totals as text, like "12–13", or just "15" for a single total
export const rangeOf = g => g.min === g.max ? `${g.min}` : `${g.min}–${g.max}`;

export const totalOf = ratings => ratings.reduce((sum, n) => sum + n, 0);
export const gradeOf = ratings => {
  const total = totalOf(ratings);
  return GRADES.find(g => total >= g.min && total <= g.max);
};

// A gem: a perfect ranking (S+, all three ratings at 5), whatever the track's color
export const gem = t => !!t.ratings && gradeOf(t.ratings) === GRADES[0];
