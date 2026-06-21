// Minimal dependency-free static server for the site/ folder.
//   npm run serve   →   http://localhost:4000
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const ROOT = "site";
const PORT = Number(process.env.PORT ?? 4000);
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    if (path === "/") path = "/index.html";
    // prevent path traversal
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, safe);
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(PORT, () => {
  console.log(`PulseAI blog → http://localhost:${PORT}`);
});
