// Back button history: picks push entries, Back and Forward restore them
import { test, expect, open, query, selectedTrack, currentView } from "./fixtures.js";

const historyLength = page => page.evaluate(() => history.length);

test.describe("back button history", () => {
  test("picking a game or track adds an entry; Back and Forward restore each", async ({ page }) => {
    await open(page, "?game=mm1");
    const start = await historyLength(page);
    await page.locator("#lg2").click();                                                // Ice Man
    await page.locator("#gameSel").selectOption({ label: "Mega Man 2 (1988)" });
    await page.locator("#lg0").click();                                                // Metal Man
    expect(await historyLength(page)).toBe(start + 3);

    await page.goBack();
    expect(query(page)).toBe("?game=mm2");
    expect(await selectedTrack(page)).toBeNull();
    await page.goBack();
    expect(query(page)).toBe("?game=mm1&track=2");
    expect(await selectedTrack(page)).toBe("Ice Man");
    await expect(page.locator("#lg2")).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    expect(query(page)).toBe("?game=mm1");
    expect(await selectedTrack(page)).toBeNull();

    await page.goForward();
    await page.goForward();
    expect(await currentView(page)).toBe("mm2");
    await page.goForward();
    expect(await selectedTrack(page)).toBe("Metal Man");
  });

  test("clearing a track is a step of its own", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg0").click();
    await page.locator("#lg0").click();
    expect(await selectedTrack(page)).toBeNull();
    await page.goBack();
    expect(await selectedTrack(page)).toBe("Cut Man");
  });

  test("switching views replaces the entry rather than adding one", async ({ page }) => {
    await open(page, "?game=mm1");
    const start = await historyLength(page);
    await page.locator("#viewBtn").click();
    await page.locator("#viewBtn").click();
    expect(await historyLength(page)).toBe(start);
  });

  test("a pick that switches views is restored to its view", async ({ page }) => {
    await open(page);
    await page.locator("#compare .crow").first().click();   // opens the game in the visualizer
    await expect(page.locator("#viewViz")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#viewReport")).toBeVisible();
    await page.goForward();
    await expect(page.locator("#viewViz")).toBeVisible();
  });

  test("editing the custom list updates its entry; switching to it from a game adds one", async ({ page }) => {
    await open(page, "?game=mm1");
    const start = await historyLength(page);
    await page.locator("#customBtn").click();
    await page.locator('#customList input[data-gi="2"][data-ti="0"]').check();    // switches to the list
    await page.locator('#customList input[data-gi="2"][data-ti="1"]').check();    // edits it
    expect(await historyLength(page)).toBe(start + 1);
    expect(query(page)).toBe("?list=mm2.0,mm2.1");
    await page.goBack();
    expect(await currentView(page)).toBe("mm1");
    await page.goForward();
    expect(await currentView(page)).toBe("custom");
    await expect(page.locator("#legend li")).toHaveCount(2);
  });
});
