// Links: what a saved link opens, and how the link follows what's on screen
import { test, expect, open, query, selectedTrack, currentView, isPlaying, expectPlaying, inPage } from "./fixtures.js";

test.describe("opening a link", () => {
  test("a game opens the visualizer on it", async ({ page }) => {
    await open(page, "?game=mm3");
    await expect(page.locator("#viewViz")).toBeVisible();
    await expect(page.locator("#rName")).toHaveText("Mega Man 3 (1990)");
    await expect(page.locator("#gameSel")).toHaveValue(String(await inPage(page, ({ model }) => model.GAMES.findIndex(g => g.id === "mm3"))));
    expect(await selectedTrack(page)).toBeNull();
  });

  test("a game and track selects the track, without playing it", async ({ page }) => {
    await open(page, "?game=mm3&track=1");
    await expect(page.locator("#rName")).toHaveText("Magnet Man");
    await expect(page.locator("#lg1")).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(500);
    expect(await isPlaying(page)).toBe(false);
    expect(query(page)).toBe("?game=mm3&track=1");
  });

  test("the linked track plays on its first click, and clears on the next", async ({ page }) => {
    await open(page, "?game=mm3&track=1");
    await page.locator("#lg1").click();
    await expectPlaying(page);
    await expect(page.locator("#lg1")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#lg1").click();
    await expectPlaying(page, false);
    await expect(page.locator("#lg1")).toHaveAttribute("aria-pressed", "false");
    expect(query(page)).toBe("?game=mm3");
  });

  test("a list opens it as a custom list, with its track selected", async ({ page }) => {
    await open(page, "?list=mm2.0,mm3.1&track=1");
    expect(await currentView(page)).toBe("custom");
    await expect(page.locator("#legend li")).toHaveCount(2);
    await expect(page.locator("#rName")).toHaveText("Magnet Man");
    await expect(page.locator("#gameSel")).toHaveValue("custom");
    await expect(page.locator("#customBtnText")).toHaveText("2 tracks selected");
    expect(query(page)).toBe("?list=mm2.0,mm3.1&track=1");
  });

  test("a list drops duplicates and tracks that don't exist", async ({ page }) => {
    await open(page, "?list=mm2.0,mm2.0,zz.1,mm2.99,mm3.1");
    await expect(page.locator("#legend li")).toHaveCount(2);
    expect(query(page)).toBe("?list=mm2.0,mm3.1");
  });

  test("an empty list opens the empty custom list", async ({ page }) => {
    await open(page, "?list=");
    expect(await currentView(page)).toBe("custom");
    await expect(page.locator("#legend .lgempty")).toBeVisible();
    await expect(page.locator("#rSub")).toHaveText("Pick tracks from any game with the custom track list");
  });

  test("view=report opens the report with the track selected", async ({ page }) => {
    await open(page, "?view=report&game=mm2&track=0");
    await expect(page.locator("#viewReport")).toBeVisible();
    await expect(page.locator('#rpBody .rp-row.on')).toHaveCount(1);
    await expect(page.locator('#rpBody .rp-row.on b').first()).toHaveText("Metal Man");
    await expect(page.locator('#trackTable tbody tr.on')).toHaveCount(1);
  });

  test("an unknown game falls back to the first game", async ({ page }) => {
    await open(page, "?game=nope");
    await expect(page.locator("#viewViz")).toBeVisible();
    expect(await currentView(page)).toBe("mm1");
  });

  test("a track that doesn't exist, or can't be selected, is ignored", async ({ page }) => {
    await open(page, "?game=mm3&track=99");
    expect(await selectedTrack(page)).toBeNull();
    const placeholder = await inPage(page, ({ model }) => {
      const g = model.GAMES.find(g => g.tracks.some(t => !model.selectable(t)));
      return `?game=${g.id}&track=${g.tracks.findIndex(t => !model.selectable(t))}`;
    });
    await open(page, placeholder);
    expect(await selectedTrack(page)).toBeNull();
  });

  test("other query parameters are kept", async ({ page }) => {
    await open(page, "?utm_source=newsletter&game=mm2");
    await page.locator("#lg0").click();
    await expect(page).toHaveURL(/\?game=mm2&track=0&utm_source=newsletter$/);
  });
});

test.describe("older hash links", () => {
  test("#game/track opens like ?game=…&track=…, and the link is rewritten", async ({ page }) => {
    await open(page, "#mm2/3");
    await expect(page.locator("#rName")).toHaveText("Quick Man");
    expect(query(page)).toBe("?game=mm2&track=3");
    expect(new URL(page.url()).hash).toBe("");
  });

  test("#custom=…/track opens the list", async ({ page }) => {
    await open(page, "#custom=mm2.0,mm3.1/1");
    expect(await currentView(page)).toBe("custom");
    await expect(page.locator("#rName")).toHaveText("Magnet Man");
    expect(query(page)).toBe("?list=mm2.0,mm3.1&track=1");
  });

  test("#report/game/track opens the report", async ({ page }) => {
    await open(page, "#report/mm2/0");
    await expect(page.locator("#viewReport")).toBeVisible();
    expect(await selectedTrack(page)).toBe("Metal Man");
    expect(query(page)).toBe("?view=report&game=mm2&track=0");
  });

  test("#report alone opens the report", async ({ page }) => {
    await open(page, "#report");
    await expect(page.locator("#viewReport")).toBeVisible();
  });

  // The query wins over the hash, so this only applies to a link without one
  test("changing to a hash link without saved history opens it", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.evaluate(() => { history.replaceState(null, "", location.pathname); location.hash = "mm2/1"; });
    await expect(page.locator("#rName")).toHaveText("Air Man");
    expect(await currentView(page)).toBe("mm2");
  });
});

test.describe("the link follows along", () => {
  test("in the visualizer it has the game and selected track", async ({ page }) => {
    await open(page, "?game=mm2");
    await page.locator("#lg2").click();
    expect(query(page)).toBe("?game=mm2&track=2");
    await page.locator("#gameSel").selectOption({ label: "Mega Man 3 (1990)" });
    expect(query(page)).toBe("?game=mm3");
  });

  test("on the report it's plain, unless a track is selected", async ({ page }) => {
    await open(page);
    expect(query(page)).toBe("");
    await page.locator("#rpBody button.rp-row").first().click();
    expect(query(page)).toBe("?view=report&game=mm1&track=0");
  });

  test("a saved link reopens what was on screen", async ({ page }) => {
    await open(page, "?game=mm2");
    await page.locator("#lg4").click();
    const link = page.url();
    await page.goto(link);
    await expect(page.locator("#rName")).toHaveText("Crash Man");
    await expect(page.locator("#lg4")).toHaveAttribute("aria-pressed", "true");
  });
});
