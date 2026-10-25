// The visualizer: chart, legend, cards and banner, the game picker and the custom track list
import { test, expect, open, inPage, selectedTrack, currentView, expectPlaying, query } from "./fixtures.js";

const gameInfo = (page, id) => inPage(page, ({ model }, id) => {
  const g = model.GAMES.find(g => g.id === id);
  return {
    index: model.GAMES.indexOf(g), title: g.title, year: g.year, composer: g.composer, badges: g.badges.length,
    tracks: g.tracks.map(t => ({ name: t.name, scored: !!t.vals, selectable: model.selectable(t), cname: t.cname, color: t.color, dln: t.dln })),
  };
}, id);

test.describe("a game in the visualizer", () => {
  test("has a legend row and card per track, with unselectable ones disabled", async ({ page }) => {
    await open(page, "?game=mm1");
    const g = await gameInfo(page, "mm1");
    await expect(page.locator("#legend li")).toHaveCount(g.tracks.length);
    await expect(page.locator("#cards .card")).toHaveCount(g.tracks.length);
    for (const [i, t] of g.tracks.entries()) {
      await expect(page.locator(`#lg${i} .nm`)).toContainText(t.name);
      if (!t.selectable) await expect(page.locator(`#lg${i}`)).toBeDisabled();
      if (t.scored) await expect(page.locator(`#lg${i} .dln`)).toHaveText(t.cname);
    }
  });

  test("stacks one shape per scored track on the chart", async ({ page }) => {
    await open(page, "?game=mm2");
    const scored = (await gameInfo(page, "mm2")).tracks.filter(t => t.scored).length;
    await expect(page.locator("#big .tri")).toHaveCount(scored);
    await expect(page.locator("#big .tri.dim")).toHaveCount(0);
    await expect(page.locator("#big .tri.stacked")).toHaveCount(scored);
  });

  test("shows the game's averages, composer and badges in the banner", async ({ page }) => {
    const id = "mm2";
    await open(page, "?game=" + id);
    const g = await gameInfo(page, id);
    await expect(page.locator("#rName")).toHaveText(`${g.title} (${g.year})`);
    await expect(page.locator("#rSub")).toHaveText(g.composer);
    await expect(page.locator("#rBadges .rbadge")).toHaveCount(g.badges);
    await expect(page.locator("#rCode")).toContainText("E ");
  });

  test("a game with nothing scored says so", async ({ page }) => {
    await open(page, "?game=mmdo");
    await expect(page.locator("#rName")).toHaveText(/Dual Override \(upcoming\)/);
    await expect(page.locator("#rSub")).toHaveText("No stage themes scored yet");
    await expect(page.locator("#rCode")).toBeEmpty();
    await expect(page.locator("#big .tri")).toHaveCount(0);
  });
});

test.describe("selecting a track", () => {
  test("shows it in the banner and brings its shape forward, dimming the rest", async ({ page }) => {
    await open(page, "?game=mm1");
    const t = (await gameInfo(page, "mm1")).tracks[0];
    await page.locator("#lg0").click();
    await expect(page.locator("#rName")).toHaveText(t.name);
    await expect(page.locator("#rSerial")).toHaveText(t.dln);
    await expect(page.locator("#rCode")).toContainText(t.color);
    await expect(page.locator("#rBadges .rbadge")).toHaveCount(0);
    await expect(page.locator("#rFav")).toBeVisible();
    await expect(page.locator("#cd0")).toHaveAttribute("aria-pressed", "true");
    const scored = (await gameInfo(page, "mm1")).tracks.filter(t => t.scored).length;
    await expect(page.locator("#big .tri.dim")).toHaveCount(scored - 1);
    // The selected shape is moved to the end, so it's drawn on top
    const lastFill = await page.locator("#big .tri").last().locator(".fill").getAttribute("stroke");
    expect(lastFill).toBe(t.color);
  });

  test("plays it, and selecting another track switches to it", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg0").click();
    await expectPlaying(page);
    await expect(page.locator('#legend .pi[data-pi="0"]')).toHaveClass(/on/);
    await page.locator("#lg1").click();
    await expect(page.locator("#lg0")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#lg1")).toHaveAttribute("aria-pressed", "true");
    await expectPlaying(page);
    expect(await inPage(page, ({ viz }) => viz.player.src)).toMatch(/audio\/gutsman\.mp3$/);
  });

  test("clicking the selected track clears it and stops the music", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg0").click();
    await expectPlaying(page);
    await page.locator("#lg0").click();
    await expectPlaying(page, false);
    await expect(page.locator("#rName")).toHaveText("Mega Man (1987)");
    expect(await selectedTrack(page)).toBeNull();
  });

  test("hovering a track previews it; leaving goes back", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg2").hover();
    await expect(page.locator("#rName")).toHaveText("Ice Man");
    await page.mouse.move(5, 5);
    await expect(page.locator("#rName")).toHaveText("Mega Man (1987)");
  });

  test("while a track plays, hovering others doesn't change the banner", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg0").click();
    await expectPlaying(page);
    await page.locator("#lg2").hover();
    await page.waitForTimeout(200);
    await expect(page.locator("#rName")).toHaveText("Cut Man");
  });

  test("keyboard focus previews like hovering", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg3").focus();
    await expect(page.locator("#rName")).toHaveText("Bomb Man");
  });
});

test.describe("the live response to the music", () => {
  test("pulses the playing shape, and resets when it stops", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg0").click();
    await expectPlaying(page);
    await expect(page.locator("#big .tri[transform]")).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator("#rSw")).toHaveAttribute("style", /filter: brightness/);
    await page.locator("#lg0").click();
    await expect(page.locator("#big .tri[transform]")).toHaveCount(0);
  });

  test("is off for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "?game=mm1");
    await page.locator("#lg0").click();
    await expectPlaying(page);
    await page.waitForTimeout(500);
    await expect(page.locator("#big .tri[transform]")).toHaveCount(0);
  });
});

test.describe("the game picker", () => {
  test("lists every game, then the custom list", async ({ page }) => {
    await open(page, "?game=mm1");
    const count = await inPage(page, ({ model }) => model.GAMES.length);
    await expect(page.locator("#gameSel option")).toHaveCount(count + 1);
    await expect(page.locator("#gameSel option").last()).toHaveText("Custom track list");
  });

  test("loads the chosen game", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#gameSel").selectOption({ label: "Mega Man 3 (1990)" });
    expect(await currentView(page)).toBe("mm3");
    await expect(page.locator("#legend li")).toHaveCount((await gameInfo(page, "mm3")).tracks.length);
  });

  test("stops the music when the game changes", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#lg0").click();
    await expectPlaying(page);
    await page.locator("#gameSel").selectOption({ label: "Mega Man 2 (1988)" });
    await expectPlaying(page, false);
  });
});

test.describe("the custom track list", () => {
  const pick = (page, gi, ti) => page.locator(`#customList input[data-gi="${gi}"][data-ti="${ti}"]`);

  test("opens, filters by track or game, and closes with Done, Escape or a click outside", async ({ page }) => {
    await open(page, "?game=mm1");
    const panel = page.locator("#customPanel");
    await page.locator("#customBtn").click();
    await expect(panel).toBeVisible();
    await expect(page.locator("#customFilter")).toBeFocused();
    // Every word must appear in the track name or game title
    const matching = words => page.locator("#customList .copt").evaluateAll((opts, words) =>
      opts.filter(o => words.every(w => o.dataset.hay.includes(w))).length, words);
    await page.locator("#customFilter").fill("metal man");
    await expect(page.locator("#customList .copt:visible")).toHaveCount(await matching(["metal", "man"]));
    await page.locator("#customFilter").fill("Metal  Man 2");
    await expect(page.locator("#customList .copt:visible")).toHaveCount(1);
    await expect(page.locator("#customList .cgrp:visible")).toHaveCount(1);
    await expect(page.locator("#customList .copt:visible")).toContainText("Metal Man");
    await page.locator("#customFilter").fill("zzz");
    await expect(page.locator("#customList .cgrp:visible")).toHaveCount(0);
    await page.locator("#customDone").click();
    await expect(panel).toBeHidden();
    await page.locator("#customBtn").click();
    await expect(page.locator("#customFilter")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await page.locator("#customBtn").click();
    await page.mouse.click(5, 5);
    await expect(panel).toBeHidden();
  });

  test("lists every scored or playable track", async ({ page }) => {
    await open(page, "?game=mm1");
    const n = await inPage(page, ({ model }) => model.GAMES.flatMap(g => g.tracks).filter(model.selectable).length);
    await expect(page.locator("#customList input")).toHaveCount(n);
  });

  test("checking tracks builds the list in order and shows its averages", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#customBtn").click();
    await pick(page, 2, 0).check();
    await pick(page, 0, 1).check();
    expect(await currentView(page)).toBe("custom");
    await expect(page.locator("#customBtnText")).toHaveText("2 tracks selected");
    await expect(page.locator("#customCount")).toHaveText("2 selected");
    await expect(page.locator("#legend .nm")).toHaveText([/Metal Man\s*Mega Man 2/, /Guts Man\s*Mega Man$/]);
    await expect(page.locator("#rName")).toHaveText("Custom list (2 tracks)");
    await expect(page.locator("#rSub")).toHaveText("Averages of the 2 scored tracks in your list");
    await expect(page.locator("#gameSel")).toHaveValue("custom");
  });

  test("unchecking removes a track, and Clear empties the list", async ({ page }) => {
    await open(page, "?list=mm2.0,mm1.1,mm3.1");
    await page.locator("#customBtn").click();
    await pick(page, 0, 1).uncheck();
    expect(query(page)).toBe("?list=mm2.0,mm3.1");
    await page.locator("#customClear").click();
    await expect(page.locator("#legend .lgempty")).toBeVisible();
    await expect(page.locator("#customBtnText")).toHaveText("Pick tracks from any game");
    await expect(page.locator("#customList input:checked")).toHaveCount(0);
  });

  test("the playing track keeps playing while the list changes around it", async ({ page }) => {
    await open(page, "?list=mm2.0,mm1.1");
    await page.locator("#lg1").click();
    await expectPlaying(page);
    await page.locator("#customBtn").click();
    await pick(page, 2, 0).uncheck();   // the other track
    expect(await selectedTrack(page)).toBe("Guts Man");
    await expect(page.locator("#lg0")).toHaveAttribute("aria-pressed", "true");
    await expectPlaying(page);
  });

  test("choosing a game clears the list", async ({ page }) => {
    await open(page, "?list=mm2.0,mm1.1");
    await page.locator("#gameSel").selectOption({ label: "Mega Man 2 (1988)" });
    await expect(page.locator("#customBtnText")).toHaveText("Pick tracks from any game");
    await page.locator("#gameSel").selectOption("custom");
    await expect(page.locator("#legend .lgempty")).toBeVisible();
  });

  test("names each track's game in the legend and the banner", async ({ page }) => {
    await open(page, "?list=mm2.0&track=0");
    await expect(page.locator("#lg0 small")).toHaveText("Mega Man 2");
    await expect(page.locator("#rSerial")).toHaveText("Mega Man 2 · DWN-009");
  });
});
