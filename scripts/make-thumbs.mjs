// Makes the small artwork the home page's tiles load: art/thumbs/<name>.webp for each picture in art/sources.json,
// at most 200px tall (the tiles show the art at most 100px tall, so this is sharp at 2x) and 400px wide, never
// enlarged. Uses Chrome (through Playwright) for the high-quality resize and the WebP encoding (transparency kept).
// Run with `npm run thumbs`; it skips thumbnails newer than their artwork, and `npm run thumbs -- --force` redoes all.
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { chromium } from "@playwright/test";

const MAX_H = 200, MAX_W = 400, QUALITY = 0.85;
const ROOT = new URL("../", import.meta.url);
export const thumbOf = file => "thumbs/" + file.replace(/\.\w+$/, ".webp");

const force = process.argv.includes("--force");
const sources = JSON.parse(await readFile(new URL("art/sources.json", ROOT), "utf8"));
await mkdir(new URL("art/thumbs/", ROOT), { recursive: true });
const mtime = url => stat(url).then(s => s.mtimeMs, () => 0);

const browser = await chromium.launch({ channel: "chrome" });  // the installed Chrome, as in playwright.config.js
const page = await browser.newPage();
let made = 0, kept = 0, before = 0, after = 0;
for (const { file } of sources) {
  const src = new URL("art/" + file, ROOT), out = new URL("art/" + thumbOf(file), ROOT);
  if (!force && await mtime(out) > await mtime(src)) { kept++; continue; }
  const bytes = await readFile(src);
  const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const b64 = await page.evaluate(async ({ data, type, MAX_H, MAX_W, QUALITY }) => {
    const blob = await (await fetch(`data:${type};base64,${data}`)).blob();
    const full = await createImageBitmap(blob);
    const k = Math.min(1, MAX_H / full.height, MAX_W / full.width);
    const w = Math.round(full.width * k), h = Math.round(full.height * k);
    const img = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    const c = new OffscreenCanvas(w, h);
    c.getContext("2d").drawImage(img, 0, 0);
    const webp = await c.convertToBlob({ type: "image/webp", quality: QUALITY });
    const buf = new Uint8Array(await webp.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, { data: bytes.toString("base64"), type, MAX_H, MAX_W, QUALITY });
  const thumb = Buffer.from(b64, "base64");
  await writeFile(out, thumb);
  made++; before += bytes.length; after += thumb.length;
}
await browser.close();
const kb = n => Math.round(n / 1024) + " KB";
console.log(`${made} made (${kb(before)} → ${kb(after)}), ${kept} already up to date`);
