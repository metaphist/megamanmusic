import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { $, plural, esc, track, readStored, writeStored } from "../../src/util.js";

describe("plural", () => {
  test("uses the singular only for exactly one", () => {
    assert.equal(plural(1, "track"), "1 track");
    assert.equal(plural(0, "track"), "0 tracks");
    assert.equal(plural(2, "scored track"), "2 scored tracks");
  });
});

describe("esc", () => {
  test("escapes the characters that matter in HTML text and attributes", () => {
    assert.equal(esc(`<a href="x">Tom & "Jerry"</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; &quot;Jerry&quot;&lt;/a&gt;");
  });
  test("leaves plain text alone and accepts non-strings", () => {
    assert.equal(esc("Cut Man"), "Cut Man");
    assert.equal(esc(42), "42");
  });
});

describe("$", () => {
  test("looks elements up by id", () => {
    globalThis.document = { getElementById: id => ({ id }) };
    assert.deepEqual($("legend"), { id: "legend" });
    delete globalThis.document;
  });
});

describe("track (analytics)", () => {
  afterEach(() => { delete globalThis.gtag; });
  test("sends an event through gtag", () => {
    const calls = [];
    globalThis.gtag = (...args) => calls.push(args);
    track("play_track", { track_name: "Cut Man" });
    assert.deepEqual(calls, [["event", "play_track", { track_name: "Cut Man" }]]);
  });
  test("does nothing when gtag is missing or fails", () => {
    assert.doesNotThrow(() => track("play_track", {}));
    globalThis.gtag = () => { throw new Error("blocked"); };
    assert.doesNotThrow(() => track("play_track", {}));
  });
});

describe("readStored and writeStored", () => {
  let store;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = {
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v)),
    };
  });
  afterEach(() => { delete globalThis.localStorage; });

  test("round-trip JSON values", () => {
    assert.equal(writeStored("k", { a: [1, 2] }), true);
    assert.equal(store.get("k"), '{"a":[1,2]}');
    assert.deepEqual(readStored("k", null), { a: [1, 2] });
  });
  test("fall back when nothing is stored, or it isn't valid JSON", () => {
    assert.deepEqual(readStored("missing", []), []);
    store.set("bad", "{not json");
    assert.deepEqual(readStored("bad", []), []);
    store.set("null", "null");
    assert.deepEqual(readStored("null", []), []);
  });
  test("fail quietly when storage is blocked or full", () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
    };
    assert.deepEqual(readStored("k", ["fallback"]), ["fallback"]);
    assert.equal(writeStored("k", [1]), false);
  });
  test("fail quietly when there is no storage at all", () => {
    delete globalThis.localStorage;
    assert.deepEqual(readStored("k", 7), 7);
    assert.equal(writeStored("k", 7), false);
  });
});
