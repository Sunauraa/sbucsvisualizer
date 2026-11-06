/* A local copy of what Vercel serves: the static files, the headers from vercel.json on the paths each "source"
   names, and every Vercel Function in api/ (api/<name>.js at /api/<name>). The AI tutor is archived
   (archive/ai-tutor); if api/tutor.js is put back, it is served too. With opts.fake (tests/fake-supabase.mjs),
   a stand-in Supabase answers at /__supabase.
   `npm run serve:accounts` also switches accounts on against that stand-in (signing in skips Google and signs you
   in as a demo student), by filling in DSA.ACCOUNT as it serves core.js. Nothing is saved: restarting forgets it.
   `npm run serve` starts it on http://localhost:3000 for working on the site by hand. There it leaves out the
   two-week Cache-Control, so files you edit show up on reload (core.js also skips the offline copy on localhost). */
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
  const fnFile = (name) => path.join(ROOT, "api", name + ".js");
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  /* Vercel's "source" patterns, as used here: literal text plus (.*) groups */
  const rules = config.headers.map((h) => ({ re: new RegExp("^" + h.source.replace(/\.(?!\*)/g, "\\.") + "$"), headers: h.headers }));
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (o.headers !== false) rules.forEach((r) => {
      if (r.re.test(url.pathname)) r.headers.forEach((h) => { if (!(o.dev && h.key === "Cache-Control")) res.setHeader(h.key, h.value); });
    });
    if (o.fake && url.pathname.startsWith("/__supabase/")) return o.fake.handle(req, res, url.pathname.slice("/__supabase".length));
    const fn = /^\/api\/([\w-]+)$/.exec(url.pathname);
    if (fn && fs.existsSync(fnFile(fn[1]))) {
      if (fn[1] === "tutor") { if (o.key && o.key()) process.env.AI_API_KEY = o.key(); else delete process.env.AI_API_KEY; }
      return require(fnFile(fn[1]))(req, res);
    }
    const file = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    const blocked = /^\/(tests|tools|archive|abilities|notes|supabase|\.)/.test(url.pathname);
    if (blocked || !file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      const page = path.join(ROOT, "404.html");
      if (fs.existsSync(page)) { res.setHeader("content-type", MIME[".html"]); return fs.createReadStream(page).pipe(res); }
      return res.end("not found");
    }
    res.setHeader("content-type", MIME[path.extname(file)] || "application/octet-stream");
    if (o.demoAccount && url.pathname === "/assets/js/core.js") {
      const src = fs.readFileSync(file, "utf8").replace('DSA.ACCOUNT = { url: "", anonKey: "" };', "DSA.ACCOUNT = { url: location.origin + \"/__supabase\", anonKey: " + JSON.stringify(o.demoAccount.anonKey) + " };");
      return res.end(src);
    }
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
  const opts = { key: () => process.env.AI_API_KEY, dev: true };
  if (process.argv.includes("--accounts")) {
    const { fakeSupabase, ANON } = await import("./fake-supabase.mjs");
    opts.fake = fakeSupabase();
    opts.demoAccount = { anonKey: ANON };
  }
  await startServer(port, opts);
  console.log("http://localhost:" + port + (opts.fake ? "  (accounts on, with a stand-in Supabase: Sign in signs you in as a demo student)" : ""));
}
