// Small helpers shared across the page

export const $ = id => document.getElementById(id);

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Escapes text for use in HTML
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Google Analytics event; on local copies gtag only queues into dataLayer, so nothing is sent
export const track = (name, params) => { try { gtag("event", name, params); } catch (e) { } };

// Reads and writes JSON in this browser's storage; storage can be blocked or full, so both fail quietly
export function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
}
export function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
