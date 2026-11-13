// The favorite star on the robot master profile's hero card, sharing its favorites with the other pages
import { test, expect } from "./fixtures.js";

test("the hero star adds and removes the track from favorites", async ({ page }) => {
  await page.goto("/robot-master.html#mm5.3");
  const star = page.getByTestId("rm-fav");
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rmcp-favorites")))).toEqual(["mm5.3"]);
  // It stays on through a reload, and is off on another track
  await page.reload();
  await expect(page.getByTestId("rm-fav")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/robot-master.html#mm5.4");
  await expect(page.getByTestId("rm-fav")).toHaveAttribute("aria-pressed", "false");
  await page.goto("/robot-master.html#mm5.3");
  await page.getByTestId("rm-fav").click();
  await expect(page.getByTestId("rm-fav")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rmcp-favorites")))).toEqual([]);
});
