// The tier list page, with a hand-made ranking file so these don't depend on the real ratings
import { test as plainTest } from "@playwright/test";
import { test, expect, open } from "./fixtures.js";

const CSV = [
  "game,name,expression,synergy,arrangement",
  "mm2,Metal Man,5,5,5",    // 15: S
  "mm1,Cut Man,5,5,4",      // 14: S, after the 15 despite the earlier release
  "mm1,Ice Man,4,4,4",      // 12: A
  "mm1,Bomb Man,5,1,4",     // 10: B
  "mm3,Top Man,3,3,3",      // 9: C
  "mmii,Top Man,3,2,3",     // 8: C, a same-named track in another game
  "mm1,Guts Man,2,3,1",     // 6: D
  "mm1,Fire Man,1,1,1",     // 3: F
  "mm2,Air Man,,,",         // blank: not graded
].join("\n");

const openTiers = async page => {
  await page.route("**/data/ranking.csv", r => r.fulfill({ contentType: "text/csv", body: CSV }));
  await page.goto("/tiers.html");
  await expect(page.locator('[data-tier="S"]')).toBeAttached();
};
const names = (page, id) => page.locator(`[data-tier="${id}"] .tl-tile .tl-name`);

test.describe("tier list", () => {
  test("puts each track in the grade its total earns, highest total first", async ({ page }) => {
    await openTiers(page);
    await expect(names(page, "S")).toHaveText(["Metal Man", "Cut Man"]);
    await expect(names(page, "A")).toHaveText(["Ice Man"]);
    await expect(names(page, "B")).toHaveText(["Bomb Man"]);
    await expect(names(page, "C")).toHaveText(["Top Man", "Top Man"]);
    await expect(names(page, "D")).toHaveText(["Guts Man"]);
    await expect(names(page, "F")).toHaveText(["Fire Man"]);
  });

  test("shows each tile's ratings and total", async ({ page }) => {
    await openTiers(page);
    const tile = page.locator('[data-tier="B"] .tl-tile');
    await expect(tile.locator(".tl-scores span")).toHaveText("5 1 4");
    await expect(tile.locator(".tl-scores b")).toHaveText("10");
    await expect(tile).toHaveAttribute("aria-label", "Bomb Man, Mega Man: expression 5, synergy 1, arrangement 4, total 10");
  });

  test("lists blank and missing rows as not graded, without the ??? placeholders", async ({ page }) => {
    await openTiers(page);
    const none = names(page, "none");
    await expect(page.locator('[data-tier="none"] [aria-label^="Air Man, Mega Man 2:"]')).toHaveCount(1);
    await expect(none.filter({ hasText: "Twinkle Girl" })).toHaveCount(1);
    await expect(none.filter({ hasText: "???" })).toHaveCount(0);
  });

  test("marks an empty grade", async ({ page }) => {
    await page.route("**/data/ranking.csv", r => r.fulfill({ contentType: "text/csv", body: "game,name,a,b,c\nmm1,Cut Man,5,5,5" }));
    await page.goto("/tiers.html");
    await expect(page.locator('[data-tier="F"] .tl-empty')).toHaveText("No tracks yet");
  });

  test("a track opens in the visualizer, and one that can't be played isn't a link", async ({ page }) => {
    await openTiers(page);
    await expect(page.locator('[data-tier="none"] div.tl-tile').filter({ hasText: "Twinkle Girl" })).toHaveCount(1);
    await page.locator('[data-tier="D"] a.tl-tile').click();
    await expect(page).toHaveURL(/\?game=mm1&track=1$/);
    await expect(page.locator("#viewViz")).toBeVisible();
    await expect(page.locator("#rName")).toHaveText("Guts Man");
  });

  test("explains the grades", async ({ page }) => {
    await openTiers(page);
    await expect(page.locator("#metrics li")).toHaveCount(3);
    await expect(page.locator("#ratings li")).toHaveCount(5);
    await expect(page.locator("#gradeKey tr").first()).toContainText("14–15");
    await expect(page.locator("#gradeKey tr")).toHaveCount(6);
  });

  test("links to and from the color project", async ({ page }) => {
    await open(page);
    await page.getByTestId("tiers-link").click();
    await expect(page).toHaveURL(/tiers\.html$/);
    await page.getByTestId("home-link").click();
    await expect(page.locator("#viewReport")).toBeVisible();
  });

  test("shares the color project's saved theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openTiers(page);
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await open(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("fits a phone without scrolling sideways", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/tiers.html");
    await expect(page.locator('[data-tier="C"] .tl-tile').first()).toBeVisible();
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll).toBeLessThanOrEqual(client);
  });
  for (const width of [320, 360]) {
    test(`keeps the home page title bar inside its gutter at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await open(page);
      const box = await page.getByTestId("theme-toggle").boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(width - 16);
    });
  }
});

// Uses the plain test: the shared one fails on the error this causes on purpose
plainTest("says so when the ranking file can't be loaded", async ({ page }) => {
  await page.route("**/data/ranking.csv", r => r.fulfill({ status: 404, body: "" }));
  await page.goto("/tiers.html");
  await expect(page.locator("#tiers")).toContainText("Couldn't load the rankings");
});
