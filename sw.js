/* ============================================================
   sw.js: keeps a copy of the site so it works offline.

   core.js registers it as sw.js?v=<asset version>, so each new version of
   the site installs a fresh copy and the old one is deleted.

     pages     network first, so a new deploy shows at once. If the network
               is gone, or slower than PAGE_WAIT_MS on lecture-hall wifi,
               the saved copy is shown instead.
     assets    anything with ?v= never changes at that address, so the
               saved copy is used without asking the network.
     /api/     never touched.

   On install it saves every page and every script a page loads up front. The
   heavy tools (editor, starter programs, Why? notes, the Java runner, the
   growth worker) are saved the first time a student opens them, so a first
   visit downloads no more than it did before. The tests check PAGES and
   ASSETS against what the pages really load.
   ============================================================ */
"use strict";

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = "dsa-" + VERSION;
const PAGE_WAIT_MS = 3500;

const PAGES = [
  "index.html",
  "cse214/index.html",
  "cse214/arrays.html",
  "cse214/recursion.html",
  "cse214/stacks-queues.html",
  "cse214/trees.html",
  "cse214/priority-queues.html",
  "cse214/hashtables.html",
  "cse214/graphs.html",
  "cse214/sorting.html",
];
const ASSETS = [
  "assets/css/style.css",
  "assets/logo.svg",
  "assets/js/core.js",
  "assets/js/account.js",
  "assets/js/motion.js",
  "assets/js/tutor.js",
  "assets/js/quiz.js",
  "assets/js/playground.js",
  "assets/js/growth.js",
  "assets/js/arrays.js",
  "assets/js/recursion.js",
  "assets/js/stacks.js",
  "assets/js/trees.js",
  "assets/js/pq.js",
  "assets/js/hashtables.js",
  "assets/js/graphs.js",
  "assets/js/sorting.js",
];

const SCOPE = new URL("./", self.location.href);
const at = (p) => new URL(p, SCOPE).href;
const versioned = (p) => at(p) + "?v=" + VERSION;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* no-cache: revalidate with the server rather than trust a page the browser kept from before */
    await cache.addAll(PAGES.map((p) => new Request(at(p), { cache: "no-cache" })).concat(ASSETS.map(versioned)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("dsa-") && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname.startsWith(SCOPE.pathname + "api/")) return;
  if (req.mode === "navigate") return e.respondWith(page(e, url));
  if (url.searchParams.has("v")) return e.respondWith(asset(e, url));
});

/* the address a page is saved under: no query or hash, and a folder means its index.html */
function pageKey(url) {
  const u = new URL(url.href);
  u.search = ""; u.hash = "";
  if (u.pathname.endsWith("/")) u.pathname += "index.html";
  return u.href;
}

async function page(e, url) {
  const cache = await caches.open(CACHE);
  const key = pageKey(url);
  const fresh = fetch(e.request).then((res) => {
    if (res.ok && res.type === "basic") e.waitUntil(cache.put(key, res.clone()));
    return res;
  });
  const saved = await cache.match(key);
  if (!saved) return fresh.catch(() => offline());
  /* a saved copy exists: give the network a moment, then fall back to it */
  let timer;
  const slow = new Promise((r) => { timer = setTimeout(() => r(saved), PAGE_WAIT_MS); });
  e.waitUntil(fresh.catch(() => {}));
  return Promise.race([fresh.catch(() => saved), slow]).finally(() => clearTimeout(timer));
}

async function asset(e, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(e.request);
  if (hit) return hit;
  const res = await fetch(e.request);
  /* keep only this version's files: an old page still open may ask for its own version */
  if (res.ok && res.type === "basic" && url.searchParams.get("v") === VERSION) e.waitUntil(cache.put(e.request, res.clone()));
  return res;
}

function offline() {
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Offline · DSA Visualizer</title><link rel="stylesheet" href="' + versioned("assets/css/style.css") + '"></head><body>' +
    '<main id="content" class="wrap" style="padding:3rem 0"><h1>You are offline</h1>' +
    "<p>This address is not saved on this device, so it needs a connection. Every course page is saved after your first visit and works without one.</p>" +
    '<p><a class="btn primary" href="' + at("index.html") + '">Go to the course list</a></p></main></body></html>';
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
}
