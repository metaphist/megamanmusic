// The tier list page, with a hand-made scores file so these don't depend on the real ratings
import { test as plainTest } from "@playwright/test";
import { test, expect, open } from "./fixtures.js";

const CSV = [
  "game,name,energy,density,gravity,expression,synergy,range",
  "mm2,Metal Man,3,3,3,5,5,5",    // 15: S+
  "mm1,Cut Man,3,3,3,5,5,4",      // 14: S
  "mm1,Ice Man,1,1,1,4,4,4",      // 12: A, whatever its color scores
  "mm1,Bomb Man,3,3,3,5,1,4",     // 10: B
  "mm3,Top Man,5,5,5,3,3,3",      // 9: C, whatever its color scores
  "mmii,Top Man,3,3,3,3,2,3",     // 8: C, a same-named track in another game
  "mm1,Guts Man,3,3,3,2,3,1",     // 6: D
  "mm1,Fire Man,3,3,3,1,1,1",     // 3: F
  "mm2,Air Man,3,3,3,,,",         // color scores but no ratings: not graded
].join("\n");

const openTiers = async page => {
  await page.route("**/data/scores.csv", r => r.fulfill({ contentType: "text/csv", body: CSV }));
  await page.goto("/tiers.html");
  await expect(page.locator('[data-tier="S"]')).toBeAttached();
};
const names = (page, id) => page.locator(`[data-tier="${id}"] .tl-tile .tl-name`);

// Waits for the page's player to be playing this audio file, or for it to stop (null)
const expectTilePlaying = (page, audio) => expect.poll(() => page.evaluate(async () => {
  const { player } = await import("/src/tiers.js");
  return player.paused ? null : new URL(player.src).pathname.slice(1);
}), { timeout: 5000 }).toBe(audio);

test.describe("tier list", () => {
  test("puts each track in the grade its total earns, highest total first", async ({ page }) => {
    await openTiers(page);
    await expect(names(page, "S+")).toHaveText(["Metal Man"]);
    await expect(names(page, "S")).toHaveText(["Cut Man"]);
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
    await expect(tile).toHaveAttribute("aria-label", "Play Bomb Man, Mega Man: expression 5, synergy 1, range 4, total 10");
  });

  test("lists blank and missing rows as not graded, without the ??? placeholders", async ({ page }) => {
    await openTiers(page);
    const none = names(page, "none");
    await expect(page.locator('[data-tier="none"] [aria-label^="Play Air Man, Mega Man 2:"]')).toHaveCount(1);
    await expect(none.filter({ hasText: "Twinkle Girl" })).toHaveCount(1);
    await expect(none.filter({ hasText: "???" })).toHaveCount(0);
  });

  test("marks an empty grade", async ({ page }) => {
    await page.route("**/data/scores.csv", r => r.fulfill({ contentType: "text/csv", body: "header\nmm1,Cut Man,3,3,3,5,5,5" }));
    await page.goto("/tiers.html");
    await expect(page.locator('[data-tier="F"] .tl-empty')).toHaveText("No tracks yet");
  });

  test("clicking a tile plays its track, and clicking it again stops it", async ({ page }) => {
    await openTiers(page);
    const tile = page.locator('[data-tier="D"] .tl-tile');
    await tile.click();
    await expectTilePlaying(page, "audio/gutsman.mp3");
    await expect(tile).toHaveAttribute("aria-pressed", "true");
    await tile.click();
    await expectTilePlaying(page, null);
    await expect(tile).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/tiers\.html$/);
  });

  test("clicking another tile switches to its track", async ({ page }) => {
    await openTiers(page);
    const guts = page.locator('[data-tier="D"] .tl-tile'), fire = page.locator('[data-tier="F"] .tl-tile');
    await guts.click();
    await expectTilePlaying(page, "audio/gutsman.mp3");
    await fire.click();
    await expectTilePlaying(page, "audio/fireman.mp3");
    await expect(fire).toHaveAttribute("aria-pressed", "true");
    await expect(guts).toHaveAttribute("aria-pressed", "false");
  });

  test("a tile restarts its track after stopping or finishing", async ({ page }) => {
    await openTiers(page);
    const tile = page.locator('[data-tier="D"] .tl-tile');
    await tile.click();
    await expectTilePlaying(page, "audio/gutsman.mp3");
    await page.evaluate(async () => {
      const { player } = await import("/src/tiers.js");
      player.pause();
      player.dispatchEvent(new Event("ended"));
    });
    await expect(tile).toHaveAttribute("aria-pressed", "false");
    await tile.click();
    await expectTilePlaying(page, "audio/gutsman.mp3");
    await expect(tile).toHaveAttribute("aria-pressed", "true");
  });

  test("the playing tile fills with its track color, which flickers until it stops", async ({ page }) => {
    await openTiers(page);
    const tile = page.locator('[data-tier="D"] .tl-tile'), swatch = tile.locator(".tl-swatch");
    await tile.click();
    await expectTilePlaying(page, "audio/gutsman.mp3");
    await expect(swatch).toHaveAttribute("style", /filter: brightness/);
    const [tileBox, swatchBox] = [await tile.boundingBox(), await swatch.boundingBox()];
    expect(swatchBox.height).toBeGreaterThan(tileBox.height - 4);
    await tile.click();
    await expectTilePlaying(page, null);
    await expect(swatch).not.toHaveAttribute("style", /filter/);
    expect((await swatch.boundingBox()).height).toBeLessThan(10);
  });

  test("the flicker moves with the track", async ({ page }) => {
    await openTiers(page);
    const guts = page.locator('[data-tier="D"] .tl-tile'), fire = page.locator('[data-tier="F"] .tl-tile');
    await guts.click();
    await expect(guts.locator(".tl-swatch")).toHaveAttribute("style", /filter: brightness/);
    await fire.click();
    await expect(fire.locator(".tl-swatch")).toHaveAttribute("style", /filter: brightness/);
    await expect(guts.locator(".tl-swatch")).not.toHaveAttribute("style", /filter/);
  });

  test("playing doesn't move what's on the tile", async ({ page }) => {
    await openTiers(page);
    const tile = page.locator('[data-tier="D"] .tl-tile'), name = tile.locator(".tl-name");
    await tile.scrollIntoViewIfNeeded();
    const before = await name.boundingBox();
    await tile.click();
    await expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(await name.boundingBox()).toEqual(before);
  });

  test("with reduced motion the tile still fills with color, but doesn't flicker", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await openTiers(page);
    const tile = page.locator('[data-tier="D"] .tl-tile'), swatch = tile.locator(".tl-swatch");
    await tile.click();
    await expectTilePlaying(page, "audio/gutsman.mp3");
    expect((await swatch.boundingBox()).height).toBeGreaterThan(50);
    await page.waitForTimeout(500);
    await expect(swatch).not.toHaveAttribute("style", /filter/);
    await context.close();
  });

  test("the keyboard can play and stop a tile", async ({ page }) => {
    await openTiers(page);
    const tile = page.locator('[data-tier="D"] .tl-tile');
    await tile.focus();
    await page.keyboard.press("Enter");
    await expectTilePlaying(page, "audio/gutsman.mp3");
    await page.keyboard.press("Space");
    await expectTilePlaying(page, null);
  });

  test("a track without audio isn't a button", async ({ page }) => {
    await openTiers(page);
    await expect(page.locator('[data-tier="none"] div.tl-tile').filter({ hasText: "Twinkle Girl" })).toHaveCount(1);
    await expect(page.locator('[data-tier="none"] button.tl-tile').filter({ hasText: "Twinkle Girl" })).toHaveCount(0);
  });

  test("gives S+ a white block, with its total on its own", async ({ page }) => {
    await openTiers(page);
    const letter = page.locator('[data-tier="S+"] .tl-letter');
    await expect(letter).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(letter.locator("span")).toHaveText("15");
  });

  test.describe("game filter", () => {
    const openFiltered = async (page, game) => {
      await openTiers(page);
      await page.locator("#tlGame").selectOption(game);
    };
    const visibleNames = (page, id) => page.locator(`[data-tier="${id}"] li:visible .tl-name`);

    test("starts on all games, with every track showing", async ({ page }) => {
      await openTiers(page);
      await expect(page.locator("#tlGame")).toHaveValue("");
      await expect(page.locator("#tlCount")).toHaveText(/^\d+ tracks$/);
      expect(new URL(page.url()).search).toBe("");
      const total = await page.locator("#tiers li").count();
      await expect(page.locator("#tiers li:visible")).toHaveCount(total);
    });

    test("lists every game, in release order", async ({ page }) => {
      await openTiers(page);
      const games = await page.evaluate(async () => (await import("/src/model.js")).RELEASE_ORDER.map(g => g.title));
      await expect(page.locator("#tlGame option")).toHaveText(["All games", ...games]);
    });

    test("shows only the chosen game's tracks, in their grades", async ({ page }) => {
      await openFiltered(page, "mm1");
      await expect(visibleNames(page, "S")).toHaveText(["Cut Man"]);
      await expect(visibleNames(page, "A")).toHaveText(["Ice Man"]);
      await expect(visibleNames(page, "B")).toHaveText(["Bomb Man"]);
      await expect(visibleNames(page, "D")).toHaveText(["Guts Man"]);
      await expect(visibleNames(page, "F")).toHaveText(["Fire Man"]);
      await expect(visibleNames(page, "none")).toHaveText(["Elec Man"]);
      await expect(page.locator("#tlCount")).toHaveText(/^Showing 6 of \d+ tracks$/);
    });

    test("tells a same-named track apart by its game", async ({ page }) => {
      await openFiltered(page, "mmii");
      await expect(page.locator('[data-tier="C"] li:visible [aria-label^="Play Top Man, Mega Man II:"]')).toHaveCount(1);
      await expect(page.locator('[data-tier="C"] li:visible [aria-label^="Play Top Man, Mega Man 3:"]')).toHaveCount(0);
    });

    test("marks grades the game has no tracks in, and updates their labels", async ({ page }) => {
      await openFiltered(page, "mm1");
      const row = page.locator('[data-tier="C"]');
      await expect(row.locator(".tl-empty")).toHaveText("No tracks from this game");
      await expect(row.locator(".tl-tiles")).toBeHidden();
      await expect(row).toHaveAttribute("aria-label", "Grade C: 0 tracks");
      await expect(page.locator('[data-tier="S"]')).toHaveAttribute("aria-label", "Grade S: 1 track");
    });

    test("hides Not graded when the game has nothing there", async ({ page }) => {
      await page.route("**/data/scores.csv", r => r.fulfill({ contentType: "text/csv", body: "header\nmm1,Cut Man,3,3,3,5,5,5\nmm1,Guts Man,3,3,3,5,5,5\nmm1,Ice Man,3,3,3,5,5,5\nmm1,Bomb Man,3,3,3,5,5,5\nmm1,Fire Man,3,3,3,5,5,5\nmm1,Elec Man,3,3,3,5,5,5" }));
      await page.goto("/tiers.html");
      await expect(page.locator('[data-tier="none"]')).toBeVisible();
      await page.locator("#tlGame").selectOption("mm1");
      await expect(page.locator('[data-tier="none"]')).toBeHidden();
    });

    test("going back to all games restores everything", async ({ page }) => {
      await openFiltered(page, "mm1");
      await page.locator("#tlGame").selectOption("");
      await expect(names(page, "C")).toHaveText(["Top Man", "Top Man"]);
      await expect(page.locator('[data-tier="C"] li:visible')).toHaveCount(2);
      await expect(page.locator('[data-tier="S+"] .tl-empty')).toBeHidden();
      expect(new URL(page.url()).search).toBe("");
    });

    test("the link keeps the game, and opens on it", async ({ page }) => {
      await openFiltered(page, "mm3");
      expect(new URL(page.url()).search).toBe("?game=mm3");
      await page.reload();
      await expect(page.locator("#tlGame")).toHaveValue("mm3");
      await expect(page.locator("#tlCount")).toHaveText(/^Showing 8 of /);
    });

    test("a link to a game that doesn't exist shows all games", async ({ page }) => {
      await page.goto("/tiers.html?game=nope");
      await expect(page.locator("#tlGame")).toHaveValue("");
      await expect(page.locator("#tlCount")).toHaveText(/^\d+ tracks$/);
    });

    test("a playing track carries on through a filter change", async ({ page }) => {
      await openTiers(page);
      const tile = page.locator('[data-tier="D"] .tl-tile');
      await tile.click();
      await expectTilePlaying(page, "audio/gutsman.mp3");
      await page.locator("#tlGame").selectOption("mm2");
      await expect(tile).toBeHidden();
      await expectTilePlaying(page, "audio/gutsman.mp3");
      await page.locator("#tlGame").selectOption("mm1");
      await expect(tile).toHaveAttribute("aria-pressed", "true");
      await expect(tile.locator(".tl-swatch")).toHaveAttribute("style", /filter: brightness/);
    });
  });

  test("explains the grades", async ({ page }) => {
    await openTiers(page);
    await expect(page.locator("#metrics li")).toHaveCount(3);
    await expect(page.locator("#ratings li")).toHaveCount(5);
    await expect(page.locator("#gradeKey tr").first().locator("td.n")).toHaveText("15");
    await expect(page.locator("#gradeKey tr")).toHaveCount(7);
  });

  test("links from the color deep dive, and home to the list of robot masters", async ({ page }) => {
    await open(page);
    await page.getByTestId("tiers-link").click();
    await expect(page).toHaveURL(/tiers\.html$/);
    await page.getByTestId("home-link").click();
    await expect(page.locator("#roster .rm-tile").first()).toBeVisible();
  });

  test("shares the color project's saved theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openTiers(page);
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await open(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  for (const width of [360, 1280]) {
    test(`fits every grade's letter inside its block at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await openTiers(page);
      const fits = await page.locator(".tl-letter").evaluateAll(blocks => {
        const textWidth = b => { const r = document.createRange(); r.selectNodeContents(b); return r.getBoundingClientRect().width; };
        return blocks.map(block => textWidth(block.querySelector("b")) <= block.clientWidth - 8);
      });
      expect(fits).toEqual(fits.map(() => true));
    });
  }

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
plainTest("says so when the scores file can't be loaded", async ({ page }) => {
  await page.route("**/data/scores.csv", r => r.fulfill({ status: 404, body: "" }));
  await page.goto("/tiers.html");
  await expect(page.locator("#tiers")).toContainText("Couldn't load the rankings");
});
