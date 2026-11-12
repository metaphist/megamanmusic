// Turns the artwork marked "grayscale": true in art/sources.json gray, in place, keeping its transparency. Mega Man II's
// robot masters reuse the artwork of their Mega Man 2 and 3 versions, so theirs are gray to tell them apart. Graying a
// gray picture changes nothing, so this is safe to run again. Run `npm run thumbs` afterwards to update the thumbnails.
// Uses Chrome (through Playwright), as scripts/make-thumbs.mjs does.
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const ROOT = new URL("../", import.meta.url);
const sources = JSON.parse(await readFile(new URL("art/sources.json", ROOT), "utf8")).filter(a => a.grayscale);

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
for (const { file } of sources) {
  const url = new URL("art/" + file, ROOT);
  const b64 = await page.evaluate(async data => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob(),
      { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    const c = new OffscreenCanvas(img.width, img.height), ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height), px = d.data;
    // Rec. 709 luma: how bright each color looks
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = Math.round(.2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2]);
    ctx.putImageData(d, 0, 0);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, (await readFile(url)).toString("base64"));
  await writeFile(url, Buffer.from(b64, "base64"));
  console.log("gray:", file);
}
await browser.close();
