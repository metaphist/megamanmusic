// A small static server for the site, for the browser tests and local use: node tests/server.js [port]
// It answers range requests like real hosts do, which the audio player needs to seek.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = +(process.argv[2] || process.env.PORT || 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = normalize(join(ROOT, path === "/" ? "index.html" : path));
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) { res.writeHead(403).end(); return; }
  let data;
  try { data = await readFile(file); } catch { res.writeHead(404).end(); return; }
  const headers = { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range) {
    const size = data.length;
    let start = range[1] === "" ? size - +range[2] : +range[1];
    let end = range[1] === "" || range[2] === "" ? size - 1 : Math.min(+range[2], size - 1);
    if (start < 0) start = 0;
    if (start > end || start >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }).end(); return; }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    res.end(data.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": data.length });
  res.end(data);
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
