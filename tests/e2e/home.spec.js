// The home page: every robot master, linking to its profile, and the color deep dive's old links sent on to it
import { test, expect } from "./fixtures.js";
import { GAMES } from "../../data/games.js";

const TOTAL = GAMES.reduce((n, g) => n + g.tracks.length, 0);

test.describe("home page", () => {
  test("lists every robot master, grouped by game", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#roster .rm-tile")).toHaveCount(TOTAL);
    await expect(page.locator("#roster .hm-game")).toHaveCount(GAMES.length);
    await expect(page.locator("#hmCount")).toHaveText(`${TOTAL} robot masters across ${GAMES.length} games`);
  });

  test("loads the small artwork for its tiles, and the profile the full size", async ({ page }) => {
    await page.goto("/");
    const img = page.locator("#game-mm5 .rm-tile", { hasText: "Gyro Man" }).locator("img");
    await expect(img).toHaveAttribute("src", "art/thumbs/mm5-gyroman.webp");
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(i => i.complete && i.naturalHeight)).toBe(200);
    await page.goto("/robot-master.html#mm5.3");
    await expect(page.locator(".rm-hero-art img")).toHaveAttribute("src", "art/mm5-gyroman.png");
  });

  // Metal Man rather than Gyro Man, who the profile shows by default
  test("links each robot master to its profile", async ({ page }) => {
    await page.goto("/");
    const metal = page.locator("#game-mm2 .rm-tile", { hasText: "Metal Man" });
    await expect(metal).toHaveAttribute("href", "robot-master.html#mm2.0");
    await metal.click();
    await expect(page.locator(".rm-hero h1")).toHaveText("Metal Man");
  });

  test("the profile links survive a server redirect that drops the query string", async ({ page }) => {
    // Like hosts that tidy URLs: the first request for the page is redirected, and any query string is lost.
    // (The browser carries the hash across the redirect.)
    await page.route(/\/robot-master\.html(\?.*)?$/, r => {
      const to = new URL(r.request().url());
      to.search = "";
      return r.fulfill({ status: 301, headers: { Location: to.href } });
    }, { times: 1 });
    await page.goto("/");
    await page.locator("#game-mm2 .rm-tile", { hasText: "Metal Man" }).click();
    await expect(page).toHaveURL(/\/robot-master\.html#mm2\.0$/);
    await expect(page.locator(".rm-hero h1")).toHaveText("Metal Man");
  });

  test("the profile's picker, tiles and Back button move between robot masters", async ({ page }) => {
    await page.goto("/robot-master.html#mm2.0");
    await expect(page.locator(".rm-hero h1")).toHaveText("Metal Man");
    await page.getByTestId("rm-pick").fill("gyro");
    await page.getByTestId("rm-pick").press("Enter");
    await expect(page.locator(".rm-hero h1")).toHaveText("Gyro Man");
    await page.locator(".rm-tile", { hasText: "Wave Man" }).first().click();
    await expect(page.locator(".rm-hero h1")).toHaveText("Wave Man");
    await page.goBack();
    await expect(page.locator(".rm-hero h1")).toHaveText("Gyro Man");
    await expect(page.getByTestId("rm-pick")).toHaveValue("Gyro Man");
  });

  test("the profile's quick switch filters as you type and puts the name back on Escape", async ({ page }) => {
    await page.goto("/robot-master.html#mm2.0");
    const pick = page.getByTestId("rm-pick"), list = page.locator("#rmPickList");
    await expect(pick).toHaveValue("Metal Man");
    await pick.click();
    await expect(list).toBeVisible();
    await expect(list.locator("li.grp").first()).toBeVisible();
    await expect(list.locator('li[aria-selected="true"]')).toContainText("Metal Man");
    await pick.fill("mega man 5 gyr");
    await expect(list.locator("li[role=option]")).toHaveCount(1);
    await expect(list.locator("li[role=option]")).toContainText("Gyro Man");
    await pick.fill("zzzz");
    await expect(list).toContainText("No robot master matches");
    await pick.press("Escape");
    await expect(list).toBeHidden();
    await expect(pick).toHaveValue("Metal Man");
    await pick.fill("wave");
    await list.locator("li[role=option]", { hasText: "Wave Man" }).click();
    await expect(page.locator(".rm-hero h1")).toHaveText("Wave Man");
    await expect(pick).toHaveValue("Wave Man");
  });

  test("the profile draws the song structure from scores.csv and works out its range", async ({ page }) => {
    await page.goto("/robot-master.html#mm2.0");
    await page.getByTestId("rm-pick").fill("turbo");
    await page.getByTestId("rm-pick").press("Enter");
    const card = page.locator("section", { has: page.locator("#rmStructHead") });
    await expect(card.locator(".rm-sec b")).toHaveText(["i-", "a", "b", "c+"]);
    await expect(card).toContainText("3 unique sections, 1 intro (+½), 1 extension (+½), 1 tiny intro (−½): 3½, rounded down to a range of 3.");
  });

  test("the profile still opens older ?track= links", async ({ page }) => {
    await page.goto("/robot-master.html?track=mm2.0");
    await expect(page.locator(".rm-hero h1")).toHaveText("Metal Man");
  });

  test("links to the color deep dive", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("colors-link").click();
    await expect(page).toHaveURL(/colors\.html$/);
    await expect(page.locator("h1")).toHaveText("Song Color Visualizer");
    await page.getByTestId("home-link").click();
    await expect(page.locator("#roster .rm-tile").first()).toBeVisible();
  });

  test("search narrows the list", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("hm-search").fill("gyro");
    await expect(page.locator("#roster .rm-tile:visible")).toHaveCount(1);
    await expect(page.locator("#roster .hm-game:visible")).toHaveCount(1);
    await page.getByTestId("hm-search").fill("zzz");
    await expect(page.locator("#hmCount")).toHaveText("No robot masters match");
  });

  test("the game links jump without leaving the page", async ({ page }) => {
    await page.goto("/");
    await page.locator("#hmJump a", { hasText: "5" }).first().click();
    await expect(page).toHaveURL(/\/#game-mm5$/);
    await expect(page.locator("#roster .rm-tile").first()).toBeAttached();
  });

  // The deep dive itself turns the old #game/track form into a query
  for (const [link, lands] of [["?game=mm2&track=0", "?game=mm2&track=0"], ["?list=mm3.1,mm1.0", "?list=mm3.1,mm1.0"], ["#mm2/1", "?game=mm2&track=1"]]) {
    test(`sends the deep dive's old link ${link} on to it`, async ({ page }) => {
      await page.goto("/" + link);
      await expect(page).toHaveURL(new RegExp("/colors\\.html" + lands.replace(/[?.]/g, "\\$&") + "$"));
    });
  }
});
