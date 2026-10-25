// The track table (Quick Search): filters, sorting, and selecting tracks from it
import { test, expect, open, inPage, selectedTrack, currentView, expectPlaying } from "./fixtures.js";

const rows = page => page.locator("#trackTable tbody tr[data-gi]");
const column = (page, n) => page.locator(`#trackTable tbody tr td:nth-child(${n})`).allTextContents();
const scoredCount = page => inPage(page, ({ model }) => model.GAMES.flatMap(g => g.scored).length);
const sortBy = (page, key) => page.locator(`#trackTable th[data-key="${key}"] button`).click();

test.describe("filters", () => {
  test.beforeEach(async ({ page }) => { await open(page, "?game=mm1"); });

  test("free text matches every word against name, serial, game, color and composer", async ({ page }) => {
    await page.locator("#fText").fill("metal man");
    const names = await column(page, 3);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every(n => /metal man/i.test(n))).toBe(true);
    await page.locator("#fText").fill("DWN-009");
    await expect(rows(page)).toHaveCount(await inPage(page, ({ model }) => model.GAMES.flatMap(g => g.scored).filter(t => t.dln === "DWN-009").length));
    await page.locator("#fText").fill("#BF8080");
    expect(await column(page, 9)).toEqual(expect.arrayContaining(["#BF8080"]));
    expect((await column(page, 9)).every(c => c === "#BF8080")).toBe(true);
  });

  test("the count says how many of the scored tracks are showing", async ({ page }) => {
    const total = await scoredCount(page);
    await expect(page.locator("#fCount")).toHaveText(`${total} tracks`);
    await expect(page.locator("#fClear")).toBeHidden();
    await page.locator("#fText").fill("man");
    const shown = await rows(page).count();
    await expect(page.locator("#fCount")).toHaveText(`Showing ${shown} of ${total} tracks`);
    await expect(page.locator("#fClear")).toBeVisible();
  });

  test("the game filter lists scored games and shows only that game's tracks", async ({ page }) => {
    const games = await inPage(page, ({ model }) => model.GAMES.filter(g => g.scored.length).map(g => g.title));
    await expect(page.locator("#fGame option:not([value=''])")).toHaveText(games);
    await page.locator("#fGame").selectOption({ label: "Mega Man 2" });
    await expect(rows(page)).toHaveCount(await inPage(page, ({ model }) => model.GAMES.find(g => g.id === "mm2").scored.length));
    expect(new Set(await column(page, 1))).toEqual(new Set(["Mega Man 2"]));
  });

  test("color and composer filters show the counts in their options", async ({ page }) => {
    for (const id of ["fColor", "fComposer"]) {
      if (await page.locator("#fClear").isVisible()) await page.locator("#fClear").click();
      const option = page.locator(`#${id} option:not([value=''])`).first();
      const [label, value] = [await option.textContent(), await option.getAttribute("value")];
      await page.locator("#" + id).selectOption(value);
      await expect(rows(page)).toHaveCount(+label.match(/\((\d+)\)$/)[1]);
    }
  });

  test("a credit naming several people counts for each of them", async ({ page }) => {
    const credited = await inPage(page, ({ model }) => model.GAMES.flatMap(g => g.scored.map(t => t.composer || g.composer)).find(c => /orig\./.test(c)));
    test.skip(!credited, "no arranged tracks are scored");
    const original = credited.match(/orig\.\s*([^·,&]+)/)[1].trim();
    await page.locator("#fComposer").selectOption(original);
    expect((await column(page, 10)).every(c => c.includes(original))).toBe(true);
  });

  test("no matches shows a message; Clear resets every filter", async ({ page }) => {
    await page.locator("#fText").fill("no such robot");
    await expect(page.locator("#trackTable tbody td.none")).toHaveText("No tracks match these filters.");
    await page.locator("#fGame").selectOption({ label: "Mega Man 2" });
    await page.locator("#fClear").click();
    await expect(page.locator("#fText")).toHaveValue("");
    await expect(page.locator("#fGame")).toHaveValue("");
    await expect(page.locator("#fText")).toBeFocused();
    await expect(rows(page)).toHaveCount(await scoredCount(page));
  });
});

test.describe("sorting", () => {
  test.beforeEach(async ({ page }) => { await open(page, "?game=mm1"); });

  test("by a score, ascending then descending", async ({ page }) => {
    await sortBy(page, "e");
    await expect(page.locator('#trackTable th[data-key="e"]')).toHaveAttribute("aria-sort", "ascending");
    const up = (await column(page, 4)).map(Number);
    expect(up).toEqual([...up].sort((a, b) => a - b));
    await sortBy(page, "e");
    await expect(page.locator('#trackTable th[data-key="e"]')).toHaveAttribute("aria-sort", "descending");
    const down = (await column(page, 4)).map(Number);
    expect(down).toEqual([...down].sort((a, b) => b - a));
  });

  test("ties keep series order", async ({ page }) => {
    await sortBy(page, "e");
    const order = await rows(page).evaluateAll(trs => trs.map(tr => [+tr.cells[3].textContent, +tr.dataset.gi, +tr.dataset.ti]));
    for (let i = 1; i < order.length; i++) {
      const [a, b] = [order[i - 1], order[i]];
      if (a[0] === b[0]) expect(a[1] * 1000 + a[2]).toBeLessThan(b[1] * 1000 + b[2]);
    }
  });

  test("by serial uses the number only", async ({ page }) => {
    await sortBy(page, "dln");
    const nums = (await column(page, 2)).map(d => /-(\d+)/.exec(d)).filter(Boolean).map(m => +m[1]);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  test("by name or color name, alphabetically", async ({ page }) => {
    await sortBy(page, "name");
    const names = await column(page, 3);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    await sortBy(page, "cname");
    const colors = await column(page, 8);
    expect(colors).toEqual([...colors].sort((a, b) => a.localeCompare(b)));
  });

  test("by game uses series order, and only one heading is marked sorted", async ({ page }) => {
    await sortBy(page, "total");
    await sortBy(page, "game");
    const gis = await rows(page).evaluateAll(trs => trs.map(tr => +tr.dataset.gi));
    expect(gis).toEqual([...gis].sort((a, b) => a - b));
    await expect(page.locator("#trackTable th[aria-sort]")).toHaveCount(1);
  });

  test("keeps the sort while filtering", async ({ page }) => {
    await sortBy(page, "total");
    await page.locator("#fText").fill("man");
    const totals = (await column(page, 7)).map(Number);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });
});

test.describe("selecting from the table", () => {
  test("clicking a row loads its game and plays the track; clicking again stops it", async ({ page }) => {
    await open(page, "?game=mm1");
    await page.locator("#fGame").selectOption({ label: "Mega Man 2" });
    const row = rows(page).first();
    await row.click();
    expect(await currentView(page)).toBe("mm2");
    expect(await selectedTrack(page)).toBe("Metal Man");
    await expect(row).toHaveClass(/on/);
    await expectPlaying(page);
    await row.click();
    expect(await selectedTrack(page)).toBeNull();
    await expect(row).not.toHaveClass(/on/);
  });

  test("a track in the custom list is selected in place, without leaving the list", async ({ page }) => {
    await open(page, "?list=mm2.0,mm1.1");
    await page.locator("#fText").fill("guts man");
    await page.locator('#trackTable tbody tr[data-gi="0"][data-ti="1"]').click();   // Mega Man's Guts Man
    expect(await currentView(page)).toBe("custom");
    expect(await selectedTrack(page)).toBe("Guts Man");
  });

  test("Enter or Space on a focused row selects it", async ({ page }) => {
    await open(page, "?game=mm1");
    await rows(page).nth(1).focus();
    await page.keyboard.press("Enter");
    expect(await selectedTrack(page)).toBe("Guts Man");
    await page.keyboard.press(" ");
    expect(await selectedTrack(page)).toBeNull();
  });
});
