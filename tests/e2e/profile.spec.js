// The Gyro Man profile page, with a hand-made scores file so these don't depend on the real ratings
import { test as plainTest } from "@playwright/test";
import { test, expect } from "./fixtures.js";

const CSV = [
  "game,name,energy,density,gravity,expression,synergy,arrangement",
  "mm5,Gyro Man,4,3,1,5,5,4",      // 14: S, #BF8000
  "mm5,Wave Man,3,3,1,5,5,5",      // 15: above Gyro Man in its game and the series; one point away
  "mm5,Star Man,1,1,1,5,5,4",      // 14: tied with Gyro Man
  "mm5,Stone Man,5,5,5,4,3,3",     // 10: below it
  "mm5,Crystal Man,1,1,5,,,",      // color scores but no ratings: not graded
  "mm1,Cut Man,4,3,1,5,5,5",       // 15: above it in the series only; the same color
  "mm2,Air Man,4,3,2,1,1,1",       // 3: one point away
  "mm2,Metal Man,4,4,1,1,1,1",     // one point away
  "mm3,Top Man,5,3,1,1,1,1",       // one point away
  "mm4,Dust Man,4,2,1,1,1,1",      // one point away, making the sixth nearest
  "mm4,Toad Man,1,5,5,1,1,1",      // far away
].join("\n");

const openProfile = async page => {
  await page.route("**/data/scores.csv", r => r.fulfill({ contentType: "text/csv", body: CSV }));
  await page.goto("/gyro-man.html");
  await expect(page.locator(".pf-hero")).toBeVisible();
};

const isPlaying = page => page.evaluate(async () => {
  const { player } = await import("/src/profile.js");
  return !player.paused;
});

test.describe("Gyro Man profile", () => {
  test("shows the track's details and its color", async ({ page }) => {
    await openProfile(page);
    const facts = page.locator(".pf-facts dl");
    await expect(facts).toContainText("DWN-036");
    await expect(facts).toContainText("Mega Man 5 (1992)");
    await expect(facts).toContainText("Mari Yamaguchi");
    await expect(facts).toContainText("#BF8000");
    await expect(page.locator(".pf-flick")).toHaveCSS("background-color", "rgb(191, 128, 0)");
  });

  test("shows how each score mixes into the color", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator(".pf-mix li span")).toHaveText(["#BF0000", "#008000", "#000000", "#BF8000"]);
  });

  test("draws the track's shape on the hexagon", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator("#pfHex .tri .fill")).toHaveAttribute("stroke", "#BF8000");
  });

  test("compares the scores with the game and the series", async ({ page }) => {
    await openProfile(page);
    const energy = page.locator(".pf-table tbody tr").first().locator("td");
    // Game: 4, 3, 1, 5, 1. Series adds 4, 4, 4, 5, 4, 1, for 36 over 11 tracks
    await expect(energy).toHaveText(["4", "2.8", "3.3", "5 tracks"]);
  });

  test("shows the grade, its ratings and its place, counting ties", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator(".pf-tier .tl-letter b")).toHaveText("S");
    await expect(page.locator(".pf-rating")).toHaveText(["5 Exemplary", "5 Exemplary", "4 Excellent"]);
    const places = page.locator(".pf-places dd");
    await expect(places).toHaveText(["14 of 15", "Tied for 3rd of 10", "Tied for 2nd of 4"]);
  });

  test("shows the song's sections in order", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator(".pf-form b")).toHaveText(["i", "a", "b", "c", "o"]);
  });

  test("lists its game's scored tracks by rating, with ungraded ones last", async ({ page }) => {
    await openProfile(page);
    const rows = page.getByTestId("game-rows").locator(".pf-rname");
    await expect(rows).toHaveText(["Wave Man", "Gyro Man", "Star Man", "Stone Man", "Crystal Man"]);
    await expect(page.getByTestId("game-rows").locator(".pf-me .pf-rname")).toHaveText("Gyro Man");
    await expect(page.getByTestId("game-rows").locator("li").last()).toContainText("Not graded");
  });

  test("lists the closest colors nearest first, keeping ties together", async ({ page }) => {
    await openProfile(page);
    const rows = page.getByTestId("neighbor-rows").locator(".pf-rname a");
    await expect(rows).toHaveText(["Cut Man", "Metal Man", "Air Man", "Top Man", "Dust Man", "Wave Man"]);
    await expect(page.getByTestId("neighbor-rows").locator("li").first()).toContainText("MM 1 · Same color");
    await expect(page.locator(".pf-nearnote")).toContainText("1 other track shares this exact color.");
    await expect(rows.first()).toHaveAttribute("href", "./?game=mm1&track=0");
  });

  test("links to the track in the visualizer", async ({ page }) => {
    await openProfile(page);
    await page.getByTestId("viz-link").click();
    await expect(page).toHaveURL(/\?game=mm5&track=3$/);
  });

  test("plays the track when clicked and stops on the next click", async ({ page }) => {
    await openProfile(page);
    const button = page.locator("#pfPlay");
    await expect(button).toHaveText("Play");
    await button.click();
    await expect.poll(() => isPlaying(page), { timeout: 5000 }).toBe(true);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveText("Stop");
    await button.click();
    await expect.poll(() => isPlaying(page), { timeout: 5000 }).toBe(false);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => page.locator(".pf-flick").evaluate(e => e.style.filter)).toBe("");
  });

  test("flickers the color while playing", async ({ page }) => {
    await openProfile(page);
    await page.locator("#pfPlay").click();
    await expect.poll(() => page.locator(".pf-flick").evaluate(e => e.style.filter), { timeout: 5000 }).toContain("brightness");
    await page.locator("#pfPlay").click();
  });

  test("shows the track's length", async ({ page }) => {
    await openProfile(page);
    await expect(page.locator("#pfLength")).toHaveText(/^\d+:\d\d$/);
  });

  for (const width of [360, 760, 1280]) {
    test(`fits ${width}px without scrolling sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await openProfile(page);
      const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(scroll).toBeLessThanOrEqual(client);
    });
  }

  test("renders with the real data", async ({ page }) => {
    await page.goto("/gyro-man.html");
    await expect(page.locator(".pf-hero")).toBeVisible();
    await expect(page.locator(".pf-places dd")).toHaveCount(3);
    await expect(page.locator(".pf-panel img")).toHaveAttribute("src", "sprites/mm5-gyroman.png");
  });
});

// Without the fixture, since the failed load is logged as an error on purpose
plainTest("Gyro Man profile says so when the scores don't load", async ({ page }) => {
  await page.route("**/data/scores.csv", r => r.fulfill({ status: 500, body: "" }));
  await page.goto("/gyro-man.html");
  await expect(page.locator("#profile")).toContainText("Couldn't load this profile");
});
