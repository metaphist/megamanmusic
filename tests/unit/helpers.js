// Shared setup for the unit tests (Node's built-in test runner)
import { readFile } from "node:fs/promises";

export const ROOT = new URL("../../", import.meta.url);

// Points fetch at the repo, the way the page's relative URLs resolve. overrides maps a URL to the text to serve
// instead, null for a 404, or an Error to throw. Call it before importing src/model.js, which fetches the scores
// as soon as it loads.
export function stubFetch(overrides = {}) {
  globalThis.fetch = async url => {
    if (url in overrides) {
      const body = overrides[url];
      if (body instanceof Error) throw body;
      return { ok: body != null, status: body == null ? 404 : 200, text: async () => body ?? "" };
    }
    try {
      const text = await readFile(new URL(url, ROOT), "utf8");
      return { ok: true, status: 200, text: async () => text };
    } catch {
      return { ok: false, status: 404, text: async () => "" };
    }
  };
}

// data/scores.csv as rows of [game, name, energy, density, gravity] (the file has no quoted cells)
export async function readScores() {
  const text = await readFile(new URL("data/scores.csv", ROOT), "utf8");
  return text.split(/\r?\n/).slice(1).filter(l => l.trim()).map(l => l.split(",").map(c => c.trim()));
}

// A minimal stand-in for the SVG DOM: enough of createElementNS, attributes and querySelectorAll(tag) for draw.js
export class FakeElement {
  constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.textContent = ""; this.style = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  insertBefore(c, ref) { const i = this.children.indexOf(ref); this.children.splice(i < 0 ? 0 : i, 0, c); c.parentNode = this; return c; }
  get firstChild() { return this.children[0] ?? null; }
  querySelectorAll(tag) {
    const found = [];
    const walk = e => e.children.forEach(c => { if (c.tagName === tag) found.push(c); walk(c); });
    walk(this);
    return found;
  }
}
export function installFakeDocument() {
  globalThis.document = { createElementNS: (ns, tag) => Object.assign(new FakeElement(tag), { namespaceURI: ns }) };
}
