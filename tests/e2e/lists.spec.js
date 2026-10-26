// Favorites, saved lists and color buddies, all of which become custom lists
import { test, expect, open, openGame, inPage, selectedTrack, currentView, query, toVisualizer } from "./fixtures.js";

const stored = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "null"), key);
const star = (page, key) => page.locator(`#rpBody .rp-fav[data-fav="${key}"]`);
// Opens the track's game in the report, then clicks its star
const clickStar = async (page, key) => { await openGame(page, key.split(".")[0]); await star(page, key).click(); };
const listKeys = page => inPage(page, ({ viz }) => viz.G.tracks.map(t => `${t.game.id}.${t.ti}`));

test.describe("favorites", () => {
  test("a star adds and removes a track, and is remembered", async ({ page }) => {
    await open(page);
    await expect(page.locator("#favBtn")).toBeDisabled();
    await clickStar(page, "mm2.0");
    await clickStar(page, "mm1.3");
    await expect(star(page, "mm2.0")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#favBtn")).toBeEnabled();
    await expect(page.locator("#favBtn")).toHaveAttribute("title", "Open favorites (2)");
    expect(await stored(page, "rmcp-favorites")).toEqual(["mm2.0", "mm1.3"]);

    await page.reload();
    await expect(star(page, "mm2.0")).toHaveAttribute("aria-pressed", "true");
    await clickStar(page, "mm2.0");
    expect(await stored(page, "rmcp-favorites")).toEqual(["mm1.3"]);
    await expect(star(page, "mm2.0")).toHaveAttribute("aria-pressed", "false");
  });

  test("starring a row doesn't play it", async ({ page }) => {
    await open(page);
    await clickStar(page, "mm2.0");
    expect(await selectedTrack(page)).toBeNull();
  });

  test("the favorites button opens them as a custom list in the visualizer", async ({ page }) => {
    await open(page);
    await clickStar(page, "mm2.0");
    await clickStar(page, "mm1.3");
    await page.locator("#favBtn").click();
    await expect(page.locator("#viewViz")).toBeVisible();
    expect(await listKeys(page)).toEqual(["mm2.0", "mm1.3"]);
    await expect(page.locator("#savedSel")).toHaveValue("fav");
    await expect(page.locator("#delBtn")).toBeHidden();
  });

  test("the banner's star favorites the shown track, and an open favorites list follows along", async ({ page }) => {
    await open(page);
    await clickStar(page, "mm2.0");
    await page.locator("#favBtn").click();
    await page.locator("#lg0").click();
    await page.locator("#rFav").click();   // unfavorite Metal Man from the banner
    expect(await stored(page, "rmcp-favorites")).toEqual([]);
    await expect(page.locator("#legend .lgempty")).toBeVisible();
  });

  test("come first in the saved-list picker", async ({ page }) => {
    await open(page);
    await clickStar(page, "mm2.0");
    await expect(page.locator("#savedSel option").nth(1)).toHaveText("★ Favorites (1)");
  });

  test("the floating favorites button shows on the report once there are favorites", async ({ page }) => {
    await open(page);
    await clickStar(page, "mm1.0");
    await page.locator("#rp-mm3").scrollIntoViewIfNeeded();
    await expect(page.locator("#favFab")).toBeVisible();
    await page.locator("#favFab").click();
    await expect(page.locator("#viewViz")).toBeVisible();
  });
});

test.describe("saved lists", () => {
  const save = async (page, name) => {
    await page.locator("#saveBtn").click();
    await expect(page.locator("#saveForm")).toBeVisible();
    await page.locator("#saveName").fill(name);
    await page.locator("#saveName").press("Enter");
  };

  test("saving needs a list with tracks", async ({ page }) => {
    await open(page, "?list=");
    await expect(page.locator("#saveBtn")).toBeDisabled();
    await expect(page.locator("#savedSel option")).toHaveText(["No saved lists yet"]);
  });

  test("a list is saved under a name and remembered", async ({ page }) => {
    await open(page, "?list=mm2.0,mm3.1");
    await save(page, "Favorite bosses");
    await expect(page.locator("#saveForm")).toBeHidden();
    await expect(page.locator("#saveNote")).toHaveText("Saved “Favorite bosses”.");
    await expect(page.locator("#savedSel option:checked")).toHaveText("Favorite bosses (2)");
    const lists = await stored(page, "rmcp-saved-lists");
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ name: "Favorite bosses", tracks: ["mm2.0", "mm3.1"] });

    await page.goto("/?game=mm1");
    await page.locator("#savedSel").selectOption({ label: "Favorite bosses (2)" });
    expect(await currentView(page)).toBe("custom");
    expect(await listKeys(page)).toEqual(["mm2.0", "mm3.1"]);
    expect(query(page)).toBe("?list=mm2.0,mm3.1");
  });

  test("saving under an existing name replaces that list", async ({ page }) => {
    await open(page, "?list=mm2.0");
    await save(page, "Mix");
    await page.goto("/?list=mm3.1,mm1.0");
    await save(page, "mix");
    const lists = await stored(page, "rmcp-saved-lists");
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ name: "mix", tracks: ["mm3.1", "mm1.0"] });
  });

  test("the save form fills in the chosen list's name, and Cancel or Escape closes it", async ({ page }) => {
    await open(page, "?list=mm2.0");
    await save(page, "One");
    await page.locator("#saveBtn").click();
    await expect(page.locator("#saveName")).toHaveValue("One");
    await page.locator("#saveCancel").click();
    await expect(page.locator("#saveForm")).toBeHidden();
    await page.locator("#saveBtn").click();
    await page.locator("#saveName").press("Escape");
    await expect(page.locator("#saveForm")).toBeHidden();
  });

  test("lists are sorted by name", async ({ page }) => {
    await open(page, "?list=mm2.0");
    await save(page, "Zed");
    await save(page, "Alpha");
    await expect(page.locator("#savedSel option")).toHaveText(["Choose a saved list…", "Alpha (1)", "Zed (1)"]);
  });

  test("the selection clears once the list on screen changes", async ({ page }) => {
    await open(page, "?list=mm2.0");
    await save(page, "Mine");
    await page.locator("#customBtn").click();
    await page.locator('#customList input[data-gi="0"][data-ti="0"]').check();
    await expect(page.locator("#savedSel")).toHaveValue("");
  });

  test("deleting asks once more first", async ({ page }) => {
    await open(page, "?list=mm2.0");
    await save(page, "Gone soon");
    const del = page.locator("#delBtn");
    await expect(del).toBeVisible();
    await del.click();
    await expect(del).toHaveText("Really delete?");
    expect(await stored(page, "rmcp-saved-lists")).toHaveLength(1);
    await del.click();
    await expect(page.locator("#saveNote")).toHaveText("Deleted “Gone soon”.");
    expect(await stored(page, "rmcp-saved-lists")).toEqual([]);
    await expect(page.locator("#savedSel option")).toHaveText(["No saved lists yet"]);
  });

  test("a saved track that no longer exists is skipped", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("rmcp-saved-lists", JSON.stringify([{ id: "x", name: "Old", tracks: ["mm2.0", "gone.4", "mm2.99"] }])));
    await open(page, "?game=mm1");
    await page.locator("#savedSel").selectOption({ label: "Old (3)" });
    expect(await listKeys(page)).toEqual(["mm2.0"]);
  });

  test("bad saved data doesn't break the page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => { localStorage.setItem("rmcp-saved-lists", "{oops"); localStorage.setItem("rmcp-favorites", "nope"); });
    await open(page, "?game=mm1");
    await expect(page.locator("#savedSel option")).toHaveText(["No saved lists yet"]);
  });
});

test.describe("color buddies", () => {
  test("group tracks with identical scores, biggest groups first", async ({ page }) => {
    await open(page);
    const groups = await page.locator("#buddies .bud").evaluateAll(buds => buds.map(b => ({
      size: b.querySelectorAll("li").length, color: b.querySelector(".bud-sw span").textContent,
    })));
    expect(groups.length).toBeGreaterThan(0);
    groups.slice(1).forEach((g, i) => expect(g.size).toBeLessThanOrEqual(groups[i].size));
    const expected = await inPage(page, ({ model }) => {
      const byColor = {};
      model.GAMES.flatMap(g => g.scored).forEach(t => { byColor[t.color] = (byColor[t.color] || 0) + 1; });
      return Object.values(byColor).filter(n => n > 1).length;
    });
    expect(groups).toHaveLength(expected);
    for (const g of groups) expect(g.size).toBeGreaterThan(1);
  });

  test("clicking a buddy plays it", async ({ page }) => {
    await open(page);
    const b = page.locator("#buddies li button").first();
    const name = (await b.locator("> span").textContent()).trim();
    await b.click();
    expect(await selectedTrack(page)).toBe(name);
    await expect(b).toHaveClass(/on/);
  });

  test("a group loads as a custom list", async ({ page }) => {
    await open(page);
    const bud = page.locator("#buddies .bud").first();
    const keys = await bud.locator("li button").evaluateAll(bs => bs.map(b => [+b.dataset.gi, +b.dataset.ti]));
    await bud.locator(".bud-load").click();
    await expect(page.locator("#viewViz")).toBeVisible();
    expect(await currentView(page)).toBe("custom");
    const expected = await inPage(page, ({ model }, keys) => keys.map(([gi, ti]) => `${model.GAMES[gi].id}.${ti}`), keys);
    expect(await listKeys(page)).toEqual(expected);
    // Every track in the group has the same color, so the list's average is that color
    await expect(page.locator("#rCode")).toContainText(await bud.locator(".bud-sw span").textContent());
  });
});

test.describe("switching back from a list", () => {
  test("the visualizer can go back to the custom list from a game", async ({ page }) => {
    await open(page, "?list=mm2.0");
    await toVisualizer(page);
    await page.locator("#gameSel").selectOption({ label: "Mega Man 3 (1990)" });
    await page.goBack();
    expect(await listKeys(page)).toEqual(["mm2.0"]);
  });
});
