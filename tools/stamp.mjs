/* ============================================================
   stamp.mjs: sets the asset version (?v=…) on every page.

     node tools/stamp.mjs            write the version into the pages
     node tools/stamp.mjs --check    exit 1 if the pages carry an old version

   The version is a hash of everything under assets/ plus sw.js, so it changes
   exactly when a file a browser caches changes. Browsers keep assets for two weeks
   (see vercel.json) and the service worker keeps them offline, so a page whose
   version is stale would keep running yesterday's scripts. The tests run --check.
   No dependencies.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VERSION_RE = /\?v=[0-9a-z]+/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => !d.name.startsWith("."))
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

/** the files whose contents make up the version */
export function versionedFiles() {
  return walk(path.join(ROOT, "assets")).concat([path.join(ROOT, "sw.js")]).map((f) => path.relative(ROOT, f).split(path.sep).join("/")).sort();
}

export function currentVersion() {
  const h = crypto.createHash("sha256");
  for (const f of versionedFiles()) {
    h.update(f + "\0");
    h.update(fs.readFileSync(path.join(ROOT, f)));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 12);
}

/** every page that links to assets */
export function pages() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort().concat(fs.readdirSync(path.join(ROOT, "cse214")).filter((f) => f.endsWith(".html")).map((f) => "cse214/" + f));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const v = currentVersion();
  const check = process.argv.includes("--check");
  const stale = [];
  for (const p of pages()) {
    const file = path.join(ROOT, p);
    const html = fs.readFileSync(file, "utf8");
    const next = html.replace(VERSION_RE, "?v=" + v);
    if (next === html) continue;
    stale.push(p);
    if (!check) fs.writeFileSync(file, next);
  }
  if (check) {
    if (stale.length) { console.error("Asset version is stale in " + stale.join(", ") + ". Run: node tools/stamp.mjs"); process.exit(1); }
    console.log("Asset version " + v + " is current.");
  } else {
    console.log(stale.length ? "Version " + v + " written to " + stale.length + " page(s)." : "Version " + v + " was already current.");
  }
}
