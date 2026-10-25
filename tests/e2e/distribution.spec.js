// The score distribution: one column per possible score, one dot per scored track
import { test, expect, open, inPage, selectedTrack } from "./fixtures.js";

const columns = page => page.locator("#ibars .icol");
const tab = (page, metric) => page.locator(`#metricTabs [data-metric="${metric}"]`);

test.describe("score distribution", () => {
  test("starts on intensity, with a column for each total from 3 to 15", async ({ page }) => {
    await open(page);
    await expect(page.locator("#metricHead")).toHaveText("Intensity Distribution");
    await expect(columns(page)).toHaveCount(13);
    await expect(page.locator("#iaxis span")).toHaveCount(13);
    await expect(page.locator("#iLo")).toHaveText("Low intensity");
  });

  test("puts each track in the column of its total, and counts them", async ({ page }) => {
    await open(page);
    const counts = await inPage(page, ({ model }) => {
      const c = Array(13).fill(0);
      model.GAMES.flatMap(g => g.scored).forEach(t => c[t.vals[0] + t.vals[1] + t.vals[2] - 3]++);
      return c;
    });
    expect(await columns(page).evaluateAll(cols => cols.map(c => c.children.length))).toEqual(counts);
    expect(await page.locator("#iaxis b").allTextContents()).toEqual(counts.map(String));
  });

  test("the tabs switch to a single score, 1 to 5", async ({ page }) => {
    await open(page);
    await tab(page, "1").click();
    await expect(tab(page, "1")).toHaveAttribute("aria-pressed", "true");
    await expect(tab(page, "total")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#metricHead")).toHaveText("Density Distribution");
    await expect(columns(page)).toHaveCount(5);
    await expect(page.locator("#iLo")).toHaveText("Simple");
    await expect(page.locator("#iHi")).toHaveText("Busy");
    await expect(page.locator("#iaxis span").first()).toHaveClass("ch-g");
    const total = await inPage(page, ({ model }) => model.GAMES.flatMap(g => g.scored).length);
    await expect(page.locator("#ibars .idot")).toHaveCount(total);
  });

  test("hovering a dot shows the track's name, game, code and score", async ({ page }) => {
    await open(page);
    const dot = page.locator('#ibars .idot[data-gi="0"][data-ti="0"]');
    await dot.hover();
    const tip = page.locator("#itip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Cut Man");
    await expect(tip).toContainText("Mega Man");
    await expect(tip).toContainText("433");
    await expect(tip).toContainText("intensity 10");
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
    await tab(page, "0").click();
    await dot.hover();
    await expect(tip).toContainText("energy 4");
  });

  test("clicking a dot plays its track", async ({ page }) => {
    await open(page);
    await page.locator('#ibars .idot[data-gi="2"][data-ti="0"]').click();
    expect(await selectedTrack(page)).toBe("Metal Man");
  });

  test("marks the dots of the game or list in the visualizer", async ({ page }) => {
    await open(page, "?game=mm2");
    const scored = await inPage(page, ({ model }) => model.GAMES.find(g => g.id === "mm2").scored.length);
    await expect(page.locator("#ibars .idot.cur")).toHaveCount(scored);
    await page.locator("#gameSel").selectOption("custom");
    await expect(page.locator("#ibars .idot.cur")).toHaveCount(0);
    await page.locator("#gameSel").selectOption({ label: "Mega Man 2 (1988)" });
    await page.locator("#viewBtn").click();   // the tabs are on the report
    await tab(page, "2").click();             // the marks survive re-rendering
    await expect(page.locator("#ibars .idot.cur")).toHaveCount(scored);
  });
});
