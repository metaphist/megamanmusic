// The color page (colors.html): one view with the color bar and visualizer, the score distribution, the color
// comparison by game and the color buddies. The deprecated two-view page is colors-classic.html (the other specs).
import { test, expect, inPage, isPlaying, selectedTrack, currentView, query } from "./fixtures.js";

async function openColors(page, link = "") {
  await page.goto("/colors.html" + link);
  await expect(page.locator("#legend li").first()).toBeAttached();
  await expect(page.locator("#colorbar button").first()).toBeAttached();
}

const listKeys = page => inPage(page, ({ viz, model }) => viz.G.tracks.map(model.trackKey));

test.describe("color page", () => {
  test("shows its sections in order", async ({ page }) => {
    await openColors(page);
    await expect(page.locator("h1")).toHaveText("Song Color Visualizer");
    await expect(page.locator(".wrap h2.sh")).toHaveText([
      "Why Color", "Intensity to Color", "The Visualizer", "Intensity Distribution", "Color Comparison by Game", "Color Buddies",
    ]);
  });

  test("opens on the first game with a plain link, which follows later picks", async ({ page }) => {
    await openColors(page);
    expect(await currentView(page)).toBe("mm1");
    expect(query(page)).toBe("");
    await page.locator("#gameSel").selectOption({ index: 1 });
    expect(query(page)).toMatch(/^\?game=(?!mm1\b)/);
  });

  test("a color in the bar plays its track, and a second click stops it", async ({ page }) => {
    await openColors(page);
    const first = page.locator("#colorbar button").first();
    await first.click();
    expect(await selectedTrack(page)).not.toBeNull();
    await expect(first).toHaveClass(/\bon\b/);
    await expect.poll(() => isPlaying(page)).toBe(true);
    await first.click();
    expect(await selectedTrack(page)).toBeNull();
  });

  test("a game in the comparison loads it in the visualizer", async ({ page }) => {
    await openColors(page);
    await page.locator('#compare .crow[data-game]').nth(1).click();
    expect(await currentView(page)).not.toBe("mm1");
    await expect(page.locator("#compare .crow[aria-pressed=true]")).toHaveCount(1);
  });

  test("a color buddy group loads as a playlist", async ({ page }) => {
    await openColors(page);
    const group = page.locator(".bud").first();
    const n = await group.locator("li").count();
    await group.locator(".bud-load").click();
    expect(await currentView(page)).toBe("custom");
    expect(await listKeys(page)).toHaveLength(n);
    expect(query(page)).toMatch(/^\?list=/);
  });

  test("the distribution switches score", async ({ page }) => {
    await openColors(page);
    await page.locator('#metricTabs [data-metric="0"]').click();
    await expect(page.locator("#metricHead")).toHaveText("Energy Distribution");
    await expect(page.locator("#iaxis span")).toHaveCount(5);
  });

  for (const [link, lands] of [["?game=mm2&track=1", "?game=mm2&track=1"], ["?list=mm3.1,mm1.0", "?list=mm3.1,mm1.0"],
    ["#mm2/1", "?game=mm2&track=1"], ["?view=report&game=mm2&track=1", "?game=mm2&track=1"]]) {
    test(`opens the link ${link}`, async ({ page }) => {
      await openColors(page, link);
      expect(query(page)).toBe(lands);
    });
  }

  test("links to the deprecated classic page, which links back", async ({ page }) => {
    await openColors(page);
    await page.getByTestId("classic-link").click();
    await expect(page).toHaveURL(/colors-classic\.html$/);
    await expect(page.getByTestId("deprecated-note")).toBeVisible();
    await page.getByTestId("new-colors-link").click();
    await expect(page).toHaveURL(/colors\.html/);
  });

  for (const width of [360, 1280]) {
    test(`fits ${width}px without scrolling sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openColors(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
