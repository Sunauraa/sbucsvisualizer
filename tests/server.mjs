/* A local copy of what Vercel serves: the static files, the headers from vercel.json, and the function.
   `npm run serve` starts it on http://localhost:3000 for working on the site by hand. */
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };

export function startServer(port, opts) {
  const o = opts || {};
  const handler = require(path.join(ROOT, "api", "tutor.js"));
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const headers = config.headers.flatMap((h) => h.headers);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (o.headers !== false) headers.forEach((h) => res.setHeader(h.key, h.value));
    if (url.pathname === "/api/tutor") {
      if (o.key && o.key()) process.env.AI_API_KEY = o.key(); else delete process.env.AI_API_KEY;
      return handler(req, res);
    }
    const file = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    const blocked = /^\/(tests|tools|Ultron|\.)/.test(url.pathname);
    if (blocked || !file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      const page = path.join(ROOT, "404.html");
      if (fs.existsSync(page)) { res.setHeader("content-type", MIME[".html"]); return fs.createReadStream(page).pipe(res); }
      return res.end("not found");
    }
    res.setHeader("content-type", MIME[path.extname(file)] || "application/octet-stream");
    const text = /\.(html|js|css|svg|json|txt)$/.test(file);
    if (text && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      res.setHeader("content-encoding", "gzip");
      return fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
    }
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  await startServer(port, { key: () => process.env.AI_API_KEY });
  console.log("http://localhost:" + port);
}
