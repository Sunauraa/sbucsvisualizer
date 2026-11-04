/* ============================================================
   Headless-browser checks for the whole site.
     cd tests && npm install && npm test              everything
     npm test -- fuzz motion                          only some suites
   Uses the Chrome already installed on this computer. Exit code 1 on any failure.
   ============================================================ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startServer, ROOT } from "./server.mjs";

const require = createRequire(import.meta.url);
const PAGES = ["arrays", "recursion", "stacks-queues", "trees", "priority-queues", "hashtables", "graphs", "sorting"];
const SHOTS = path.join(ROOT, "tests", "shots");
const only = process.argv.slice(2);
const want = (name) => !only.length || only.includes(name);

let passed = 0;
const failures = [];
const ok = (cond, label, detail) => {
  if (cond) { passed++; return true; }
  failures.push(label + (detail ? ": " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""));
  console.log("  FAIL " + label + (detail ? ": " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400) : ""));
  return false;
};

/* ---------- a local copy of what Vercel serves: see server.mjs ---------- */
let aiKey = null;
const server = await startServer(0, { key: () => aiKey });
const BASE = "http://127.0.0.1:" + server.address().port;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const openPage = async (name, opts) => {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts || {}));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("uncaught: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(BASE + "/cse214/" + name + ".html" + ((opts && opts.hash) || ""));
  await page.waitForLoadState("load");
  return { page, ctx, errors };
};

/* ---------- static: listings carry the same anchors in both languages, plus a spec ---------- */
if (want("static")) {
  console.log("static checks");
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    const issues = await page.evaluate(() => {
      const out = [];
      const tags = (src) => { const s = new Set(); (src || []).forEach((t) => { const m = /@@([\w-]+(?:,[\w-]+)*)\s*$/.exec(t); if (m) m[1].split(",").forEach((x) => s.add(x)); }); return s; };
      const seen = new Set();
      DSA._docks.forEach((d) => Object.keys(d.listings).forEach((k) => {
        if (seen.has(k)) return;
        seen.add(k);
        const L = d.listings[k];
        const langs = Object.keys(L).filter((x) => /^(pseudo|java|cpp|python|c|js)$/.test(x));
        if (langs.join() !== "pseudo,java" && langs.join() !== "java,pseudo") out.push(k + " has languages " + langs);
        const a = tags(L.pseudo), b = tags(L.java);
        const diff = [...a].filter((x) => !b.has(x)).concat([...b].filter((x) => !a.has(x)));
        if (diff.length) out.push(k + " anchors differ: " + diff);
        if (!L.spec || !L.spec.time || !L.spec.space) out.push(k + " lacks a time or space spec");
      }));
      return out;
    });
    ok(!issues.length, name + " listings", issues);
    ok(!errors.length, name + " loads cleanly", errors);
    await ctx.close();
  }
}

/* ---------- fuzz: every tab, every toolbar control, awkward input, every frame ---------- */
const reached = new Map();    /* listing → set of anchors any frame named */
if (want("fuzz")) {
  console.log("fuzzer");
  const INPUTS = ["", "-5", "2.5", "0", "999", "abc"];
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    /* a tab or a toolbar button that exists right now, found by position so re-renders are fine */
    const report = await page.evaluate(async (INPUTS) => {
      const bad = [];
      const anchors = {};
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const walk = (where) => {
        DSA._players.forEach((p) => {
          if (!p.isVisible()) return;
          p.pause();
          p.noMotion = true;
          const stride = Math.max(1, Math.floor(p.frames.length / 300));
          const visit = (f) => { if (f && f.code && f.line != null) { (anchors[f.code] = anchors[f.code] || new Set()); (Array.isArray(f.line) ? f.line : [f.line]).forEach((a) => anchors[f.code].add(String(a).replace(/\^$/, ""))); } };
          /* anchors are read from every frame, the slower DOM checks from a sample */
          p.frames.forEach((f) => { visit(f); visit(f.L); visit(f.R); });
          for (let i = 0; i < p.frames.length; i += stride) {
            p.goto(i);
            const stage = document.querySelector(".panel.main").cloneNode(true);
            stage.querySelectorAll(".code-dock, .toolbar, .learn-panel").forEach((n) => n.remove());
            const text = stage.textContent;
            const m = /\b(undefined|NaN)\b|\[object [A-Z]\w+\]/.exec(text);
            if (m) { bad.push(where + " frame " + i + " shows " + m[0]); break; }
            const f = p.frames[i];
            if (f && f.line != null && f.code && p.code && p.code.listings && p.code.listings[f.code]) {
              const L = p.code.listings[f.code];
              const tags = (src) => (src || []).flatMap((t) => { const k = /@@([\w-]+(?:,[\w-]+)*)\s*$/.exec(t); return k ? k[1].split(",") : []; });
              const lines = (Array.isArray(f.line) ? f.line : [f.line]).filter((a) => typeof a === "string").map((a) => a.replace(/\^$/, ""));
              ["pseudo", "java"].forEach((lang) => { const t = tags(L[lang]); lines.forEach((a) => { if (t.indexOf(a) < 0) bad.push(where + ": anchor " + a + " is missing from " + f.code + " in " + lang); }); });
            }
          }
          p.noMotion = false;
        });
      };
      const fields = () => Array.from(document.querySelectorAll(".panel.main .toolbar input:not([type=range]):not([type=checkbox]), #inputs input")).filter((x) => x.offsetParent);
      const pressAll = async (where) => {
        const count = () => Array.from(document.querySelectorAll(".panel.main .toolbar button, .panel.main .seg button")).filter((b) => b.offsetParent).length;
        for (let k = 0, n = count(); k < n; k++) {
          const b = Array.from(document.querySelectorAll(".panel.main .toolbar button, .panel.main .seg button")).filter((x) => x.offsetParent)[k];
          if (!b) continue;
          for (const v of INPUTS) {
            fields().forEach((f) => { f.value = v; f.dispatchEvent(new Event("input", { bubbles: true })); });
            b.click();
            await sleep(0);
            walk(where + " / " + b.textContent.trim() + " with " + JSON.stringify(v));
            /* a bad input must not poison the next round */
          }
        }
        document.querySelectorAll(".panel.main .toolbar select").forEach((s) => {
          if (!s.offsetParent) return;
          Array.from(s.options).forEach((o) => { s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); walk(where + " / select " + o.value); });
        });
      };
      const tabs = () => Array.from(document.querySelectorAll(".tabs button"));
      const nTabs = tabs().length;
      for (let t = 0; t < Math.max(1, nTabs); t++) {
        if (nTabs) tabs()[t].click();
        await sleep(0);
        await pressAll(nTabs ? tabs()[t].textContent.trim() : "page");
      }
      await sleep(600);
      const out = {};
      Object.keys(anchors).forEach((k) => (out[k] = [...anchors[k]]));
      const all = {};
      DSA._docks.forEach((d) => Object.keys(d.listings).forEach((k) => {
        const s = new Set();
        (d.listings[k].pseudo || []).forEach((t) => { const m = /@@([\w-]+(?:,[\w-]+)*)\s*$/.exec(t); if (m) m[1].split(",").forEach((a) => s.add(a)); });
        all[k] = [...s];
      }));
      return { bad: bad.slice(0, 12), anchors: out, all };
    }, INPUTS);
    ok(!report.bad.length, name + " frames", report.bad);
    ok(!errors.length, name + " has no errors while fuzzed", errors.slice(0, 5));
    Object.entries(report.all).forEach(([k, v]) => { const s = new Set(report.anchors[k] || []); reached.set(name + "/" + k, { all: v, hit: s }); });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(50);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 1, name + " fits a 390 px phone", over + " px too wide");
    await ctx.close();
    console.log("  " + name + " done");
  }
}

/* ---------- motion ---------- */
if (want("motion")) {
  console.log("motion");
  const { page, ctx, errors } = await openPage("sorting");
  const mid = await page.evaluate(async () => {
    const p = DSA._players[0];
    /* find a swap in bubble sort: a frame whose bars differ from the frame before */
    const i = p.frames.findIndex((f, j) => j && f.arr.join() !== p.frames[j - 1].arr.join());
    p.goto(i - 1);
    p.step(1);
    await new Promise((r) => requestAnimationFrame(r));
    const moving = Array.from(document.querySelectorAll(".bar")).filter((b) => b.style.transform).length;
    await new Promise((r) => setTimeout(r, 450));
    const after = Array.from(document.querySelectorAll(".bar")).filter((b) => b.style.transform).length;
    /* the slider must jump, not animate */
    p.goto(i + 10);
    const jumped = Array.from(document.querySelectorAll(".bar")).filter((b) => b.style.transform).length;
    return { i, moving, after, jumped };
  });
  ok(mid.moving === 2, "a swap slides exactly the two bars", mid);
  ok(mid.after === 0, "bars land with no transform left", mid);
  ok(mid.jumped === 0, "a jump does not animate", mid);
  ok(!errors.length, "sorting motion has no errors", errors);
  await ctx.close();

  /* AVL rotation: nodes and edges move, and everything ends where the renderer put it */
  const t = await openPage("trees");
  const rot = await t.page.evaluate(async () => {
    const tabBtn = Array.from(document.querySelectorAll(".tabs button")).find((b) => /AVL/.test(b.textContent));
    tabBtn.click();
    const p = DSA._players[0];
    const input = Array.from(document.querySelectorAll(".toolbar input")).find((x) => x.offsetParent);
    const insert = Array.from(document.querySelectorAll(".toolbar button")).find((b) => /insert/i.test(b.textContent) && b.offsetParent);
    const clear = Array.from(document.querySelectorAll(".toolbar button")).find((b) => /clear|empty/i.test(b.textContent) && b.offsetParent);
    if (clear) clear.click();
    for (const v of [10, 20, 30]) { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); insert.click(); }
    p.pause();
    /* the frame where the drawing's node positions change */
    const pos = () => Array.from(document.querySelectorAll("#tree-view svg .node-c")).map((c) => c.getAttribute("cx") + "," + c.getAttribute("cy")).join(";");
    p.noMotion = true;
    let at = -1, last = null;
    for (let i = 0; i < p.frames.length; i++) { p.goto(i); const s = pos(); if (last != null && s !== last && s.split(";").length === last.split(";").length) at = i; last = s; }
    p.noMotion = false;
    if (at < 0) return { at };
    p.goto(at - 1);
    p.step(1);
    await new Promise((r) => requestAnimationFrame(r));
    const g = Array.from(document.querySelectorAll("#tree-view svg g")).filter((x) => x.getAttribute("transform")).length;
    const lines = Array.from(document.querySelectorAll("#tree-view svg line.edge")).map((l) => l.getAttribute("x1"));
    await new Promise((r) => setTimeout(r, 450));
    const left = Array.from(document.querySelectorAll("#tree-view svg g")).filter((x) => x.getAttribute("transform")).length;
    return { at, g, left, lines: lines.length };
  });
  ok(rot.at > 0 && rot.g > 0, "an AVL rotation moves its nodes", rot);
  ok(rot.left === 0, "rotated nodes land with no transform left", rot);
  ok(!t.errors.length, "tree motion has no errors", t.errors);
  await t.ctx.close();

  const r = await openPage("sorting", { reducedMotion: "reduce" });
  const red = await r.page.evaluate(async () => {
    const p = DSA._players[0];
    const i = p.frames.findIndex((f, j) => j && f.arr.join() !== p.frames[j - 1].arr.join());
    p.goto(i - 1);
    p.step(1);
    await new Promise((res) => requestAnimationFrame(res));
    return { moved: Array.from(document.querySelectorAll(".bar")).filter((b) => b.style.transform).length, faded: Array.from(document.querySelectorAll(".bar")).filter((b) => b.style.opacity).length };
  });
  ok(red.moved === 0 && red.faded === 2, "reduced motion fades instead of moving", red);
  await r.ctx.close();
}

/* ---------- quiz ---------- */
if (want("quiz")) {
  console.log("quiz");
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    const res = await page.evaluate(async () => {
      /* find something that records a real run: try each tab's buttons until a player has frames to ask about */
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const big = () => DSA._players.find((x) => x.frames.length > 12 && x.isVisible());
      const tabs = Array.from(document.querySelectorAll(".tabs button"));
      search: for (let t = 0; t < Math.max(1, tabs.length); t++) {
        if (tabs[t]) tabs[t].click();
        await sleep(0);
        const btns = Array.from(document.querySelectorAll(".panel.main button")).filter((b) => b.offsetParent && !b.closest(".player, .code-dock, .seg") && !b.matches(".danger, [data-tool]"));
        for (const b of btns) { b.click(); await sleep(0); if (big()) break search; }
      }
      const p = big();
      if (!p) return { skipped: true, frames: 0 };
      p.pause();
      p.goto(0);
      p.showControls(true);
      const btn = Array.from(p.tools.querySelectorAll("button")).find((b) => b.textContent === "Quiz me");
      btn.click();
      let asked = 0, right = 0, guard = 0, lines = 0, steps = 0;
      const before = p.index;
      while (p.index < p.frames.length - 1 && asked < 6 && guard++ < 400) {
        const at = p.index;
        p.step(1);
        const panel = p.extra.querySelector(".quiz");
        if (panel.hidden) continue;
        asked++;
        if (p.index !== at) return { error: "a question let the step through" };
        const opts = Array.from(panel.querySelectorAll(".quiz-opt"));
        if (opts.length < 3) return { error: "too few options: " + opts.length };
        if (new Set(opts.map((o) => o.textContent.slice(1))).size !== opts.length) return { error: "duplicate options" };
        if (panel.querySelector(".quiz-opt.is-code")) lines++; else steps++;
        /* the marked answer must be what the next frame really does */
        const kind = panel.querySelector("h3").textContent;
        opts[0].click();
        const correct = panel.querySelector(".quiz-opt.right");
        if (!correct) return { error: "no correct answer revealed" };
        if (kind === "What happens next?") {
          const plain = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent.replace(/\s+/g, " ").trim(); };
          if (correct.querySelector("span").textContent !== plain(p.frames[at + 1].note)) return { error: "marked answer is not the next caption" };
        }
        panel.querySelector(".quiz-result button").click();
        if (p.index !== at + 1) return { error: "Next step did not advance" };
      }
      return { asked, lines, steps, frames: p.frames.length, moved: p.index - before };
    });
    ok(!res.skipped, name + " has a run to quiz on", res);
    if (!res.skipped) {
      ok(!res.error, name + " quiz", res);
      ok(res.asked >= 1, name + " asks at least one question", res);
    }
    ok(!errors.length, name + " quiz has no errors", errors);
    await ctx.close();
  }
}

/* ---------- shared links ---------- */
if (want("share")) {
  console.log("share");
  /* for each page: do something, copy the link, open it fresh, and expect the same picture on the same frame */
  const fingerprint = (page) => page.evaluate(() => {
    const p = DSA._players[0];
    const stage = document.querySelector(".panel.main").cloneNode(true);
    stage.querySelectorAll(".code-dock, .toolbar, .learn-panel, .player, #legend").forEach((n) => n.remove());
    return { i: p.index, n: p.frames.length, html: stage.innerHTML.replace(/\s+/g, " "), note: p.frames[p.index] && p.frames[p.index].note, lang: DSA.lang() };
  });
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    await page.evaluate(async () => {
      const tabs = Array.from(document.querySelectorAll(".tabs button"));
      if (tabs.length > 1) tabs[1].click();
      await new Promise((r) => setTimeout(r, 20));
      const buttons = () => Array.from(document.querySelectorAll(".panel.main .toolbar button")).filter((b) => b.offsetParent && !b.matches(".danger, [data-tool]"));
      /* a random structure if the page has one (proves the seed works), then an operation */
      const rnd = buttons().find((b) => /random|new array/i.test(b.textContent));
      if (rnd) rnd.click();
      await new Promise((r) => setTimeout(r, 20));
      const op = buttons().find((b) => !/random|new array|clear|load/i.test(b.textContent));
      if (op) op.click();
      await new Promise((r) => setTimeout(r, 20));
      const p = DSA._players[0];
      p.pause();
      p.noMotion = true;
      p.goto(Math.floor(p.frames.length / 2));
      p.noMotion = false;
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => DSA._players[0].pause());
    const a = await fingerprint(page);
    const link = await page.evaluate(() => DSA.share.link());
    ok(link.url && link.url.length < 12000, name + " makes a link", link);
    if (link.url) {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page2 = await ctx2.newPage();
      const errs2 = [];
      page2.on("pageerror", (e) => errs2.push(e.message));
      await page2.goto(link.url);
      await page2.waitForLoadState("load");
      await page2.waitForTimeout(900);
      const b = await fingerprint(page2);
      ok(a.i === b.i && a.n === b.n, name + " link reopens the same frame", { a: [a.i, a.n], b: [b.i, b.n] });
      ok(a.note === b.note, name + " link reopens the same caption", { a: a.note, b: b.note });
      ok(a.html === b.html, name + " link reopens the same picture");
      ok(!errs2.length, name + " link has no errors", errs2);
      await ctx2.close();
    }
    ok(!errors.length, name + " share has no errors", errors);
    await ctx.close();
  }
  /* graphs: canvas edits are not form controls */
  {
    const { page, ctx } = await openPage("graphs");
    const svg = page.locator("#gr-canvas svg");
    const box = await svg.boundingBox();
    await page.mouse.click(box.x + box.width * 0.93, box.y + box.height * 0.08);    /* add a vertex in an empty corner */
    await page.waitForTimeout(30);
    await page.click("#btn-bfs");
    await page.waitForTimeout(30);
    const before = await page.evaluate(() => { const p = DSA._players[0]; p.pause(); p.noMotion = true; p.goto(3); p.noMotion = false; return { n: document.querySelectorAll("#gr-canvas svg .node-c").length, note: p.frames[3].note, adjlist: document.querySelector("#adjlist").textContent, link: DSA.share.link() }; });
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(before.link.url);
    await page2.waitForLoadState("load");
    await page2.waitForTimeout(600);
    const after = await page2.evaluate(() => ({ n: document.querySelectorAll("#gr-canvas svg .node-c").length, note: DSA._players[0].frames[3] && DSA._players[0].frames[3].note, adjlist: document.querySelector("#adjlist").textContent }));
    ok(after.n === before.n && after.adjlist === before.adjlist && after.note === before.note, "a hand-edited graph survives a link", { before, after });
    await ctx2.close();
    await ctx.close();
  }
}

/* ---------- the Why? button: every line of every listing has something to say ---------- */
let whyStats = null;
if (want("why")) {
  console.log("why");
  let total = 0, hand = 0;
  const weak = [];
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    const res = await page.evaluate(async (name) => {
      const p = DSA._players[0];
      p.showControls(true);
      const btn = Array.from(p.tools.querySelectorAll("button")).find((b) => b.textContent === "Why?");
      btn.click();
      await new Promise((r) => setTimeout(r, 200));
      const table = (DSA.WHY && DSA.WHY[name]) || {};
      const fallback = "This line carries the operation";
      let total = 0, hand = 0;
      const weak = [], stale = [];
      const seen = new Set();
      DSA._docks.forEach((d) => Object.keys(d.listings).forEach((k) => {
        if (seen.has(k)) return;
        seen.add(k);
        const L = d.listings[k];
        ["pseudo", "java"].forEach((lang) => (L[lang] || []).forEach((t) => {
          const m = /\s*@@([\w-]+(?:,[\w-]+)*)\s*$/.exec(t);
          if (!m) return;
          m[1].split(",").forEach((a) => {
            total++;
            if (table[k] && table[k][a]) { hand++; return; }
            const text = DSA.explainLine(t.slice(0, m.index).trim(), {});
            if (!text || text.startsWith(fallback)) weak.push(k + "." + a + " (" + lang + "): " + t.slice(0, m.index).trim());
          });
        }));
      }));
      /* a saved explanation must name a real anchor of a real listing */
      Object.keys(table).forEach((k) => {
        const L = DSA._docks.map((d) => d.listings[k]).find(Boolean);
        if (!L) { stale.push("no listing " + k); return; }
        const tags = new Set(L.pseudo.concat(L.java).flatMap((t) => { const m = /@@([\w-]+(?:,[\w-]+)*)\s*$/.exec(t); return m ? m[1].split(",") : []; }));
        Object.keys(table[k]).forEach((a) => { if (!tags.has(a.replace(/\^$/, ""))) stale.push(k + "." + a); });
      });
      /* and the panel really paints it on a real frame */
      const f = p.frames.findIndex((x) => x.line != null);
      if (f >= 0) p.goto(f);
      const panelText = p.extra.querySelector(".why").textContent;
      return { total, hand, weak, stale, panelText, paintedFrame: f };
    }, name);
    total += res.total; hand += res.hand;
    weak.push(...res.weak.map((w) => name + ": " + w));
    ok(!res.stale.length, name + " saved explanations match real lines", res.stale);
    ok(res.panelText.length > 10, name + " Why? panel shows text", res.panelText);
    ok(!errors.length, name + " why has no errors", errors);
    await ctx.close();
  }
  whyStats = { total, hand };
  console.log("  " + hand + " of " + total + " anchored lines have a hand-written explanation; " + weak.length + " fall back to the generic sentence");
  if (weak.length) console.log("  generic: " + weak.slice(0, 60).join("\n           "));
}

/* ---------- Ask AI: off, on, and out of free answers ---------- */
if (want("tutor")) {
  console.log("tutor function");
  /* a stand-in for the provider */
  let upstream = "ok", lastBody = null, lastAuth = null;
  const fake = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastBody = JSON.parse(raw); lastAuth = req.headers.authorization;
      res.setHeader("content-type", "application/json");
      if (upstream === "limit") { res.statusCode = 429; return res.end("{}"); }
      if (upstream === "down") { res.statusCode = 500; return res.end("{}"); }
      res.end(JSON.stringify({ choices: [{ message: { content: "Because <b>5</b> is smaller." } }] }));
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  process.env.AI_BASE_URL = "http://127.0.0.1:" + fake.address().port + "/v1";

  const post = (body, headers) => fetch(BASE + "/api/tutor", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, headers || {}), body: typeof body === "string" ? body : JSON.stringify(body) });
  aiKey = null;
  ok((await (await fetch(BASE + "/api/tutor")).json()).enabled === false, "without a key the tutor says it is off");
  ok((await post({ question: "why?" })).status === 503, "without a key a question is refused");
  {
    const { page, ctx, errors } = await openPage("sorting");
    await page.click("#btn-run");
    await page.getByRole("button", { name: "Why?", exact: true }).click();
    await page.waitForTimeout(200);
    ok(await page.locator(".why").isVisible(), "the saved explanation shows without a key");
    ok((await page.locator(".ask-form").count()) === 0, "no question box without a key");
    ok(!errors.length, "no errors without a key", errors);
    await ctx.close();
  }

  aiKey = "secret-test-key";
  ok((await (await fetch(BASE + "/api/tutor")).json()).enabled === true, "with a key the tutor says it is on");
  const good = await post({ question: "why?", step: "s", lines: "x", saved: "y", page: "p" }, { "x-forwarded-for": "10.0.0.1" });
  const goodJson = await good.json();
  ok(good.status === 200 && /smaller/.test(goodJson.answer), "a question gets an answer", goodJson);
  ok(lastAuth === "Bearer secret-test-key", "the key goes to the provider");
  ok(!JSON.stringify(goodJson).includes("secret"), "the key never reaches the browser");
  ok(lastBody.messages[0].role === "system" && /Student's question: why\?/.test(lastBody.messages[1].content), "the question arrives as data under fixed rules");
  await post({ question: "x".repeat(5000), step: "y".repeat(5000) }, { "x-forwarded-for": "10.0.0.2" });
  ok(lastBody.messages[1].content.length < 3500, "long fields are cut before they cost tokens", lastBody.messages[1].content.length);
  ok((await post({}, { "x-forwarded-for": "10.0.0.3" })).status === 400, "an empty question is refused");
  ok((await post("not json", { "x-forwarded-for": "10.0.0.4" })).status === 400, "bad JSON is refused");
  ok((await post("{" + '"question":"' + "x".repeat(20000) + '"}', { "x-forwarded-for": "10.0.0.5" })).status === 400, "an oversized body is refused");
  ok((await post({ question: "q" }, { origin: "https://evil.example", "x-forwarded-for": "10.0.0.6" })).status === 403, "another site cannot spend the quota");
  ok((await fetch(BASE + "/api/tutor", { method: "DELETE" })).status === 405, "other methods are refused");
  {
    const statuses = [];
    for (let i = 0; i < 10; i++) statuses.push((await post({ question: "q" }, { "x-forwarded-for": "10.0.0.7" })).status);
    ok(statuses.slice(0, 8).every((s) => s === 200) && statuses.slice(8).every((s) => s === 429), "one visitor is rate limited", statuses);
  }
  upstream = "limit";
  const lim = await post({ question: "q" }, { "x-forwarded-for": "10.0.0.8" });
  const limJson = await lim.json();
  ok(lim.status === 503 && limJson.unavailable === true, "the free limit becomes a calm message", limJson);
  upstream = "down";
  ok((await post({ question: "q" }, { "x-forwarded-for": "10.0.0.9" })).status === 502, "a provider outage is handled");
  upstream = "ok";

  /* the real panel, in a real browser */
  {
    const { page, ctx, errors } = await openPage("sorting");
    await page.click("#btn-run");
    await page.getByRole("button", { name: "Why?", exact: true }).click();
    await page.waitForSelector(".ask-form");
    const saved = await page.locator(".why").innerText();
    await page.fill(".ask-form input", "why swap?");
    await page.click(".ask-form button");
    await page.waitForSelector(".ask-answer");
    const html = await page.locator(".ask-answer").innerHTML();
    ok(html.includes("&lt;b&gt;"), "an AI answer is shown as text, never as HTML", html);
    upstream = "limit";
    await page.fill(".ask-form input", "again?");
    await page.click(".ask-form button");
    await page.waitForSelector(".ask-off");
    const after = await page.locator(".why").innerText();
    ok(after.includes(saved.split("\n")[1] || "Why this step?"), "the saved explanation stays when the AI runs out");
    ok(!errors.length, "no errors in the AI panel", errors);
    await ctx.close();
    upstream = "ok";
  }
  aiKey = null;
  delete process.env.AI_BASE_URL;
  fake.close();
}

/* ---------- growth chart: the worker's counts equal the visualizer's ---------- */
if (want("growth")) {
  console.log("growth");
  const { page, ctx, errors } = await openPage("sorting");
  /* the worker's sorts run here in Node, the visualizer's in the page, on identical inputs */
  const scope = {};
  new Function("self", fs.readFileSync(path.join(ROOT, "assets/js/growth-worker.js"), "utf8") + "\nself.SORTS = SORTS; self.makeInput = makeInput;")(scope);
  const cases = [];
  let seed = 1;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  Object.keys(scope.SORTS).forEach((id) => ["random", "sorted", "reverse", "nearly", "few"].forEach((shape) => [2, 3, 5, 10, 13, 14, 30, 50].forEach((n) => {
    if (id === "twothird" && n > 14) return;
    const input = scope.makeInput(n, shape, rand);
    const b = input.slice();
    const fast = scope.SORTS[id](b);
    cases.push({ id, shape, n, input, cmp: fast.cmp, mov: fast.mov, sortedByWorker: b.join() === input.slice().sort((x, y) => x - y).join() });
  })));
  const parity = await page.evaluate((cases) => {
    const bad = [];
    cases.forEach((c) => {
      const a = c.input.slice();
      const s = { cmp: 0, mov: 0, done: new Set(), stop: () => false, snap() {} };
      DSA.sortAlgos[c.id].run(a, s);
      if (c.cmp !== s.cmp || c.mov !== s.mov) bad.push(c.id + " " + c.shape + " n=" + c.n + ": worker " + c.cmp + "/" + c.mov + ", visualizer " + s.cmp + "/" + s.mov);
      if (!c.sortedByWorker || a.join() !== c.input.slice().sort((x, y) => x - y).join()) bad.push(c.id + " " + c.shape + " n=" + c.n + " did not sort");
    });
    return { bad: bad.slice(0, 10), checked: cases.length };
  }, cases);
  ok(!parity.bad.length && parity.checked > 100, "worker counts match the visualizer on " + parity.checked + " runs", parity.bad);
  await page.locator("#growth").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => /Stopped early|Measured every/.test(document.querySelector(".growth-status").textContent), null, { timeout: 40000 });
  const g = await page.evaluate(() => ({
    status: document.querySelector(".growth-status").textContent,
    paths: document.querySelectorAll("#growth svg path").length,
    insight: document.querySelector(".growth-insight").textContent,
    table: document.querySelectorAll("#growth table tr").length,
  }));
  ok(g.paths >= 3 && g.table >= 8, "the chart drew its lines and table", g);
  const nums = Object.fromEntries(Array.from(g.insight.matchAll(/(\w[\w-]*) ×(\d+(?:\.\d+)?)/g)).map((m) => [m[1], +m[2]]));
  ok(nums.Bubble > 80 && nums.Bubble < 120, "bubble grows about ×100 per ×10", nums);
  ok(nums.Merge > 10 && nums.Merge < 20, "merge grows about ×13 per ×10", nums);
  ok(nums.Counting > 8 && nums.Counting < 12, "counting grows about ×10 per ×10", nums);
  await page.selectOption("#growth-shape", "sorted");
  await page.waitForFunction(() => /Stopped early|Measured every/.test(document.querySelector(".growth-status").textContent), null, { timeout: 40000 });
  await page.getByRole("button", { name: "Linear" }).click();
  const box = await page.locator(".growth-plot svg").boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  ok(await page.locator(".growth-tip").isVisible(), "hovering the chart shows the numbers");
  ok(!errors.length, "growth has no errors", errors);
  await ctx.close();
}

/* ---------- playground ---------- */
if (want("playground")) {
  console.log("playground");
  const { runJava } = require(path.join(ROOT, "assets/js/java-interp.js"));
  const out = (code) => { const r = runJava(code); return r.error ? "ERR:" + r.error.kind + ":" + (r.error.cls || "") + ":" + r.error.line : r.output; };
  const CASES = [
    ['int x=7/2; double y=7/2.0; System.out.println(x+" "+y);', "3 3.5\n"],
    ["int x=2147483647; x++; System.out.println(x);", "-2147483648\n"],
    ["char c='a'; c++; int k=c+1; System.out.println(c+\" \"+k+\" \"+(char)(k));", "b 99 c\n"],
    ["int n=-7; System.out.println((n/2)+\" \"+(n%3));", "-3 -1\n"],
    ["static int f(int n){if(n<=1)return 1;return n*f(n-1);} public static void main(String[] a){System.out.println(f(5));}", "120\n"],
    ["int x=3.5;", "ERR:compile::1"],
    ["int[] a=new int[2];\na[2]=1;", "ERR:runtime:ArrayIndexOutOfBoundsException:2"],
    ["int z=0; System.out.println(1/z);", "ERR:runtime:ArithmeticException:1"],
    ["static int f(int n){return f(n+1);} public static void main(String[] a){f(0);}", "ERR:runtime:StackOverflowError:1"],
    ["while(true){}", "ERR:limit::1"],
    ["class N{int v;} public class M{public static void main(String[] s){N n=null; System.out.println(n.v);}}", "ERR:runtime:NullPointerException:1"],
    ["int x = ;", "ERR:compile::1"],
    ["class T{int k;T l,r;T(int k){this.k=k;}} public class M{static T ins(T t,int k){if(t==null)return new T(k);if(k<t.k)t.l=ins(t.l,k);else t.r=ins(t.r,k);return t;} static void in(T t){if(t==null)return;in(t.l);System.out.print(t.k+\" \");in(t.r);} public static void main(String[] a){T r=null;int[] x={5,3,8,1};for(int v:x)r=ins(r,v);in(r);}}", "1 3 5 8 "],
    ["import java.util.*; Deque<Integer> d=new ArrayDeque<>(); d.push(1);d.push(2); Stack<Integer> s=new Stack<>(); s.push(1); s.push(2); System.out.println(d.pop()+\" \"+d.peek()+\" \"+s.pop()+\" \"+s.peek());", "2 1 2 1\n"],
    ["try{int[] a=new int[1];a[3]=1;}catch(ArrayIndexOutOfBoundsException e){System.out.println(e.getMessage());}finally{System.out.println(\"f\");}", "Index 3 out of bounds for length 1\nf\n"],
    ["class A{int v=1;int f(){return v;}} class B extends A{B(){super();v=2;} int f(){return super.f()*10;}} public class M{public static void main(String[] a){A x=new B();System.out.println(x.f());}}", "20\n"],
    ["outer: for(int i=0;i<3;i++){for(int j=0;j<3;j++){if(j==1)continue outer; if(i==2)break outer; System.out.print(i+\"\"+j+\" \");}}", "00 10 "],
    ["int k=2; switch(k){case 1: System.out.println(\"a\"); break; case 2: System.out.println(\"b\"); case 3: System.out.println(\"c\"); break; default: System.out.println(\"d\");}", "b\nc\n"],
    ["System.out.println(1.0/3); System.out.println(2.0); System.out.println(1e10);", "0.3333333333333333\n2.0\n1.0E10\n"],
    ['System.out.println("abc".hashCode());', "96354\n"],
    ["class Box<T>{T v;Box(T v){this.v=v;} T get(){return v;}} public class M{public static void main(String[] a){Box<Integer> c=new Box<>(4);int k=c.get()+1;System.out.println(k);}}", "5\n"],
    ["class X{public String toString(){return \"me\";}} public class M{public static void main(String[] a){System.out.println(new X());}}", "me\n"],
  ];
  CASES.forEach(([code, expected]) => ok(out(code) === expected, "java: " + code.slice(0, 60), { expected, got: out(code) }));
  /* every module: the button is there, it opens on a program for the current tab, and every program runs */
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    ok(await page.locator("#pg-open").isVisible(), name + " shows the Code playground button");
    ok(!(await page.locator("#playground").isVisible()), name + " keeps the playground closed until asked");
    ok(!(await page.evaluate(() => !!window.DSAEditor)), name + " doesn't load the editor until it opens");
    /* on the second tab, the panel should open on that tab's program */
    const tabName = await page.evaluate(() => { const t = document.querySelectorAll(".tabs button"); if (t.length > 1) { t[1].click(); return t[1].textContent.trim(); } return ""; });
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    ok(await page.locator("#playground").isVisible(), name + " opens the playground");
    /* the site scrolls smoothly, so this may take a moment */
    const inView = await page.waitForFunction(() => { const r = document.querySelector("#playground").getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * 0.5; }, null, { timeout: 2500 }).then(() => true).catch(() => false);
    ok(inView, name + " scrolls the playground into view");
    const opening = await page.evaluate((tabName) => {
      const ex = DSA.PLAYGROUND_EXAMPLES[location.pathname.split("/").pop().replace(/\.html$/, "")];
      const want = ex.find((e) => e.tabs && e.tabs.test(tabName)) || ex[0];
      return { count: ex.length, got: document.querySelector("#pg-example").selectedOptions[0].textContent, want: want.name };
    }, tabName);
    ok(opening.count >= 3, name + " has at least three starter programs", opening);
    ok(opening.got === opening.want, name + " opens on the program for its tab (" + tabName + ")", opening);
    const options = await page.locator("#pg-example option").evaluateAll((os) => os.map((o) => ({ value: o.value, text: o.textContent })));
    for (const o of options) {
      await page.selectOption("#pg-example", o.value);
      await page.click("#pg-run");
      await page.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 1 && p.frames[0].stack && !document.querySelector("#pg-run").disabled; }, null, { timeout: 8000 });
      const r = await page.evaluate(async () => {
        const p = DSA._players[DSA._players.length - 1];
        p.pause();
        p.noMotion = true;
        const bad = [];
        const stride = Math.max(1, Math.floor(p.frames.length / 120));
        for (let i = 0; i < p.frames.length; i += stride) {
          p.goto(i);
          const text = document.querySelector("#pg-view").textContent + document.querySelector("#playground [data-a=note]").textContent;
          const m = /\bundefined\b|\bNaN\b|\[object /.exec(text);
          if (m) bad.push(i + ": " + m[0]);
        }
        p.goto(p.frames.length - 1);
        p.noMotion = false;
        return { err: document.querySelector("#pg-err").textContent, out: document.querySelector("#pg-out").textContent, frames: p.frames.length, bad: bad.slice(0, 4) };
      });
      ok(!r.err, name + " / " + o.text + " runs", r);
      ok(r.out.length > 0, name + " / " + o.text + " prints", r);
      ok(!r.bad.length, name + " / " + o.text + " frames are clean", r.bad);
      /* one animated step, so the drawing survives the motion layer */
      await page.evaluate(async () => { const p = DSA._players[DSA._players.length - 1]; p.goto(Math.floor(p.frames.length / 2)); p.step(1); await new Promise((res) => setTimeout(res, 350)); });
    }
    ok(!errors.length, name + " playground has no errors", errors.slice(0, 4));
    /* the module underneath still works */
    const mainOk = await page.evaluate(() => { const p = DSA._players[0]; return p.frames.length >= 1 && !!document.querySelector(".panel.main"); });
    ok(mainOk, name + " keeps its visualizer");
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(50);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 1, name + " with the playground open fits a 390 px phone", over + " px too wide");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.click("#pg-close");
    ok(!(await page.locator("#playground").isVisible()), name + " closes the playground");
    await ctx.close();
    console.log("  " + name + " done");
  }

  /* one page in depth: errors, a student's own code, and links */
  const { page, ctx, errors } = await openPage("sorting");
  await page.click("#pg-open");
  await page.waitForSelector("#pg-run");
  const setCode = async (c) => { await page.click(".cm-content"); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.insertText(c); };
  const pgPlayer = "DSA._players[DSA._players.length - 1]";
  await setCode("int x = 3.5;");
  await page.click("#pg-run");
  await page.waitForFunction(() => /lossy/.test(document.querySelector("#pg-err").textContent), null, { timeout: 8000 });
  ok((await page.locator(".cm-err-line").count()) === 1, "a compile error marks its line");
  await setCode("int[] a = new int[1];\nSystem.out.println(\"before\");\na[5] = 1;");
  await page.click("#pg-run");
  await page.waitForFunction(() => /ArrayIndexOutOfBounds/.test(document.querySelector("#pg-err").textContent), null, { timeout: 8000 });
  const rt = await page.evaluate(`(() => { const p = ${pgPlayer}; p.pause(); p.goto(p.frames.length - 1); return { out: document.querySelector("#pg-out").textContent, note: p.frames[p.index].note, line: p.frames[p.index].line }; })()`);
  ok(rt.line === 3 && /before/.test(rt.out) && /line 3/.test(rt.note), "a runtime error stops at its line with earlier output kept", rt);
  /* student code cannot reach the page */
  await setCode("System.out.println(window);");
  await page.click("#pg-run");
  await page.waitForFunction(() => /isn't declared/.test(document.querySelector("#pg-err").textContent), null, { timeout: 8000 });
  ok(true, "student code cannot see the page");
  /* the Why? button explains a student's line honestly */
  const why = await page.evaluate(() => [
    DSA.explainLine("if (t == null) return;", {}),
    DSA.explainLine("int t = a[j];", {}),
    DSA.explainLine("for (int v : data) {", {}),
    DSA.explainLine("Node(int value) {", { kind: "call" }),
    DSA.explainLine("}", { kind: "return" }),
    DSA.explainLine("return n * factorial(n - 1);", { fn: "factorial" }),
  ]);
  ok(why[0].includes("<code>t == null</code>") && !why[0].includes(") return"), "Why? reads a one-line if correctly", why[0]);
  ok(!/trade places/.test(why[1]) && /Stores a new value in <code>t<\/code>/.test(why[1]), "Why? doesn't call a temp variable a swap", why[1]);
  ok(/for-each/.test(why[2]), "Why? recognises for-each", why[2]);
  ok(/method starts/.test(why[3]), "Why? recognises a constructor being entered", why[3]);
  ok(/finished/.test(why[4]), "Why? recognises the end of a method", why[4]);
  /* a link carries the code, reopens the panel, and lands on the same step */
  await setCode('public class Main {\n  public static void main(String[] args) {\n    int x = 41;\n    x++;\n    System.out.println("from a link " + x);\n  }\n}\n');
  await page.click("#pg-run");
  await page.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 3 && !document.querySelector("#pg-run").disabled; }, null, { timeout: 8000 });
  const link = await page.evaluate(`(() => { const p = ${pgPlayer}; p.pause(); p.goto(p.frames.length - 1); return { index: p.index, link: DSA.share.link() }; })()`);
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(link.link.url);
  await page2.waitForLoadState("load");
  await page2.waitForFunction(() => document.querySelector("#pg-out") && /from a link 42/.test(document.querySelector("#pg-out").textContent), null, { timeout: 8000 }).catch(() => {});
  ok(/from a link 42/.test(await page2.locator("#pg-out").textContent().catch(() => "")), "a link reopens the playground, with the code and the step");
  await ctx2.close();
  /* the student's code is still there after a reload */
  await page.reload();
  await page.waitForLoadState("load");
  await page.click("#pg-open");
  await page.waitForSelector("#pg-run");
  const back = await page.evaluate(() => ({ text: document.querySelector(".cm-content").textContent, picked: document.querySelector("#pg-example").selectedOptions[0].textContent }));
  ok(/from a link/.test(back.text) && back.picked === "my code", "a student's code survives a reload", back);
  ok(!errors.length, "playground depth checks have no errors", errors);
  await ctx.close();

  /* the bug the explanation audit found: every slot a tombstone used to refuse a new key */
  {
    const t = await openPage("hashtables");
    const res = await t.page.evaluate(async () => {
      Array.from(document.querySelectorAll(".tabs button")).find((b) => /Linear/.test(b.textContent)).click();
      const btn = (re) => Array.from(document.querySelectorAll(".panel.main .toolbar button")).find((b) => b.offsetParent && re.test(b.textContent));
      const clear = btn(/clear|reset/i);
      if (clear) clear.click();
      const input = Array.from(document.querySelectorAll(".panel.main .toolbar input")).find((x) => x.offsetParent);
      const p = DSA._players[0];
      const say = (v, re) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); btn(re).click(); p.pause(); };
      for (let k = 0; k < 60; k++) {
        say(k, /^put|insert/i);
        const late = p.frames.some((f) => f.line === "late");
        if (late) return { late: true, k, note: p.frames.find((f) => f.line === "late").note };
        say(k, /remove|delete/i);
      }
      return { late: false };
    });
    ok(res.late && /reuse the tombstone/.test(res.note), "a table of tombstones still accepts a new key", res);
    ok(!t.errors.length, "tombstone reuse has no errors", t.errors);
    await t.ctx.close();
  }
}

/* ---------- the real JVM: the playground must print exactly what Java prints ---------- */
if (want("jvm")) {
  console.log("playground vs javac and the JVM");
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os");
  let haveJava = true;
  try { execFileSync("javac", ["-version"], { stdio: "ignore" }); } catch (e) { haveJava = false; }
  if (!haveJava) console.log("  no javac on this computer, so this suite is skipped");
  else {
    const { runJava } = require(path.join(ROOT, "assets/js/java-interp.js"));
    /* the starter programs, plus programs aimed at the places Java's rules are easy to get wrong */
    const fake = { DSA: {} };
    new Function("window", fs.readFileSync(path.join(ROOT, "assets/js/playground-examples.js"), "utf8"))(fake);
    const programs = [];
    Object.entries(fake.DSA.PLAYGROUND_EXAMPLES).forEach(([mod, list]) => list.forEach((e) => programs.push([mod + " / " + e.name, e.code])));
    const main = (body, extra) => "import java.util.*;\n" + (extra || "") + "\npublic class Main {\n" + body + "\n}\n";
    const inMain = (body, extra, members) => main((members || "") + "\n  public static void main(String[] args) {\n" + body + "\n  }", extra);
    programs.push(["integers", inMain(`
    int a = Integer.MAX_VALUE; a++; System.out.println(a);
    System.out.println(46341 * 46341); System.out.println(-7 / 2); System.out.println(-7 % 3); System.out.println(7 % -3);
    long l = 2147483647L * 4; System.out.println(l); System.out.println(1L << 40); System.out.println(1 << 33);
    System.out.println(-16 >> 2); System.out.println(-16 >>> 28); System.out.println(5 & 3); System.out.println(5 | 3); System.out.println(5 ^ 3); System.out.println(~5);
    int i = 5; int j = i++ + ++i; System.out.println(i + " " + j); int x, y; x = y = 3; x += y *= 2; System.out.println(x + " " + y);
    byte b = 127; b++; System.out.println(b); b += 200; System.out.println(b); short s = (short) 70000; System.out.println(s);
    System.out.println((int) 3.99); System.out.println((int) -3.99); System.out.println((int) 1e20); System.out.println((long) 1e10);
    int k = 10; k /= 3; System.out.println(k); k *= 2.5; System.out.println(k); k -= 0.5; System.out.println(k);
    System.out.println(Integer.MIN_VALUE); System.out.println(Math.abs(-5)); System.out.println(Math.floorMod(-1, 8)); System.out.println(Integer.highestOneBit(37));`)]);
    programs.push(["doubles and chars", inMain(`
    System.out.println(0.1 + 0.2); System.out.println(100.0); System.out.println(1e7); System.out.println(1.0E-5); System.out.println(123456.789); System.out.println(1.0 / 0); System.out.println(0.0 / 0);
    System.out.println(7 / 2.0); System.out.println(7 / 2 * 2.0); double d = 5; System.out.println(d); float f = 1.5f; System.out.println(f); System.out.println(f * 2);
    System.out.println(Math.pow(2, 10)); System.out.println(Math.sqrt(2)); System.out.println(Math.floor(-1.5)); System.out.println(Math.ceil(1.2)); System.out.println(Math.round(2.5)); System.out.println(Math.round(-2.5)); System.out.println(Math.max(1, 2.5));
    char c = 'a'; c++; System.out.println(c); System.out.println(c + 1); System.out.println((char) (c + 1)); System.out.println('a' + 'b'); System.out.println("" + 'a' + 'b'); System.out.println((int) 'A');
    System.out.println(1 + 2 + "3" + 4 + 5); System.out.println('a' + "b"); System.out.println(true + "x"); System.out.println("n=" + null);
    System.out.println(Character.isDigit('5')); System.out.println(Character.toUpperCase('q')); System.out.printf("%.2f %d %s %5d|%-5d|%n", 3.14159, 7, "hi", 42, 42);`)]);
    programs.push(["strings", inMain(`
    String s = "hello world"; System.out.println(s.length()); System.out.println(s.charAt(4)); System.out.println(s.substring(6)); System.out.println(s.substring(0, 5)); System.out.println(s.indexOf('o')); System.out.println(s.indexOf("world")); System.out.println(s.lastIndexOf('o'));
    System.out.println(s.toUpperCase()); System.out.println(s.contains("lo w")); System.out.println(s.replace('l', 'L')); System.out.println("  x ".trim()); System.out.println("a,b,c".split(",").length); System.out.println("abc".compareTo("abd")); System.out.println("abc".equals("abc")); System.out.println("Hello".hashCode());
    StringBuilder sb = new StringBuilder(); sb.append(1).append('x').append("y").append(2.5); System.out.println(sb); sb.reverse(); System.out.println(sb.toString()); System.out.println(sb.length());
    System.out.println(String.valueOf(12) + Integer.parseInt("34")); System.out.println(Double.parseDouble("1.5") + 1); System.out.println(Integer.toString(5) + 1);`)]);
    programs.push(["collections", inMain(`
    List<Integer> l = new ArrayList<>(); l.add(3); l.add(1); l.add(2); l.add(0, 9); System.out.println(l); l.remove(1); System.out.println(l); l.set(0, 5); Collections.sort(l); System.out.println(l + " " + l.size() + " " + l.contains(2) + " " + l.indexOf(5));
    Stack<Integer> st = new Stack<>(); st.push(1); st.push(2); System.out.println(st + " " + st.peek() + " " + st.pop() + " " + st.isEmpty());
    Deque<Integer> d = new ArrayDeque<>(); d.push(1); d.push(2); d.addLast(3); System.out.println(d + " " + d.peekFirst() + " " + d.peekLast() + " " + d.pop() + " " + d.pollLast());
    Queue<String> q = new LinkedList<>(); q.add("a"); q.offer("b"); System.out.println(q.peek() + q.poll() + q.size());
    PriorityQueue<Integer> pq = new PriorityQueue<>(); pq.add(5); pq.add(1); pq.add(3); System.out.println(pq.poll() + " " + pq.peek() + " " + pq.size());
    Map<String, Integer> m = new HashMap<>(); m.put("x", 1); m.put("x", m.get("x") + 1); System.out.println(m.get("x") + " " + m.getOrDefault("y", 7) + " " + m.containsKey("y") + " " + m.size() + " " + m);
    Set<Integer> h = new HashSet<>(); h.add(1); System.out.println(h.add(1) + " " + h.add(2) + " " + h.size() + " " + h.contains(2));
    int[] a = {3, 1, 2}; Arrays.sort(a); System.out.println(Arrays.toString(a)); int[] b = Arrays.copyOf(a, 5); System.out.println(Arrays.toString(b)); int[][] g = new int[2][3]; g[1][2] = 5; System.out.println(Arrays.deepToString(g)); System.out.println(g[0].length); boolean[] f = new boolean[2]; System.out.println(Arrays.toString(f)); double[] e = new double[1]; System.out.println(e[0]); char[] cs = "hi".toCharArray(); System.out.println(cs[1]);`)]);
    programs.push(["objects", main(`
  static int count = 2;
  static int bump() { return ++count; }
  static int f(int x) { return 1; }
  static int f(double x) { return 2; }
  public static void main(String[] args) {
    A x = new B(); System.out.println(x.name() + " " + x.v + " " + x); System.out.println(bump() + " " + count + " " + Main.count); System.out.println(f(1) + " " + f(1.0));
    Box<String> b = new Box<>("s"); System.out.println(b.get()); A n = null; System.out.println(n == null); System.out.println(x instanceof B); System.out.println(((B) x).w);
    try { n.name(); } catch (NullPointerException e) { System.out.println("npe"); }
    try { int[] a = new int[1]; a[2] = 1; } catch (ArrayIndexOutOfBoundsException e) { System.out.println(e.getMessage()); } finally { System.out.println("fin"); }
    try { System.out.println(1 / (count - count)); } catch (ArithmeticException e) { System.out.println(e.getMessage()); }
    try { throw new MyErr("boom"); } catch (RuntimeException e) { System.out.println(e.getMessage()); }
    outer: for (int i = 0; i < 3; i++) { for (int j = 0; j < 3; j++) { if (j == 1) continue outer; if (i == 2) break outer; System.out.print(i + "" + j + " "); } } System.out.println();
    int k = 2; switch (k) { case 1: System.out.println("a"); break; case 2: System.out.println("b"); case 3: System.out.println("c"); break; default: System.out.println("d"); }
    String w = "two"; switch (w) { case "one": System.out.println(1); break; case "two": System.out.println(2); break; }
    int i = 0; do { i += 2; } while (i < 5); System.out.println(i > 5 ? "big" : "small");
  }`, `class A { int v = 1; String name() { return "A"; } public String toString() { return "A:" + name(); } }
class B extends A { int w; B() { super(); v = 2; w = v * 2; } String name() { return "B" + super.name(); } }
class Box<T> { T v; Box(T v) { this.v = v; } T get() { return v; } }
class MyErr extends RuntimeException { MyErr(String m) { super(m); } }`)]);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsa-jvm-"));
    for (const [label, code] of programs) {
      const sub = fs.mkdtempSync(path.join(dir, "p"));
      fs.writeFileSync(path.join(sub, "Main.java"), code);
      let real;
      try {
        execFileSync("javac", ["-nowarn", "Main.java"], { cwd: sub, stdio: "pipe" });
        real = execFileSync("java", ["-cp", ".", "Main"], { cwd: sub, stdio: "pipe" }).toString();
      } catch (e) {
        ok(false, label + " is valid Java", String(e.stderr || e.message).slice(0, 500));
        continue;
      }
      const mine = runJava(code);
      ok(!mine.error && mine.output === real, label + " prints what the JVM prints", mine.error ? mine.error : firstDiff(real, mine.output));
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("  compared " + programs.length + " programs");
  }
}
function firstDiff(a, b) {
  const A = a.split("\n"), B = b.split("\n");
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) return { line: i + 1, jvm: A[i], playground: B[i] };
  return null;
}

/* ---------- injection: text a student types, or a crafted link supplies, must never become markup ---------- */
if (want("xss")) {
  console.log("injection");
  const PAYLOADS = ['<img src=x onerror="window.__xss=1">', '"><svg onload="window.__xss=1">', "'><b class=__xss>x</b>"];
  const sweep = (page) => page.evaluate(async (PAYLOADS) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const found = new Set();
    const check = (where) => {
      DSA._players.forEach((p) => {
        p.pause();
        const n = p.frames.length, step = Math.max(1, Math.floor(n / 40));
        p.noMotion = true;
        for (let i = 0; i < n; i += step) {
          p.goto(i);
          if (document.querySelector("main img, main .__xss, main svg[onload], [onerror], [onload]")) found.add(where + " frame " + i);
        }
        p.noMotion = false;
      });
    };
    const tabs = Array.from(document.querySelectorAll(".tabs button"));
    for (let t = 0; t < Math.max(1, tabs.length); t++) {
      if (tabs[t]) tabs[t].click();
      await sleep(0);
      /* hash tables only take text once the keys switch says Strings */
      document.querySelectorAll(".panel.main .seg button").forEach((b) => { if (/string/i.test(b.textContent) && b.offsetParent) b.click(); });
      const fields = () => Array.from(document.querySelectorAll(".panel.main input:not([type=range]):not([type=checkbox])")).filter((x) => x.offsetParent);
      const buttons = () => Array.from(document.querySelectorAll(".panel.main .toolbar button, .panel.main #inputs button")).filter((x) => x.offsetParent);
      const count = buttons().length;
      for (let b = 0; b < count; b++) {
        for (const v of PAYLOADS) {
          fields().forEach((f) => { f.value = v; f.dispatchEvent(new Event("input", { bubbles: true })); f.dispatchEvent(new Event("change", { bubbles: true })); });
          const x = buttons()[b];
          if (!x) continue;
          x.click();
          await sleep(0);
          check((tabs[t] ? tabs[t].textContent.trim() : "page") + " / " + x.textContent.trim());
        }
      }
      fields().forEach((f) => { f.value = PAYLOADS[0]; f.dispatchEvent(new Event("input", { bubbles: true })); });
      await sleep(520);
      check((tabs[t] ? tabs[t].textContent.trim() : "page") + " / after typing");
    }
    return { hits: [...found].slice(0, 8), fired: !!window.__xss };
  }, PAYLOADS);
  /* with the headers off, so this proves the code is safe by itself and not just that the policy caught it */
  const bareX = await startServer(0, { headers: false });
  for (const name of PAGES) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await c.newPage();
    await page.goto("http://127.0.0.1:" + bareX.address().port + "/cse214/" + name + ".html");
    await page.waitForLoadState("load");
    const r = await sweep(page);
    ok(!r.hits.length && !r.fired, name + " keeps typed text as text", r);
    await c.close();
  }
  bareX.close();
  /* a crafted link: the page must refuse to act on anything outside its own controls */
  const { page, ctx } = await openPage("sorting");
  const crafted = await page.evaluate(() => {
    const enc = (o) => location.pathname + "#s=" + LZString.compressToEncodedURIComponent(JSON.stringify(o));
    return [
      enc({ v: 1, seed: 1, acts: [{ t: "c", q: ".fb-btn" }], players: [0] }),
      enc({ v: 1, seed: 1, acts: [{ t: "c", q: "a" }], players: [0] }),
      enc({ v: 1, seed: 1, acts: [{ t: "i", q: "#custom", v: '<img src=x onerror="window.__xss=1">' }, { t: "c", q: "#btn-load" }], players: [0] }),
      enc({ v: 1, seed: 1, acts: "nope", players: "nope", lang: '"]bad' }),
      enc({ v: 1, seed: 1, acts: [{ t: "s", q: "__proto__", v: {} }], players: [999999, -1, "x"] }),
      enc({ v: 1, seed: "x", acts: new Array(5000).fill({ t: "c", q: "#btn-new" }), players: [] }),
      "not-base64-at-all",
    ];
  });
  for (const c of crafted) {
    const x = await browser.newContext();
    const pg = await x.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push(e.message));
    const url = c.startsWith("not-") ? BASE + "/cse214/sorting.html#s=" + c : BASE + c;
    await pg.goto(url);
    await pg.waitForLoadState("load");
    await pg.waitForTimeout(350);
    const st = await pg.evaluate(() => ({ url: location.pathname, fired: !!window.__xss, working: DSA._players[0].frames.length >= 1 }));
    ok(st.url.endsWith("sorting.html") && !st.fired && st.working && !errs.length, "a crafted link does no harm: " + c.slice(-24), { st, errs });
    await x.close();
  }
  await ctx.close();
  /* a graph from a link is checked before it is used */
  {
    const { page: gp, ctx: gc } = await openPage("graphs");
    const url = await gp.evaluate(() => location.pathname + "#s=" + LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, seed: 1, acts: [{ t: "s", q: "graph", v: { pos: [{ x: "<b>", y: null }], adj: [[99, "x"]] } }], players: [0] })));
    const x = await browser.newContext();
    const pg = await x.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push(e.message));
    await pg.goto(BASE + url);
    await pg.waitForLoadState("load");
    await pg.waitForTimeout(350);
    await pg.click("#btn-bfs").catch(() => {});
    await pg.waitForTimeout(50);
    ok(!errs.length, "a malformed graph in a link causes no errors", errs);
    await x.close();
    await gc.close();
  }
}

/* ---------- accessibility: axe on every page, in the states students actually see ---------- */
if (want("a11y")) {
  console.log("accessibility");
  const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  const scan = async (page, label) => {
    const r = await page.evaluate(async (src) => {
      if (!window.axe) { const s = document.createElement("script"); s.textContent = src; document.head.appendChild(s); }
      /* the editor's own scroller is reached through its text, which already takes the keyboard */
      const res = await window.axe.run({ exclude: [[".cm-scroller"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].target.join(" "), html: v.nodes[0].html.slice(0, 90) }));
    }, axeSource);
    ok(!r.length, label + " has no accessibility violations", r);
  };
  /* axe has to inject itself, which a strict policy rightly refuses, so this suite runs without the headers */
  const bare = await startServer(0, { headers: false });
  const b = "http://127.0.0.1:" + bare.address().port;
  const open = async (p) => { const c = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const g = await c.newPage(); await g.goto(b + p); await g.waitForLoadState("load"); return { g, c }; };
  for (const p of ["/index.html", "/cse214/index.html", "/404.html"]) {
    if (!fs.existsSync(path.join(ROOT, p))) continue;
    const { g, c } = await open(p);
    await scan(g, p);
    await c.close();
  }
  for (const name of PAGES) {
    const { g, c } = await open("/cse214/" + name + ".html");
    await scan(g, name);
    /* a running visualizer with the Why? panel and the code open */
    await g.evaluate(async () => {
      const b = Array.from(document.querySelectorAll(".panel.main .toolbar button")).find((x) => x.offsetParent && !x.matches(".danger, [data-tool]"));
      if (b) b.click();
      const p = DSA._players[0];
      await new Promise((r) => setTimeout(r, 30));
      p.pause();
      p.showControls(true);
      const h = document.querySelector(".code-hide"); if (h) h.click();
      Array.from(p.tools.querySelectorAll("button")).find((x) => x.textContent === "Why?").click();
      await new Promise((r) => setTimeout(r, 200));
    });
    await scan(g, name + " with code and Why? open");
    await g.click("#pg-open");
    await g.waitForSelector("#pg-run");
    await g.click("#pg-run");
    await g.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 3 && !document.querySelector("#pg-run").disabled; });
    await g.evaluate(() => { const p = DSA._players[DSA._players.length - 1]; p.pause(); p.noMotion = true; p.goto(Math.floor(p.frames.length / 2)); });
    await scan(g, name + " with the playground open");
    await c.close();
  }
  bare.close();

  /* the keyboard, which a scanner cannot judge */
  const { page, ctx } = await openPage("sorting");
  await page.click("#btn-run");
  await page.evaluate(() => DSA._players[0].pause());
  await page.getByRole("button", { name: "Why?", exact: true }).focus();
  await page.keyboard.press("Space");
  ok(await page.locator(".why").isVisible(), "Space activates a focused button instead of playing");
  const playing = await page.evaluate(() => DSA._players[0].playing);
  ok(!playing, "Space on a button doesn't start the player");
  await page.getByRole("button", { name: "Why?", exact: true }).click();
  await page.getByRole("button", { name: "Quiz me" }).click();
  await page.evaluate(() => { const p = DSA._players[0]; p.pause(); p.goto(0); });
  await page.locator("[data-a=next]").first().click();
  await page.waitForSelector(".quiz:not([hidden])");
  await page.waitForTimeout(50);
  const quizFocus = await page.evaluate(() => { const a = document.activeElement; return !!(a && a.closest(".quiz")); });
  ok(quizFocus, "a quiz question takes the keyboard focus");
  await page.keyboard.press("1");
  ok(await page.locator(".quiz-result button").isVisible(), "a number key answers the quiz");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  const afterQuiz = await page.evaluate(() => { const a = document.activeElement; return !!(a && a.closest(".player")); });
  ok(afterQuiz, "focus returns to the player after a question");
  /* the editor must not trap the Tab key */
  await page.click("#pg-open");
  await page.waitForSelector("#pg-run");
  await page.click(".cm-content");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  const escaped = await page.evaluate(() => !document.activeElement.closest(".cm-editor"));
  ok(escaped, "Esc then Tab leaves the code editor");
  await ctx.close();
}

/* ---------- production details ---------- */
if (want("prod")) {
  console.log("production");
  const files = fs.readdirSync(path.join(ROOT, "cse214")).map((f) => "/cse214/" + f).concat(["/index.html"]);
  /* every internal link and asset exists; every page has the basics */
  for (const f of files) {
    const res = await fetch(BASE + f);
    const html = await res.text();
    ok(res.status === 200, f + " loads");
    ok(/<title>[^<]{3,}<\/title>/.test(html), f + " has a title");
    ok(/<meta name="description" content="[^"]{20,}"/.test(html), f + " has a description");
    ok(/<html lang="en"/.test(html), f + " declares its language");
    ok(/name="viewport"/.test(html), f + " has a viewport");
    ok(/<noscript>/.test(html), f + " explains itself without JavaScript");
    const refs = Array.from(html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)).map((m) => m[1]).filter((r) => !/^(https?:|mailto:|data:)/.test(r));
    for (const r of refs) {
      const u = new URL(r, BASE + f);
      const a = await fetch(u);
      ok(a.status === 200, f + " links to something real: " + r, a.status);
    }
  }
  /* CSE 373 is a notice on the home page, not somewhere to go */
  {
    const { page: home, ctx: homeCtx } = await (async () => { const c = await browser.newContext(); const g = await c.newPage(); await g.goto(BASE + "/index.html"); return { page: g, ctx: c }; })();
    const box = home.locator(".tile.soon");
    ok(/Under construction/i.test(await box.textContent()) && /CSE 373/.test(await box.textContent()), "the home page says CSE 373 is under construction");
    ok((await home.locator('a[href*="cse373"]').count()) === 0 && (await box.locator("xpath=ancestor-or-self::a").count()) === 0, "the CSE 373 box can't be clicked into");
    await homeCtx.close();
    ok((await fetch(BASE + "/cse373/index.html")).status === 404, "there is no CSE 373 page to reach by address");
  }
  /* headers */
  const h = await fetch(BASE + "/cse214/sorting.html");
  const csp = h.headers.get("content-security-policy") || "";
  ok(/default-src 'self'/.test(csp) && /script-src 'self'/.test(csp) && !/script-src[^;]*unsafe/.test(csp), "a strict content security policy is set", csp);
  ok(/frame-ancestors 'none'/.test(csp), "other sites can't frame the page");
  ok(h.headers.get("x-content-type-options") === "nosniff", "nosniff is set");
  ok(!!h.headers.get("referrer-policy"), "a referrer policy is set");
  ok(!!h.headers.get("permissions-policy"), "a permissions policy is set");
  /* nothing breaks under that policy, including workers and the lazy-loaded editor */
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    const blocked = [];
    page.on("console", (m) => { if (/Content Security Policy|violates/i.test(m.text())) blocked.push(m.text().slice(0, 200)); });
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    await page.click("#pg-run");
    await page.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 3 && !document.querySelector("#pg-run").disabled; }, null, { timeout: 8000 });
    await page.getByRole("button", { name: "Why?", exact: true }).last().click();
    await page.waitForTimeout(150);
    if (name === "sorting") {
      await page.locator("#growth").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => /Stopped early|Measured every/.test(document.querySelector(".growth-status").textContent), null, { timeout: 40000 });
    }
    ok(!blocked.length, name + " runs under the security policy", blocked);
    ok(!errors.length, name + " has no errors under the security policy", errors.slice(0, 3));
    await ctx.close();
  }
  /* the 404 page and the things that must not be public */
  const nf = await fetch(BASE + "/nope.html");
  ok(nf.status === 404 && /Page not found/i.test(await nf.text()), "a missing page gets a real 404 page");
  const ignore = fs.readFileSync(path.join(ROOT, ".vercelignore"), "utf8").split("\n");
  ["tests", "tools", ".github", "README.md"].forEach((x) => ok(ignore.includes(x), x + " is not deployed"));
  ok(fs.existsSync(path.join(ROOT, "assets/vendor/THIRD-PARTY-NOTICES.txt")) && /CodeMirror|Marijn/.test(fs.readFileSync(path.join(ROOT, "assets/vendor/THIRD-PARTY-NOTICES.txt"), "utf8")), "third-party licenses ship with the code");
  /* page weight: what a student downloads before they touch anything */
  const sizes = await (async () => {
    const { page, ctx } = await openPage("sorting");
    const r = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => /assets\//.test(e.name)).map((e) => e.name.split("/").pop().split("?")[0]));
    await ctx.close();
    return r;
  })();
  ok(!sizes.includes("editor.js") && !sizes.includes("playground-examples.js") && !sizes.includes("why-data.js"), "heavy files wait until they're needed", sizes);
  /* a playground run that gets interrupted leaves the button usable */
  {
    const { page, ctx } = await openPage("sorting");
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    await page.click(".cm-content");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("while (true) { int x = 1; }");
    await page.click("#pg-run");
    await page.click("#pg-close");
    await page.click("#pg-open");
    await page.waitForTimeout(100);
    ok(await page.locator("#pg-run").isEnabled(), "closing the panel mid-run leaves Run code usable");
    await ctx.close();
  }
  /* a slow or failing network never leaves the tutor stuck, and the playground says when it can't load */
  {
    const { page, ctx } = await openPage("sorting");
    await page.route("**/assets/vendor/editor.js*", (r) => r.abort());
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    ok((await page.locator(".pg-editor textarea").count()) === 1, "if the editor can't load, a plain text box takes over");
    await ctx.close();
    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    await p2.route("**/playground-examples.js*", (r) => r.abort());
    await p2.goto(BASE + "/cse214/sorting.html");
    await p2.click("#pg-open");
    await p2.waitForSelector("#pg-run");
    await p2.waitForTimeout(50);
    ok(await p2.locator("#pg-run").isVisible(), "if the starter programs can't load, the playground still opens");
    await c2.close();
  }
  /* a very large program must not exhaust the student's memory */
  {
    const { runJava } = require(path.join(ROOT, "assets/js/java-interp.js"));
    const big = runJava("class N { int v; N next; } public class M { public static void main(String[] a) { N h = null; for (int i = 0; i < 20000; i++) { N n = new N(); n.v = i; n.next = h; h = n; } int c = 0; for (N x = h; x != null; x = x.next) c++; System.out.println(c); } }");
    const size = JSON.stringify(big.frames).length;
    ok(!big.error && big.output === "20000\n", "a 20,000-node list still runs to the right answer", big.error);
    ok(big.truncated && size < 60e6, "its recording stays bounded", Math.round(size / 1e6) + " MB");
    const deep = runJava("static int f(int n) { int[] a = new int[50]; return n == 0 ? 0 : 1 + f(n - 1); } public static void main(String[] x) { for (int i = 0; i < 40; i++) f(500); System.out.println(\"done\"); }");
    ok(JSON.stringify(deep.frames).length < 60e6, "deep recursion in a loop stays bounded", Math.round(JSON.stringify(deep.frames).length / 1e6) + " MB");
  }
  /* playground: deep recursion that real Java would allow gets an honest message */
  {
    const { runJava } = require(path.join(ROOT, "assets/js/java-interp.js"));
    const r = runJava("static int f(int n){ if (n == 0) return 0; return 1 + f(n - 1); } public static void main(String[] a){ System.out.println(f(1000)); }");
    ok(r.error ? /playground/i.test(r.error.message) : /1000/.test(r.output), "deep recursion is either right or says the playground's limit is why", r.error);
  }
}

/* ---------- screenshots for a human to look at ---------- */
if (want("shots")) {
  console.log("screenshots");
  fs.mkdirSync(SHOTS, { recursive: true });
  const shot = async (name, setup, opts) => {
    const { page, ctx } = await openPage(opts && opts.page || name, opts && opts.ctx);
    if (setup) await setup(page);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(SHOTS, (opts && opts.as || name) + ".png"), fullPage: !!(opts && opts.full) });
    await ctx.close();
  };
  const quiz = async (page) => {
    await page.click("#btn-run");
    await page.evaluate(() => { const p = DSA._players[0]; p.pause(); p.goto(0); });
    await page.getByRole("button", { name: "Quiz me" }).click();
    await page.getByRole("button", { name: "Show code" }).first().click().catch(() => {});
    await page.evaluate(() => { const p = DSA._players[0]; for (let i = 0; i < 40 && p.extra.querySelector(".quiz").hidden; i++) p.step(1); });
  };
  await shot("sorting", quiz, { as: "quiz" });
  await shot("sorting", async (page) => { await page.click("#btn-run"); await page.evaluate(() => { const p = DSA._players[0]; p.pause(); p.goto(6); }); await page.getByRole("button", { name: "Why?", exact: true }).click(); }, { as: "why" });
  await shot("sorting", async (page) => { await page.locator("#growth").scrollIntoViewIfNeeded(); await page.waitForFunction(() => /Stopped early|Measured every/.test(document.querySelector(".growth-status").textContent), null, { timeout: 40000 }); await page.locator("#growth").scrollIntoViewIfNeeded(); }, { as: "growth" });
  const inPanel = (example, back) => async (page) => {
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    if (example) await page.selectOption("#pg-example", { label: example });
    await page.click("#pg-run");
    await page.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 5 && !document.querySelector("#pg-run").disabled; });
    await page.evaluate((back) => { const p = DSA._players[DSA._players.length - 1]; p.pause(); p.noMotion = true; p.goto(Math.max(0, p.frames.length - back)); document.querySelector("#playground").scrollIntoView(); }, back);
  };
  await shot("trees", async (page) => { await inPanel("BST: insert and search", 8)(page); }, { as: "pg-trees" });
  await shot("arrays", inPanel("singly linked list: reverse", 22), { as: "pg-phone", ctx: { viewport: { width: 390, height: 844 } }, full: true });
  await shot("hashtables", inPanel("separate chaining", 6), { as: "pg-hash" });
  await shot("graphs", inPanel("BFS: shortest distances", 6), { as: "pg-graph" });
  await shot("stacks-queues", inPanel("array stack", 5), { as: "pg-stack" });
  await shot("sorting", null, { as: "head" });
  await shot("sorting", null, { as: "head-phone", ctx: { viewport: { width: 390, height: 500 } } });
  await shot("sorting", async (page) => { await page.click("#btn-run"); await page.evaluate(() => DSA._players[0].pause()); }, { as: "sorting-phone", ctx: { viewport: { width: 390, height: 844 } } });

  /* a value caught in mid-air, with time frozen so the picture can be inspected */
  const midAir = async (name, as, setup) => {
    const { page, ctx, errors } = await openPage(name);
    await page.evaluate(setup);
    await page.waitForTimeout(40);
    await page.clock.install();
    await page.evaluate(() => { const p = DSA._players.find((x) => x.frames.length > 1 && x.isVisible()); p.pause(); p.step(1); });
    await page.clock.runFor(48);
    await page.screenshot({ path: path.join(SHOTS, as + ".png") });
    await page.clock.runFor(600);
    ok(!errors.length, as + " has no errors", errors);
    await ctx.close();
  };
  await midAir("trees", "fly-avl", async () => {
    Array.from(document.querySelectorAll(".tabs button")).find((b) => /AVL/.test(b.textContent)).click();
    const input = Array.from(document.querySelectorAll(".toolbar input")).find((x) => x.offsetParent);
    const insert = Array.from(document.querySelectorAll(".toolbar button")).find((b) => /insert/i.test(b.textContent) && b.offsetParent);
    const clear = Array.from(document.querySelectorAll(".toolbar button")).find((b) => /clear|empty/i.test(b.textContent) && b.offsetParent);
    if (clear) clear.click();
    for (const v of [50, 30, 70, 20, 40, 10]) { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); insert.click(); }
    const p = DSA._players[0];
    p.pause(); p.noMotion = true;
    const pos = () => Array.from(document.querySelectorAll("#tree-view svg .node-c")).map((c) => c.getAttribute("cx") + "," + c.getAttribute("cy")).join(";");
    let at = 1, last = null;
    for (let i = 0; i < p.frames.length; i++) { p.goto(i); const s = pos(); if (last != null && s !== last && s.split(";").length === last.split(";").length) at = i; last = s; }
    p.goto(at - 1); p.noMotion = false;
  });
  await midAir("sorting", "fly-merge", async () => {
    Array.from(document.querySelectorAll("#algo-tabs button")).find((b) => /Merge/.test(b.textContent)).click();
    const p = DSA._players[0];
    p.pause(); p.noMotion = true; p.goto(p.frames.findIndex((f) => f.line === "take" && f.rows) + 1); p.noMotion = false;
  });
  await midAir("hashtables", "fly-hash", async () => {
    const big = Array.from(document.querySelectorAll(".toolbar button")).find((b) => /put|insert/i.test(b.textContent) && b.offsetParent);
    const input = Array.from(document.querySelectorAll(".toolbar input")).find((x) => x.offsetParent);
    input.value = 23; input.dispatchEvent(new Event("input", { bubbles: true })); big.click();
    const p = DSA._players[0];
    p.pause(); p.noMotion = true; p.goto(Math.max(0, p.frames.length - 3)); p.noMotion = false;
  });
  await midAir("stacks-queues", "fly-queue", async () => {
    const tabs = Array.from(document.querySelectorAll(".tabs button"));
    const t = tabs.find((b) => /plain|array queue/i.test(b.textContent)) || tabs[1];
    t.click();
    const deq = Array.from(document.querySelectorAll(".toolbar button")).find((b) => /dequeue/i.test(b.textContent) && b.offsetParent);
    deq.click();
    const p = DSA._players[0];
    p.pause(); p.noMotion = true; p.goto(p.frames.findIndex((f) => /shift/.test(JSON.stringify(f.line))) || 0); p.noMotion = false;
  });
}

await browser.close();
server.close();
console.log("\n" + passed + " passed, " + failures.length + " failed");
if (whyStats) console.log("hand-written explanations: " + whyStats.hand + " of " + whyStats.total);
if (reached.size) {
  /* coverage is reported, not enforced: the fuzzer presses every control but does not plan scenarios */
  let tot = 0, hit = 0;
  const missing = [];
  reached.forEach((r, k) => r.all.forEach((a) => { tot++; if (r.hit.has(a)) hit++; else missing.push(k + "." + a); }));
  console.log("code lines reached by the fuzzer: " + hit + " of " + tot);
  if (missing.length) console.log("not reached: " + missing.join(", "));
}
process.exit(failures.length ? 1 : 0);
