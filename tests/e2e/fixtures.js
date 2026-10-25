// Shared setup for the browser tests: every test fails if the page logs an error or a file it asks for is missing,
// and helpers reach into the page's own modules (the same instances the page uses) to check things like whether the
// player is playing.
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    // Failed requests are reported with their URL below, so the console's copy (which has none) is skipped.
    // The site has no favicon, which browsers ask for on their own.
    page.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
    page.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) errors.push(`${r.status()} ${r.url()}`); });
    await use(page);
    expect(errors, "errors on the page").toEqual([]);
  },
});
export { expect };

// Opens the page (with an optional query or hash) and waits until it has rendered
export async function open(page, link = "") {
  await page.goto("/" + link);
  await expect(page.locator("#rpBody .rp-row").first()).toBeAttached();
  await expect(page.locator("#legend li").first()).toBeAttached();
}

// Runs fn in the page with the page's modules: fn({ model, viz }, arg)
export function inPage(page, fn, arg) {
  return page.evaluate(async ([src, arg]) => {
    const model = await import("/src/model.js"), viz = await import("/src/viz.js");
    return new Function("return " + src)()({ model, viz }, arg);
  }, [fn.toString(), arg]);
}

export const isPlaying = page => inPage(page, ({ viz }) => !viz.player.paused);
export const selectedTrack = page => inPage(page, ({ viz }) => viz.pinned == null ? null : viz.G.tracks[viz.pinned].name);
export const currentView = page => inPage(page, ({ viz }) => viz.G.custom ? "custom" : viz.G.id);
export const query = page => new URL(page.url()).search;

// Waits for the player to start (or stop)
export const expectPlaying = (page, playing = true) => expect.poll(() => isPlaying(page), { timeout: 5000 }).toBe(playing);

// Plays the selected track to its end, as if it had finished
export const endTrack = page => page.evaluate(async () => {
  const { player } = await import("/src/viz.js");
  player.dispatchEvent(new Event("ended"));
});

export const toVisualizer = async page => {
  if (await page.locator("#viewViz").isHidden()) await page.locator("#viewBtn").click();
  await expect(page.locator("#viewViz")).toBeVisible();
};
