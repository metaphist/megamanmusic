// The page as it first loads: the report, every section rendered from the data, and the view switch
import { test, expect, open, inPage } from "./fixtures.js";

test.describe("first load", () => {
  test("opens on the report, with the visualizer hidden", async ({ page }) => {
    await open(page);
    await expect(page.locator("#viewReport")).toBeVisible();
    await expect(page.locator("#viewViz")).toBeHidden();
    await expect(page.locator("#viewBtnLong")).toHaveText("Open the visualizer");
    expect(new URL(page.url()).search).toBe("");
  });

  test("renders a report section per game and a row per track", async ({ page }) => {
    await open(page);
    const { games, tracks, selectable } = await inPage(page, ({ model }) => ({
      games: model.GAMES.length,
      tracks: model.GAMES.flatMap(g => g.tracks).length,
      selectable: model.GAMES.flatMap(g => g.tracks).filter(model.selectable).length,
    }));
    await expect(page.locator("#rpBody .rp-game")).toHaveCount(games);
    await expect(page.locator("#rpBody .rp-row")).toHaveCount(tracks);
    await expect(page.locator("#rpBody button.rp-row")).toHaveCount(selectable);
    await expect(page.locator("#rpBody .rp-fav")).toHaveCount(selectable);
    await expect(page.locator("#rpJump button")).toHaveCount(games);
  });

  test("orders the report by release date", async ({ page }) => {
    await open(page);
    const expected = await inPage(page, ({ model }) => model.RELEASE_ORDER.map(g => "rp-" + g.id));
    expect(await page.locator("#rpBody .rp-game").evaluateAll(els => els.map(e => e.id))).toEqual(expected);
  });

  test("shows a profile row for each scored game and the score strip for each scored track", async ({ page }) => {
    await open(page);
    const { scoredGames, scoredTracks } = await inPage(page, ({ model }) => ({
      scoredGames: model.GAMES.filter(g => g.avg).length,
      scoredTracks: model.GAMES.flatMap(g => g.scored).length,
    }));
    await expect(page.locator("#compare .crow")).toHaveCount(scoredGames);
    await expect(page.locator("#rpBody .rp-all button")).toHaveCount(scoredTracks);
    await expect(page.locator("#trackTable tbody tr")).toHaveCount(scoredTracks);
    await expect(page.locator("#fCount")).toHaveText(`${scoredTracks} tracks`);
    await expect(page.locator("#ibars .idot")).toHaveCount(scoredTracks);
  });

  test("gives each game banner its average color and badges", async ({ page }) => {
    await open(page);
    const games = await inPage(page, ({ model }) => model.GAMES.map(g => ({ id: g.id, color: g.color, badges: g.badges.length })));
    for (const g of games) {
      const band = page.locator(`#rp-${g.id} .rp-band`);
      if (g.color) await expect(band).toHaveAttribute("style", new RegExp(`background:${g.color}`));
      else await expect(band).toHaveClass(/empty/);
      await expect(page.locator(`#rp-${g.id} .rp-badges .ticon`)).toHaveCount(g.badges);
    }
  });

  test("draws a small hexagon for every report row, with a shape for scored tracks", async ({ page }) => {
    await open(page);
    const scored = await inPage(page, ({ model }) => model.GAMES.flatMap(g => g.scored).length);
    await expect(page.locator("#rpBody .rp-hex svg")).toHaveCount(await page.locator("#rpBody .rp-row").count());
    await expect(page.locator("#rpBody .rp-hex .tri")).toHaveCount(scored);
  });

  test("loads every sprite", async ({ page }) => {
    await open(page);
    const broken = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll("img.spr")];
      imgs.forEach(i => { i.loading = "eager"; });
      await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
      return imgs.filter(i => !i.naturalWidth).map(i => i.getAttribute("src"));
    });
    expect(broken).toEqual([]);
  });
});

test.describe("switching views", () => {
  test("the title bar button switches between the report and the visualizer", async ({ page }) => {
    await open(page);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#viewViz")).toBeVisible();
    await expect(page.locator("#viewReport")).toBeHidden();
    await expect(page.locator("#viewBtnLong")).toHaveText("View full color report");
    await expect(page).toHaveURL(/\?game=mm1$/);
    await page.locator("#viewBtn").click();
    await expect(page.locator("#viewReport")).toBeVisible();
    expect(new URL(page.url()).search).toBe("");
  });

  test("the floating visualizer button appears once the title bar scrolls away, and opens the visualizer", async ({ page }) => {
    await open(page);
    await expect(page.locator("#vizFab")).toBeHidden();
    await page.locator("#rp-mm3").scrollIntoViewIfNeeded();
    await expect(page.locator("#vizFab")).toBeVisible();
    await page.locator("#vizFab").click();
    await expect(page.locator("#viewViz")).toBeVisible();
    await expect(page.locator("#vizFab")).toBeHidden();
  });
});

test.describe("theme", () => {
  test("toggles between light and dark, and remembers the choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await open(page);
    const toggle = page.locator("#themeToggle");
    await expect(toggle).toHaveAttribute("aria-label", "Switch to dark mode");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-label", "Switch to light mode");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.locator("#themeToggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("follows the system setting when nothing is saved", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
    await expect(page.locator("#themeToggle")).toHaveAttribute("aria-label", "Switch to light mode");
  });
});

test.describe("tooltips and info notes", () => {
  test("a badge shows its tip on hover", async ({ page }) => {
    await open(page);
    const badge = page.locator("#compare .ticon").first();
    const tip = await badge.getAttribute("data-tip");
    await badge.hover();
    await expect(page.locator("#gtip")).toBeVisible();
    await expect(page.locator("#gtip")).toHaveText(tip);
    await page.mouse.move(5, 5);
    await expect(page.locator("#gtip")).toBeHidden();
  });

  test("an info icon pins its note open until a click elsewhere or Escape", async ({ page }) => {
    await open(page, "?game=mm1");
    const info = page.locator("#chartInfo"), other = page.getByRole("button", { name: "How to use this table" });
    await info.click();
    await expect(info).toHaveAttribute("aria-expanded", "true");
    await other.click();   // opening one closes the others
    await expect(info).toHaveAttribute("aria-expanded", "false");
    await expect(other).toHaveAttribute("aria-expanded", "true");
    await info.click();
    await expect(other).toHaveAttribute("aria-expanded", "false");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await expect(info).toHaveAttribute("aria-expanded", "false");
    await info.click();
    await page.keyboard.press("Escape");
    await expect(info).toHaveAttribute("aria-expanded", "false");
  });
});
