// The shuffle button beside Play on the robot master profile: with it on, a theme that ends opens and plays one of
// its color neighbors
import { test, expect } from "./fixtures.js";

const player = page => page.locator("#player");
const playerKey = page => player(page).evaluate(p => p.dataset.key);
const isPlaying = page => player(page).evaluate(p => !p.paused);
const endTheme = page => player(page).evaluate(p => p.dispatchEvent(new Event("ended")));
const neighborKeys = page => page.locator("#rmNearHead ~ .rm-tiles a")
  .evaluateAll(as => as.map(a => decodeURIComponent(a.hash.slice(1))));

test("with shuffle on, the end of the theme plays a color neighbor", async ({ page }) => {
  await page.goto("/robot-master.html#mm5.3");
  const shuffle = page.getByTestId("rm-shuffle");
  await expect(shuffle).toHaveAttribute("aria-pressed", "false");
  await shuffle.click();
  await expect(shuffle).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("rm-play").click();
  await expect.poll(() => isPlaying(page)).toBe(true);
  const near = await neighborKeys(page);
  await endTheme(page);

  // The neighbor's profile opens and plays, and shuffle stays on
  await expect.poll(() => page.evaluate(() => location.hash.slice(1))).not.toBe("mm5.3");
  const next = await page.evaluate(() => decodeURIComponent(location.hash.slice(1)));
  expect(near).toContain(next);
  await expect.poll(() => playerKey(page)).toBe(next);
  await expect.poll(() => isPlaying(page)).toBe(true);
  await expect(page.getByTestId("rm-play")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rm-shuffle")).toHaveAttribute("aria-pressed", "true");

  // And it keeps going, never straight back to the track it came from while others are left
  await endTheme(page);
  await expect.poll(() => page.evaluate(() => location.hash.slice(1))).not.toBe(next);
  expect(await page.evaluate(() => location.hash.slice(1))).not.toBe("mm5.3");
});

test("with shuffle off, the end of the theme stays put", async ({ page }) => {
  await page.goto("/robot-master.html#mm5.3");
  await page.getByTestId("rm-play").click();
  await expect.poll(() => isPlaying(page)).toBe(true);
  await endTheme(page);
  await expect(page.getByTestId("rm-play")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => location.hash.slice(1))).toBe("mm5.3");
  expect(await playerKey(page)).toBe("mm5.3");
});
