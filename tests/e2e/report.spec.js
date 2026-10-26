// The full color report: rows, jump bar, search, "Play all" and the game profiles
import { test, expect, open, openGame, inPage, selectedTrack, currentView, expectPlaying, endTrack, query } from "./fixtures.js";

const row = (page, gi, ti) => page.locator(`#rpBody .rp-row[data-gi="${gi}"][data-ti="${ti}"]`);
const inViewport = locator => locator.evaluate(e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });

test.describe("report rows", () => {
  test("show each track's name, serial, composer, intensity and color", async ({ page }) => {
    await open(page);
    const t = await inPage(page, ({ model }) => {
      const t = model.GAMES[0].tracks[0];
      return { name: t.name, dln: t.dln, composer: t.composer || t.game.composer, total: t.vals.reduce((a, b) => a + b), cname: t.cname, color: t.color };
    });
    const r = row(page, 0, 0);
    await expect(r.locator(".rp-id b")).toHaveText(t.name);
    await expect(r.locator(".rp-id span")).toHaveText(t.dln);
    await expect(r.locator(".rp-id small")).toHaveText(t.composer);
    await expect(r.locator(".rp-int b")).toHaveText(String(t.total));
    await expect(r.locator(".rp-col b")).toHaveText(t.cname);
    await expect(r.locator(".rp-col span")).toHaveText(t.color);
    await expect(r.locator(".bar")).toHaveCount(3);
  });

  test("an unscored row says so", async ({ page }) => {
    await open(page);
    const unscored = page.locator("#rpBody .rp-row").filter({ has: page.locator(".rp-none") }).first();
    await expect(unscored.locator(".rp-none")).toHaveText("Not scored yet");
    await expect(unscored.locator(".rp-col b")).toHaveText("No color yet");
  });

  test("clicking a row plays its track and marks it, staying on the report", async ({ page }) => {
    await open(page);
    await openGame(page, "mm2");
    await row(page, 2, 0).click();
    await expect(page.locator("#viewReport")).toBeVisible();
    expect(await currentView(page)).toBe("mm2");
    expect(await selectedTrack(page)).toBe("Metal Man");
    await expect(row(page, 2, 0)).toHaveClass(/on/);
    await expectPlaying(page);
    await row(page, 2, 0).click();
    await expectPlaying(page, false);
  });

  test("the playing track's small shape pulses with the music", async ({ page }) => {
    await open(page);
    await openGame(page, "mm1");
    await row(page, 0, 0).click();
    await expectPlaying(page);
    await expect(page.locator('#rpBody .rp-hex[data-gi="0"][data-ti="0"] .tri[transform]')).toHaveCount(1, { timeout: 5000 });
  });
});

test.describe("game sections", () => {
  const section = (page, id) => page.locator("#rp-" + id), toggle = (page, id) => page.locator(`#rp-${id} .rp-toggle`);

  test("start closed: just the banner, with the rows hidden", async ({ page }) => {
    await open(page);
    const ids = await inPage(page, ({ model }) => model.GAMES.map(g => g.id));
    await expect(page.locator("#rpBody .rp-game.open")).toHaveCount(0);
    await expect(page.locator('#rpBody .rp-toggle[aria-expanded="false"]')).toHaveCount(ids.length);
    for (const id of ids) {
      await expect(section(page, id).locator(".rp-band")).toBeVisible();
      await expect(page.locator(`#rpt-${id}`)).toBeHidden();
    }
    await expect(page.locator("#rpBody .rp-row").first()).toBeHidden();
  });

  test("clicking the title drops the rows down; clicking again closes them", async ({ page }) => {
    await open(page);
    await toggle(page, "mm2").click();
    await expect(section(page, "mm2")).toHaveClass(/open/);
    await expect(toggle(page, "mm2")).toHaveAttribute("aria-expanded", "true");
    await expect(row(page, 2, 0)).toBeVisible();
    await expect(page.locator("#rpBody .rp-game.open")).toHaveCount(1);   // the others stay closed
    await toggle(page, "mm2").click();
    await expect(toggle(page, "mm2")).toHaveAttribute("aria-expanded", "false");
    await expect(row(page, 2, 0)).toBeHidden();
  });

  test("a click anywhere else on the banner toggles it too", async ({ page }) => {
    await open(page);
    await section(page, "mm2").locator(".rp-gstats").click();
    await expect(section(page, "mm2")).toHaveClass(/open/);
    await section(page, "mm2").locator(".rp-eyebrow").click();
    await expect(section(page, "mm2")).not.toHaveClass(/open/);
  });

  test("Play all plays without opening the rows", async ({ page }) => {
    await open(page);
    await section(page, "mm2").locator(".rp-viz").click();
    await expect(page.locator("#viewViz")).toBeVisible();
    await expect(section(page, "mm2")).not.toHaveClass(/open/);
  });

  test("the title is a button, so the keyboard opens it too", async ({ page }) => {
    await open(page);
    await toggle(page, "mm3").focus();
    await page.keyboard.press("Enter");
    await expect(section(page, "mm3")).toHaveClass(/open/);
    await page.keyboard.press(" ");
    await expect(section(page, "mm3")).not.toHaveClass(/open/);
    await expect(toggle(page, "mm3")).toHaveAttribute("aria-controls", "rpt-mm3");
  });

  test("hidden rows can't be tabbed to", async ({ page }) => {
    await open(page);
    await toggle(page, "mm1").focus();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement.closest(".rp-drop") ? "row" : document.activeElement.className);
    expect(focused).not.toBe("row");
  });

  test("going to a row opens its game: the color strip and the search", async ({ page }) => {
    await open(page);
    await page.locator('#rpBody .rp-all button[data-to-gi="4"][data-to-ti="0"]').click();
    await expect(page.locator('#rpBody .rp-game:has(.rp-row[data-gi="4"][data-ti="0"])')).toHaveClass(/open/);
    await page.locator("#rpFind").fill("quick");
    await page.locator("#rpFind").press("Enter");
    await expect(section(page, "mm2")).toHaveClass(/open/);
    await expect(row(page, 2, 3)).toBeVisible();
  });

  test("a link to a track on the report opens that game", async ({ page }) => {
    await open(page, "?view=report&game=mm2&track=0");
    await expect(section(page, "mm2")).toHaveClass(/open/);
    await expect(row(page, 2, 0)).toBeVisible();
    await expect(page.locator("#rpBody .rp-game.open")).toHaveCount(1);
  });

  test("open instantly for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await toggle(page, "mm2").click();
    expect(await page.locator("#rpt-mm2").evaluate(e => getComputedStyle(e).transitionDuration)).toMatch(/^0s/);
  });
});

test.describe("navigating the report", () => {
  test("the jump bar scrolls to each game", async ({ page }) => {
    await open(page);
    await page.locator('#rpJump [data-jump="rp-mm5"]').click();
    expect(await inViewport(page.locator("#rp-mm5 .rp-band"))).toBe(true);
  });

  test("the color strip jumps to a track's row and flashes it", async ({ page }) => {
    await open(page);
    await page.locator('#rpBody .rp-all button[data-to-gi="4"][data-to-ti="0"]').click();
    await expect(row(page, 4, 0)).toHaveClass(/flash/);
    await expect.poll(() => inViewport(row(page, 4, 0))).toBe(true);
  });
});

test.describe("robot master search", () => {
  const input = page => page.locator("#rpFind"), list = page => page.locator("#rpFindList");

  test("lists matching robot masters, names first", async ({ page }) => {
    await open(page);
    await input(page).fill("air");
    await expect(list(page)).toBeVisible();
    await expect(input(page)).toHaveAttribute("aria-expanded", "true");
    const names = await list(page).locator("li[role=option] b").allTextContents();
    expect(names[0]).toBe("Air Man");
    expect(names.length).toBeLessThanOrEqual(12);
    await expect(list(page).locator('li[aria-selected="true"]')).toHaveCount(1);
  });

  test("matches games and serials too", async ({ page }) => {
    await open(page);
    await input(page).fill("DWN-017");
    await expect(list(page).locator("li[role=option] b").first()).toHaveText("Needle Man");
    await input(page).fill("bass ground");
    await expect(list(page).locator("li[role=option] b")).toHaveText(["Ground Man"]);
  });

  test("arrow keys move through the matches and Enter jumps to the row", async ({ page }) => {
    await open(page);
    await input(page).fill("man");
    await input(page).press("ArrowDown");
    await expect(list(page).locator("li#rpf1")).toHaveAttribute("aria-selected", "true");
    await expect(input(page)).toHaveAttribute("aria-activedescendant", "rpf1");
    await input(page).press("ArrowUp");
    await input(page).press("ArrowUp");   // wraps around to the last match
    const last = (await list(page).locator("li[role=option]").count()) - 1;
    await expect(input(page)).toHaveAttribute("aria-activedescendant", `rpf${last}`);
    await input(page).fill("quick");
    await input(page).press("Enter");
    await expect(list(page)).toBeHidden();
    await expect(input(page)).toHaveValue("");
    await expect(row(page, 2, 3)).toHaveClass(/flash/);
  });

  test("clicking a match jumps to its row", async ({ page }) => {
    await open(page);
    await input(page).fill("gemini");
    await list(page).locator("li[role=option]").first().click();
    await expect(page.locator("#rpBody .rp-row.flash")).toHaveCount(1);
    await expect(page.locator("#rpBody .rp-row.flash b").first()).toHaveText("Gemini Man");
  });

  test("Escape closes the list, then clears the box", async ({ page }) => {
    await open(page);
    await input(page).fill("air");
    await input(page).press("Escape");
    await expect(list(page)).toBeHidden();
    await expect(input(page)).toHaveValue("air");
    await input(page).press("Escape");
    await expect(input(page)).toHaveValue("");
  });

  test("says when nothing matches, and skips ??? placeholders", async ({ page }) => {
    await open(page);
    await input(page).fill("zzzz");
    await expect(list(page).locator("li.none")).toHaveText("No robot master matches “zzzz”");
    await input(page).fill("???");
    await expect(list(page).locator("li[role=option]")).toHaveCount(0);
  });
});

test.describe("Play all", () => {
  test("opens the game in the visualizer and plays its tracks in order", async ({ page }) => {
    await open(page);
    await page.locator("#rp-mm2 .rp-viz").click();
    await expect(page.locator("#viewViz")).toBeVisible();
    expect(await selectedTrack(page)).toBe("Metal Man");
    await expectPlaying(page);
    expect(query(page)).toBe("?game=mm2&track=0");
    await endTrack(page);
    await expect.poll(() => selectedTrack(page)).toBe("Air Man");
    await endTrack(page);
    await expect.poll(() => selectedTrack(page)).toBe("Bubble Man");
  });

  test("stops moving on once someone picks a track", async ({ page }) => {
    await open(page);
    await page.locator("#rp-mm2 .rp-viz").click();
    await page.locator("#lg5").click();   // Flash Man
    await endTrack(page);
    await page.waitForTimeout(200);
    expect(await selectedTrack(page)).toBe("Flash Man");
  });

  test("stops after the last track", async ({ page }) => {
    await open(page);
    await page.locator("#rp-mm1 .rp-viz").click();
    const last = await inPage(page, ({ viz }) => viz.G.tracks.length - 1);
    for (let i = 0; i < last; i++) await endTrack(page);
    await expect.poll(() => selectedTrack(page)).toBe("Elec Man");
    await endTrack(page);
    await page.waitForTimeout(200);
    expect(await selectedTrack(page)).toBe("Elec Man");
  });

  test("only games with audio have the button", async ({ page }) => {
    await open(page);
    const withAudio = await inPage(page, ({ model }) => model.GAMES.filter(g => g.tracks.some(t => t.audio)).length);
    await expect(page.locator("#rpBody .rp-viz")).toHaveCount(withAudio);
  });
});

test.describe("game profiles", () => {
  test("show each scored game's averages, intensity and a strip of its colors", async ({ page }) => {
    await open(page);
    const g = await inPage(page, ({ model }) => {
      const g = model.GAMES.find(g => g.id === "mm2");
      return { title: g.title, color: g.color, avg: g.avg.map(v => v.toFixed(1)), total: (g.avg[0] + g.avg[1] + g.avg[2]).toFixed(1), scored: g.scored.length, index: model.GAMES.indexOf(g) };
    });
    const crow = page.locator(`#compare .crow[data-game="${g.index}"]`);
    await expect(crow.locator(".nm")).toContainText(g.title);
    await expect(crow.locator(".big")).toHaveAttribute("style", `background:${g.color}`);
    await expect(crow.locator(".digits > span:not(.ctot)")).toHaveText(g.avg);
    await expect(crow.locator(".ctot")).toHaveText(g.total);
    await expect(crow.locator(".strip span")).toHaveCount(g.scored);
  });

  test("clicking one opens that game in the visualizer and marks it", async ({ page }) => {
    await open(page);
    const crow = page.locator("#compare .crow").nth(2);
    await crow.click();
    await expect(page.locator("#viewViz")).toBeVisible();
    expect(await currentView(page)).toBe(await inPage(page, ({ model }, i) => model.GAMES[i].id, +(await crow.getAttribute("data-game"))));
    await expect(crow).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('#compare .crow[aria-pressed="true"]')).toHaveCount(1);
  });
});
