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

  test("links each robot master to its profile", async ({ page }) => {
    await page.goto("/");
    const gyro = page.locator('#game-mm5 .rm-tile', { hasText: "Gyro Man" });
    await expect(gyro).toHaveAttribute("href", "robot-master.html?track=mm5.3");
    await gyro.click();
    await expect(page.locator(".rm-hero h1")).toHaveText("Gyro Man");
  });

  test("links to the color deep dive", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("colors-link").click();
    await expect(page).toHaveURL(/colors\.html$/);
    await expect(page.locator("h1")).toHaveText("Color Profile Deep Dive");
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
