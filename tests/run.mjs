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
import { currentVersion, pages as stampedPages, VERSION_RE } from "../tools/stamp.mjs";
import { fakeSupabase, ANON } from "./fake-supabase.mjs";

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
const fake = fakeSupabase();      /* a stand-in Supabase at /__supabase, for the account and keepalive suites */
const server = await startServer(0, { key: () => aiKey, fake });
const BASE = "http://127.0.0.1:" + server.address().port;

const browser = await chromium.launch({ channel: "chrome", headless: true });
/* The offline copy (sw.js) would answer requests before page.route sees them and keep files between pages, so
   every suite runs without it except "offline", which turns it on itself. */
{
  const newContext = browser.newContext.bind(browser);
  browser.newContext = (o) => newContext(Object.assign({ serviceWorkers: "block" }, o || {}));
}
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

/* boxes other than the visualizer start hidden (DSA.collapsible): open one the way a student would */
const openBox = async (page, sel) => {
  /* a box inside a hidden box (the LeetCode list inside Study notes) needs the outer one opened first */
  const outer = await page.evaluate((s) => { const out = []; let b = document.querySelector(s); while (b && (b = b.parentElement && b.parentElement.closest(".box-hidden"))) out.unshift("#" + b.id); return out; }, sel);
  for (const o of outer) if (o !== "#") await page.locator(o + " > .box-head > .box-hide").click();
  const btn = page.locator(sel + " > .box-head > .box-hide");
  if ((await btn.textContent()) === "show") await btn.click();
  await page.locator(sel).scrollIntoViewIfNeeded();
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
/* The AI tutor is archived (archive/ai-tutor). Without the function the Why? panel must still work and offer no
   question box; put api/tutor.js back and the full suite below runs again. */
const HAS_TUTOR = fs.existsSync(path.join(ROOT, "api", "tutor.js"));
if (want("tutor") && !HAS_TUTOR) {
  console.log("tutor (archived)");
  const { page, ctx, errors } = await openPage("sorting");
  await page.click("#btn-run");
  await page.getByRole("button", { name: "Why?", exact: true }).click();
  await page.waitForTimeout(300);
  ok(await page.locator(".why").isVisible(), "the saved explanation shows with the tutor archived");
  ok((await page.locator(".ask-form").count()) === 0, "no question box with the tutor archived");
  ok(!errors.length, "no errors with the tutor archived", errors);
  await ctx.close();
}
if (want("tutor") && HAS_TUTOR) {
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
  await openBox(page, "#growth");
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
  await setCode('public class Main {\n  public static void main(String[] args) {\n    int x = 41;\n    x++;\n    System.out.println("from a link " + x);\n  }\n}\n');
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

/* ---------- the page moves once, when a run starts, and never during one ---------- */
if (want("scroll")) {
  console.log("scrolling");
  const OPS = { sorting: /Run sort/, trees: /pre-order/, graphs: /BFS/, "stacks-queues": /^push$/, recursion: /^▶ Play$/ };
  const yNow = (page) => page.evaluate(() => Math.round(scrollY));
  for (const [mod, op] of Object.entries(OPS)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(BASE + "/cse214/" + mod + ".html", { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    await page.locator(".code-hide:visible").first().click();
    /* a real click at the top of the page: the code has pushed the stage below the fold */
    await page.evaluate(() => scrollTo(0, 0));
    const btn = page.locator("main button:visible").filter({ hasText: op }).first();
    const box = await btn.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
    const seen = await page.evaluate(() => {
      const s = [...document.querySelectorAll(".stage")].find((x) => x.offsetParent);
      const r = s.getBoundingClientRect();
      return r.top >= 0 && r.top < innerHeight;
    });
    ok(seen, mod + ": starting a run brings the picture on screen");
    /* now the reader looks somewhere else and the run keeps playing */
    const y0 = await page.evaluate(() => {
      const p = DSA._players.find((x) => x.isVisible());
      p.speed = 4;
      p.goto(0);
      p.play();
      scrollTo(0, scrollY + 500);
      return Math.round(scrollY);
    });
    await page.waitForTimeout(1500);
    ok((await yNow(page)) === y0, mod + ": playing never moves the page", { y0, y: await yNow(page) });
    /* a quiz question stops the run but leaves the page alone */
    const y1 = await page.evaluate(() => {
      const p = DSA._players.find((x) => x.isVisible());
      p.pause();
      [...p.tools.querySelectorAll("button")].find((b) => b.textContent === "Quiz me").click();
      scrollTo(0, 0);
      p.goto(0);
      p.play();
      return Math.round(scrollY);
    });
    await page.waitForFunction(() => { const q = document.querySelector(".learn-panel.quiz"); return q && !q.hidden; }, null, { timeout: 8000 });
    ok((await yNow(page)) === y1, mod + ": a quiz question does not move the page", { y1, y: await yNow(page) });
    await page.close();
  }

  /* the playground: a run may scroll once, as it starts; the steps after it only move the editor's own box */
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 800 }]) {
    const label = "playground at " + viewport.width + " px";
    const page = await browser.newPage({ viewport });
    await page.goto(BASE + "/cse214/trees.html", { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    await page.locator("#pg-example").selectOption({ label: "AVL tree" });
    /* the stage starts out of sight, so the run has a reason to scroll */
    await page.evaluate(() => { const s = document.querySelector(".pg-stage"); scrollTo(0, Math.max(0, s.getBoundingClientRect().top + scrollY - innerHeight - 200)); });
    const before = await yNow(page);
    await page.evaluate(() => document.querySelector("#pg-run").click());
    await page.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 1 && p.frames[0].stack && !document.querySelector("#pg-run").disabled; }, null, { timeout: 8000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 150)));
    const started = await yNow(page);
    const inSight = await page.evaluate(() => { const r = document.querySelector(".pg-stage").getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    ok(started !== before && inSight, label + ": starting a run scrolls to it once", { before, started, inSight });
    const r = await page.evaluate(async () => {
      const p = DSA._players[DSA._players.length - 1];
      p.pause();
      p.noMotion = true;
      window.scrollBy(0, 300);          /* the reader moves away, past the top of the editor */
      await new Promise((res) => setTimeout(res, 60));
      const y = scrollY, box = document.querySelector(".cm-scroller");
      let moved = 0, outside = 0;
      for (let i = 0; i < 150; i++) {
        p.step(1);
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        if (Math.abs(scrollY - y) > 0.5) moved++;
        const line = document.querySelector(".cm-run-line"), b = box.getBoundingClientRect();
        if (line) { const q = line.getBoundingClientRect(); if (q.top < b.top - 1 || q.bottom > b.bottom + 1) outside++; }
      }
      return { moved, outside, editorScrolled: box.scrollTop > 0 };
    });
    ok(r.moved === 0, label + ": stepping never moves the page", r);
    ok(r.outside === 0 && r.editorScrolled, label + ": the running line stays in sight inside the editor", r);
    await page.close();
  }
}

/* ---------- all the code: every function of a module can be read, whichever one is running ---------- */
if (want("fullcode")) {
  console.log("all the code panel");
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/cse214/trees.html", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
  const box = () => page.evaluate(() => {
    const pre = [...document.querySelectorAll(".full-code pre")].find((p) => p.offsetParent);
    return pre ? { text: pre.textContent, shaded: [...pre.querySelectorAll(".ln.on")].map((l) => l.textContent).join("\n") } : null;
  });
  ok((await box()) === null, "the box stays out of the way until the code is opened");
  await page.locator(".code-hide:visible").first().click();
  await page.locator('.tabs button:has-text("AVL")').click();
  let b1 = await box();
  ok(b1 && /rotateLeft\(x\)/.test(b1.text) && /bstDelete\(k\)/.test(b1.text) && /delete\(k\)/.test(b1.text), "the AVL tab shows every AVL function, helpers too");
  ok(/rebalance\(n\)/.test(b1.shaded) && /bstInsert/.test(b1.shaded) && !/bstDelete\(k\):/.test(b1.shaded), "the running function is the one shaded");
  ok(b1.text.split("rebalance(n):").length === 2, "a helper two listings share appears once");
  ok(!/@@/.test(b1.text), "no line markers leak into the code");
  const pick = page.locator(".cls-pick:visible").first();
  await pick.selectOption({ label: "class BTree" });
  ok(/fuseWithSibling\(\)/.test((await box()).text), "another structure can be picked");
  await page.locator('.lang-switch button[data-lang="java"]:visible').first().click();
  const b2 = await box();
  ok(/^import java\.util\.\*;/.test(b2.text) && /public class BTree \{/.test(b2.text) && /}\s*$/.test(b2.text), "Java shows a whole class");
  await pick.selectOption({ label: "class BinarySearchTree" });
  const b3 = await box();
  ok(/\/\/ delete\(k\) · BST, successor/.test(b3.text) && /\/\/ delete\(k\) · BST, predecessor/.test(b3.text), "two versions of a method are both shown, each named");
  await page.locator(".cls-toggle:visible").first().click();
  ok((await box()) === null, "it can be hidden");
  await page.locator(".cls-toggle:visible").first().click();
  ok((await box()) !== null, "and shown again");
  await page.close();
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
    await fullCodeSuite(execFileSync, os);
  }
}
/* "All the code" must be real: javac finds any function that is called but not shown, and the
   structures whose helpers no animation runs are then exercised against java.util. */
async function fullCodeSuite(execFileSync, os) {
  console.log("all the code: javac and behaviour");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsa-full-"));
  const sigOf = (c) => {
    const t = (c.lines.find((l) => l.includes("(")) || "").replace(/\/\/.*$/, "");
    const m = /(\w+)\s*\(([^)]*)\)/.exec(t);
    return m ? m[1] + "(" + m[2].split(",").map((x) => x.trim().split(/\s+/)[0]).join(",") + ")" : c.lines[0];
  };
  const drivers = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "full-code-drivers.json"), "utf8"));
  let compiled = 0, ran = 0;
  for (const mod of ["arrays", "stacks-queues", "trees", "hashtables", "priority-queues", "graphs", "sorting", "recursion"]) {
    const page = await browser.newPage();
    await page.goto(BASE + "/cse214/" + mod + ".html", { waitUntil: "load" });
    await page.waitForFunction(() => window.DSA && DSA._docks && DSA._docks.length > 0);
    const groups = await page.evaluate(() => {
      const d = DSA._docks[0];
      return d.groups.map((g, i) => ({ i, name: g.name, label: g.title || g.name, isClass: !!g.java, chunks: DSA.fullChunks(g, d.listings, "java") }));
    });
    const orphans = await page.evaluate(() => {
      const d = DSA._docks[0];
      const inGroup = (g, k) => { const l = g.methods || g.keys; return l instanceof RegExp ? l.test(k) : (l || []).includes(k); };
      return Object.keys(d.listings).filter((k) => !d.groups.some((g) => inGroup(g, k)));
    });
    ok(orphans.length === 0, mod + ": every function is in the full code", orphans);
    for (const g of groups) {
      /* two versions of one method can't share a class, so compile one class per version */
      const bySig = {};
      g.chunks.forEach((c) => (bySig[sigOf(c)] = bySig[sigOf(c)] || []).push(c));
      const versions = Math.max(1, ...Object.values(bySig).map((a) => a.length));
      for (let v = 0; v < versions; v++) {
        const keep = g.chunks.filter((c) => { const a = bySig[sigOf(c)]; return a[v % a.length] === c; });
        const src = await page.evaluate(([i, keep]) => { const d = DSA._docks[0]; return DSA.fullSource(d.groups[i], d.listings, "java", keep); }, [g.i, keep]);
        let text = src.map((l) => l.replace(/\s*@@[\w,-]+\s*$/, "")).join("\n").replace(/^import java\.util\.\*;\n/, "");
        const driver = drivers[mod + "/" + g.label];
        const main = driver ? "  public static void main(String[] args) {\n" + driver.join("\n") + "\n  }\n" : "";
        if (g.isClass) text = text.replace(/\}\s*$/, main + "}\n");
        else text = "public class " + g.name + " {\n" + text + "\n" + main + "}\n";
        text = "import java.util.*;\n" + text;
        const sub = fs.mkdtempSync(path.join(dir, "g"));
        fs.writeFileSync(path.join(sub, g.name + ".java"), text);
        const label = mod + " / " + g.label + (versions > 1 ? " (version " + (v + 1) + ")" : "");
        try {
          execFileSync("javac", ["-nowarn", "-Xlint:none", g.name + ".java"], { cwd: sub, stdio: "pipe" });
          compiled++;
          ok(true, label + " compiles");
        } catch (e) {
          ok(false, label + " compiles", String(e.stderr || e.message).split("\n").filter((l) => /error:|symbol:/.test(l)).slice(0, 8).join(" | "));
          continue;
        }
        if (!driver) continue;
        try {
          const out = execFileSync("java", ["-ea", "-cp", ".", g.name], { cwd: sub, stdio: "pipe", timeout: 30000 }).toString();
          ran++;
          ok(/^ok\b/m.test(out), label + " behaves correctly", out.slice(0, 200));
        } catch (e) {
          ok(false, label + " behaves correctly", String(e.stderr || e.message).slice(0, 400));
        }
      }
    }
    await page.close();
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("  compiled " + compiled + " classes, ran " + ran);
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
  for (const p of ["/index.html", "/cse214/index.html", "/404.html", "/privacy.html", "/terms.html"]) {
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
  /* the privacy policy and terms: real pages, linked from every page's footer (Google's sign-in checks this) */
  for (const f of ["/privacy.html", "/terms.html"]) {
    const res = await fetch(BASE + f);
    const html = await res.text();
    ok(res.status === 200 && /<title>[^<]{3,}<\/title>/.test(html) && /<meta name="description" content="[^"]{20,}"/.test(html) && /<html lang="en"/.test(html), f + " is a complete page");
    ok(/Last updated: /.test(html), f + " says when it was last updated");
    for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:)/.test(m[1])) continue;
      ok((await fetch(new URL(m[1], BASE + f))).status === 200, f + " links to something real: " + m[1]);
    }
  }
  for (const f of files) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    ok(/href="(\.\.\/)?privacy\.html"/.test(html) && /href="(\.\.\/)?terms\.html"/.test(html), f + " links to the privacy policy and terms");
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
  /* caching: assets are kept for two weeks at their versioned address, pages and sw.js are always checked */
  const VER = currentVersion();
  ok(!/immutable|max-age=[1-9]/.test(h.headers.get("cache-control") || ""), "pages are not cached long", h.headers.get("cache-control"));
  ok(/max-age=1209600/.test((await fetch(BASE + "/assets/js/core.js?v=" + VER)).headers.get("cache-control") || "") , "assets are cached for two weeks");
  ok((await fetch(BASE + "/sw.js")).headers.get("cache-control") === "no-cache", "sw.js is always checked for updates");
  {
    const stale = stampedPages().filter((p) => {
      const vs = fs.readFileSync(path.join(ROOT, p), "utf8").match(VERSION_RE) || [];
      return !vs.length || vs.some((v) => v !== "?v=" + VER);
    });
    ok(!stale.length, "every page carries the current asset version (run: node tools/stamp.mjs)", stale);
  }
  /* every asset a page asks for, now or later, carries that version, or a browser would keep an old copy for two weeks */
  const unversioned = new Set();
  const watchAssets = (page) => {
    const see = (u) => { if (/\/assets\//.test(u) && !u.includes("?v=" + VER)) unversioned.add(u.replace(BASE, "")); };
    page.on("request", (r) => see(r.url()));
    page.on("worker", (w) => see(w.url()));
  };
  /* sw.js saves what the pages load up front: its lists must match them */
  {
    const src = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    const list = (name) => JSON.parse(new RegExp("const " + name + " = (\\[[^\\]]*\\]);").exec(src)[1].replace(/,\s*\]/, "]"));
    const swPages = list("PAGES"), swAssets = list("ASSETS");
    const sitePages = files.map((f) => f.slice(1)).sort();
    ok(JSON.stringify(swPages.slice().sort()) === JSON.stringify(sitePages), "sw.js saves every page", { sw: swPages, site: sitePages });
    const loaded = new Set();
    for (const f of files) {
      const html = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of html.matchAll(/(?:href|src)="([^"]*assets\/[^"?]+)\?v=/g)) loaded.add(new URL(m[1], "http://x" + f).pathname.slice(1));
    }
    ok(JSON.stringify(swAssets.slice().sort()) === JSON.stringify([...loaded].sort()), "sw.js saves every asset the pages load up front", { sw: swAssets, pages: [...loaded] });
  }
  /* nothing breaks under that policy, including workers and the lazy-loaded editor */
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    const blocked = [];
    page.on("console", (m) => { if (/Content Security Policy|violates/i.test(m.text())) blocked.push(m.text().slice(0, 200)); });
    watchAssets(page);
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    await page.click("#pg-run");
    await page.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 3 && !document.querySelector("#pg-run").disabled; }, null, { timeout: 8000 });
    await page.getByRole("button", { name: "Why?", exact: true }).last().click();
    await page.waitForTimeout(150);
    if (name === "sorting") {
      await openBox(page, "#growth");
      await page.waitForFunction(() => /Stopped early|Measured every/.test(document.querySelector(".growth-status").textContent), null, { timeout: 40000 });
    }
    ok(!blocked.length, name + " runs under the security policy", blocked);
    ok(!unversioned.size, name + ": every asset it loads carries the version", [...unversioned]);
    ok(!errors.length, name + " has no errors under the security policy", errors.slice(0, 3));
    await ctx.close();
  }
  /* the 404 page and the things that must not be public */
  const nf = await fetch(BASE + "/nope.html");
  ok(nf.status === 404 && /Page not found/i.test(await nf.text()), "a missing page gets a real 404 page");
  const ignore = fs.readFileSync(path.join(ROOT, ".vercelignore"), "utf8").split("\n");
  ["tests", "tools", ".github", "README.md", "archive", "abilities", "notes", "supabase"].forEach((x) => ok(ignore.includes(x), x + " is not deployed"));
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

/* ---------- boxes: every box but the visualizer starts hidden, opens on request, and is remembered ---------- */
if (want("boxes")) {
  console.log("hide / show boxes");
  const BOXES = "main > .panel, main > .about, .about-body .panel";
  for (const name of PAGES) {
    const { page, ctx, errors } = await openPage(name);
    const info = () => page.evaluate((sel) => DSA.$$(sel).filter((b) => getComputedStyle(b).display !== "none").map((b) => ({
      key: b.dataset.box, main: b.classList.contains("main") || b.classList.contains("playground"),
      btn: !!b.querySelector(":scope > .box-head > .box-hide"), hidden: b.classList.contains("box-hidden"),
    })), BOXES);
    const boxes = await info();
    ok(boxes.filter((b) => b.main).every((b) => !b.btn && !b.hidden), name + ": the visualizer has no button and is never hidden");
    const others = boxes.filter((b) => !b.main);
    ok(others.length >= 3 && others.every((b) => b.btn), name + ": every other box has a button", others);
    ok(others.every((b) => b.hidden), name + ": every other box starts hidden", others);
    ok(new Set(others.map((b) => b.key)).size === others.length, name + ": each box has its own key", others.map((b) => b.key));
    /* boxes inside a hidden box are hidden twice over, so only the outermost ones show a heading */
    const heads = await page.evaluate(() => DSA.$$(".box-hidden").filter((b) => !b.parentElement.closest(".box-hidden")).map((b) => ({ head: !!b.querySelector(":scope > .box-head").offsetParent, label: b.querySelector(".box-hide").getAttribute("aria-label"), exp: b.querySelector(".box-hide").getAttribute("aria-expanded") })));
    ok(heads.every((h) => h.head && /^Show \S/.test(h.label) && h.exp === "false"), name + ": a hidden box shows its heading and a button saying what it opens", heads);
    /* open them all, outer boxes first (a box inside a hidden one can't be clicked) */
    const n = await page.locator(".box-hide").count();
    for (let i = 0; i < n; i++) { const b = page.locator(".box-hide").nth(i); if ((await b.textContent()) === "show") await b.click(); }
    const opened = await page.evaluate((sel) => DSA.$$(sel).filter((b) => b.dataset.box && getComputedStyle(b).display !== "none").map((b) => ({
      key: b.dataset.box, hidden: b.classList.contains("box-hidden"),
      body: Array.from(b.children).filter((c) => !c.classList.contains("box-head")).some((c) => c.offsetParent),
    })), BOXES);
    ok(opened.every((b) => !b.hidden && b.body), name + ": show opens every box", opened);
    await page.reload();
    await page.waitForLoadState("load");
    ok((await info()).filter((b) => !b.main).every((b) => !b.hidden), name + ": opened boxes stay open after a reload");
    /* a tab change redraws the practice list: it keeps one button and its state */
    const tabs = page.locator(".tabs button");
    if (await tabs.count() > 1) {
      await tabs.nth(1).click();
      const pr = await page.evaluate(() => { const m = document.getElementById("practice"); return m ? { btn: m.querySelectorAll(".box-hide").length, hidden: m.classList.contains("box-hidden") } : null; });
      ok(!pr || (pr.btn === 1 && !pr.hidden), name + ": the practice list keeps one button and stays open on a tab change", pr);
    }
    /* hide them all again, inner boxes first */
    for (let i = n - 1; i >= 0; i--) { const b = page.locator(".box-hide").nth(i); if ((await b.textContent()) === "hide") await b.click(); }
    await page.reload();
    await page.waitForLoadState("load");
    ok((await info()).filter((b) => !b.main).every((b) => b.hidden), name + ": hidden again, and remembered");
    ok(!errors.length, name + ": no errors hiding and showing boxes", errors);
    await ctx.close();
  }
  /* the growth chart measures nothing until a student opens it */
  {
    const { page, ctx } = await openPage("sorting");
    await page.locator("#growth").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    ok(!(await page.evaluate(() => document.querySelector(".growth-status").textContent)), "a hidden growth chart does not start measuring");
    await openBox(page, "#growth");
    await page.waitForFunction(() => document.querySelector(".growth-status").textContent, null, { timeout: 5000 }).catch(() => {});
    ok(!!(await page.evaluate(() => document.querySelector(".growth-status").textContent)), "opening it starts the measurement");
    await ctx.close();
  }
  /* printing shows every box, hidden or not */
  {
    const { page, ctx } = await openPage("sorting");
    await page.emulateMedia({ media: "print" });
    ok(await page.locator(".about-body").isVisible() && await page.locator("#practice .lc-list").isVisible(), "hidden boxes still print");
    await ctx.close();
  }
}

/* ---------- accounts: optional Google sign-in that syncs progress, LeetCode status and step notes ---------- */
if (want("account")) {
  console.log("accounts and sync");
  const S = fake.state;
  const CFG = { url: BASE + "/__supabase", anonKey: ANON };
  /* a "computer": its own browser profile, with the site configured for the stand-in Supabase */
  const computer = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((cfg) => { window.DSA_ACCOUNT = cfg; }, CFG);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("uncaught: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
    page.on("dialog", (d) => d.accept());
    return { ctx, page, errors };
  };
  const go = async (page, path) => { await page.goto(BASE + path); await page.waitForLoadState("load"); };
  const settled = (page) => page.waitForFunction(() => DSA.account.state === "saved", null, { timeout: 8000 }).then(() => true, () => false);
  const signIn = async (page, keep) => {
    await page.click(".acct-btn");
    if (keep === false) await page.uncheck("#acct-keep");
    await Promise.all([page.waitForURL(/[?&]code=/, { waitUntil: "commit" }), page.click(".acct-menu button.primary")]);
    await page.waitForLoadState("load");
    return page.waitForFunction(() => window.DSA && DSA.account && DSA.account.user, null, { timeout: 8000 }).then(() => true, () => false);
  };
  /* start a real run on this page, the way the quiz suite does */
  const startRun = (page) => page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const big = () => DSA._players.find((x) => x.frames.length > 6 && x.isVisible() && !x.mount.closest("#playground"));
    const tabs = Array.from(document.querySelectorAll(".tabs button"));
    search: for (let t = 0; t < Math.max(1, tabs.length); t++) {
      if (tabs[t]) tabs[t].click();
      await sleep(0);
      const btns = Array.from(document.querySelectorAll(".panel.main button")).filter((b) => b.offsetParent && !b.closest(".player, .code-dock, .seg") && !b.matches(".danger, [data-tool]"));
      for (const b of btns) { b.click(); await sleep(0); if (big()) break search; }
    }
    const p = big();
    if (!p) return null;
    p.pause(); p.noMotion = true; p.showControls(true); p.goto(Math.min(4, p.frames.length - 1));
    return { caption: document.querySelector("#" + p.mount.id + " .note, .note") && p.frames[p.index].note, index: p.index, frames: p.frames.length, mount: p.mount.id };
  });
  const saveNote = async (page, text) => {
    const btn = page.locator(".note-btn:visible").first();
    await btn.click();
    await page.fill(".note-panel:visible textarea", text);
    await page.click(".note-panel:visible button.primary");
  };
  const mine = (table, uid) => [...S.tables[table].values()].filter((r) => r.user_id === uid);

  /* not configured (an empty DSA.ACCOUNT): nothing changes */
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { window.DSA_ACCOUNT = { url: "", anonKey: "" }; });
    const page = await ctx.newPage();
    await page.goto(BASE + "/cse214/trees.html");
    await page.waitForLoadState("load");
    ok((await page.locator(".acct-btn").count()) === 0 && !(await page.evaluate(() => DSA.account.enabled)), "without a Supabase URL there is no Sign in button");
    await ctx.close();
  }

  /* computer A: a laptop, signed in and kept signed in */
  S.nextUser = { id: "u-alice", email: "alice@example.edu", name: "Alice Student" };
  const A = await computer();
  await go(A.page, "/cse214/trees.html");
  ok((await A.page.locator(".acct-btn").textContent()) === "Sign in", "signed out: a Sign in button");
  ok((await A.page.locator(".lc-status").count()) === 0 && (await A.page.locator(".note-btn:visible").count()) === 0 && (await A.page.locator("#my-notes").count()) === 0, "signed out: no LeetCode status, notes or progress");
  ok(await signIn(A.page), "Google sign-in completes (PKCE checked by the server)");
  ok(!/code=/.test(A.page.url()), "the sign-in code is removed from the address", A.page.url());
  ok(await A.page.evaluate(() => !!localStorage.getItem("dsa.session.v1")), "'keep me signed in' keeps the session in localStorage");
  ok(/Alice/.test(await A.page.locator(".acct-btn").textContent()), "the button shows who is signed in");

  /* LeetCode status */
  await openBox(A.page, "#practice");
  const firstN = await A.page.locator(".lc-cell").first().getAttribute("data-n");
  await A.page.locator(".lc-status").first().selectOption("solved");
  ok(await settled(A.page), "a status change syncs");
  ok(mine("leetcode", "u-alice").some((r) => String(r.problem) === firstN && r.status === "solved"), "the server has it", mine("leetcode", "u-alice"));

  /* progress and a note pinned to a step */
  const run = await startRun(A.page);
  ok(!!run, "a run starts on Trees", run);
  await saveNote(A.page, "Why does it go <b>left</b> here? <img src=x onerror=alert(1)>");
  ok(await settled(A.page), "the note and progress sync");
  const prog = mine("progress", "u-alice").find((r) => r.page === "trees");
  ok(prog && prog.data.ops.length > 0 && prog.data.tabs.length > 0 && prog.data.lc.includes(+firstN), "the progress row lists tabs, operations and problems", prog && prog.data);
  const note = mine("notes", "u-alice")[0];
  ok(note && note.frames.length > 1 && note.meta.mount === run.mount && note.frames[note.meta.step].note === run.caption, "the note keeps the steps around the pinned one", note && note.meta);
  await openBox(A.page, "#my-notes");
  const shown = await A.page.locator("#my-notes .note-body").first().innerHTML();
  ok(/&lt;img/.test(shown) && !/<img/.test(shown), "a note's text is shown as text, never as HTML", shown);

  /* computer B: a school computer, not kept signed in */
  const B = await computer();
  await go(B.page, "/cse214/index.html");
  ok((await B.page.locator("#my-progress").count()) === 0, "signed out: no progress map");
  ok(await signIn(B.page, false), "sign-in on a second computer");
  ok(await B.page.evaluate(() => !localStorage.getItem("dsa.session.v1") && !!sessionStorage.getItem("dsa.session.v1")), "unticked: the session lasts only until the browser closes");
  await B.page.waitForFunction(() => document.querySelector("#my-progress"), null, { timeout: 8000 }).catch(() => {});
  await openBox(B.page, "#my-progress");
  const treesRow = await B.page.locator("#my-progress .pm-row", { hasText: "Trees" }).evaluate((r) => ({ text: r.innerText, bars: [...r.querySelectorAll("[role=progressbar]")].map((b) => b.getAttribute("aria-label") + ": " + b.getAttribute("aria-valuetext") + " (" + b.getAttribute("aria-valuenow") + "%)") }));
  ok(treesRow.bars.length === 3 && /LeetCode solved: 1 of \d+ problems/.test(treesRow.bars.join()) && /Explored: [1-9]/.test(treesRow.bars.join()) && !/Not started/.test(treesRow.text), "the progress map shows the laptop's work as bars", treesRow);
  ok(/Not started/.test(await B.page.locator("#my-progress .pm-row", { hasText: "Sorting" }).innerText()), "and modules never opened as not started");
  await Promise.all([B.page.waitForURL(/trees\.html#note=/), B.page.locator("#my-progress .note-list a").first().click()]);
  await B.page.waitForFunction((cap) => DSA._players.some((p) => p.frames.some((f) => f.note === cap) && p.frames[p.index].note === cap), run.caption, { timeout: 8000 }).catch(() => {});
  ok(await B.page.evaluate((cap) => DSA._players.some((p) => p.frames[p.index] && p.frames[p.index].note === cap), run.caption), "a note opens the exact step on another computer");

  /* the home page sits one folder up: its course row adds up the modules, and note links still reach cse214/ */
  await go(B.page, "/index.html");
  await B.page.waitForFunction(() => document.querySelector("#my-progress .note-list a"), null, { timeout: 8000 }).catch(() => {});
  await openBox(B.page, "#my-progress");
  const homeRow = await B.page.locator("#my-progress .pm-row:not(.pm-head)").first().evaluate((r) => ({ text: r.innerText, bars: [...r.querySelectorAll("[role=progressbar]")].map((b) => b.getAttribute("aria-label") + ": " + b.getAttribute("aria-valuetext")).join() }));
  ok(!/Not started/.test(homeRow.text) && /LeetCode solved: 1 of \d+ problems/.test(homeRow.bars), "home: the course row adds up every module", homeRow);
  const homeHref = await B.page.locator("#my-progress .note-list a").first().getAttribute("href").catch(() => "");
  ok(/\/cse214\/trees\.html#note=/.test(homeHref), "home: a note links into cse214/", homeHref);
  await Promise.all([B.page.waitForURL(/\/cse214\/trees\.html#note=/, { timeout: 8000 }).catch(() => {}), B.page.locator("#my-progress .note-list a").first().click()]);
  ok(/\/cse214\/trees\.html#note=/.test(B.page.url()), "home: clicking a note opens its module", B.page.url());

  /* both ways, and the newest change wins */
  await openBox(B.page, "#practice");
  await B.page.locator(".lc-cell[data-n='" + firstN + "'] .lc-status").selectOption("revisit");
  ok(await settled(B.page), "the school computer's change syncs");
  await A.page.evaluate(() => DSA.account.sync());
  ok((await A.page.locator(".lc-cell[data-n='" + firstN + "'] .lc-status").inputValue()) === "revisit", "the laptop picks it up", await A.page.locator(".lc-cell[data-n='" + firstN + "'] .lc-status").inputValue());
  const second = await A.page.locator(".lc-cell").nth(1).getAttribute("data-n");
  S.tables.leetcode.set("u-alice|" + second, { user_id: "u-alice", problem: +second, status: "todo", updated_at: new Date(Date.now() + 60000).toISOString() });
  await A.page.locator(".lc-cell[data-n='" + second + "'] .lc-status").selectOption("solved");
  await settled(A.page);
  await A.page.evaluate(() => DSA.account.sync());
  ok((await A.page.locator(".lc-cell[data-n='" + second + "'] .lc-status").inputValue()) === "todo", "an older change doesn't overwrite a newer one");

  /* offline: changes wait on the computer and sync later, even across a reload */
  const third = await A.page.locator(".lc-cell").nth(2).getAttribute("data-n");
  await A.page.route("**/__supabase/rest/**", (r) => r.abort());
  await A.page.locator(".lc-cell[data-n='" + third + "'] .lc-status").selectOption("solved");
  await A.page.waitForFunction(() => /offline|error/.test(DSA.account.state), null, { timeout: 8000 }).catch(() => {});
  ok(!mine("leetcode", "u-alice").some((r) => String(r.problem) === third), "offline: nothing reached the server");
  await A.page.reload(); await A.page.waitForLoadState("load");
  await A.page.unroute("**/__supabase/rest/**");
  await A.page.evaluate(() => DSA.account.sync());
  ok(await settled(A.page) && mine("leetcode", "u-alice").some((r) => String(r.problem) === third && r.status === "solved"), "back online: the waiting change syncs");

  /* an expiring session refreshes by itself */
  const refreshes = S.requests.filter((r) => r === "POST /auth/v1/token").length;
  await B.page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem("dsa.session.v1")); s.expires_at = Math.floor(Date.now() / 1000) + 30; sessionStorage.setItem("dsa.session.v1", JSON.stringify(s)); });
  await B.page.reload(); await B.page.waitForLoadState("load");
  await B.page.evaluate(() => DSA.account.sync());
  ok(S.requests.filter((r) => r === "POST /auth/v1/token").length > refreshes && await settled(B.page), "a session about to expire is refreshed");

  /* sign out, then delete the account */
  await B.page.click(".acct-btn");
  await B.page.click(".acct-menu button:has-text('Sign out')");
  await B.page.waitForFunction(() => !DSA.account.user);
  ok(await B.page.evaluate(() => !sessionStorage.getItem("dsa.session.v1") && !Object.keys(sessionStorage).some((k) => k.startsWith("dsa.sync."))), "sign out leaves nothing of the student on the school computer");
  ok((await B.page.locator(".lc-status").count()) === 0 && (await B.page.locator("#my-notes").count()) === 0, "signed out: the personal parts disappear");
  await A.page.click(".acct-btn");
  await A.page.click(".acct-menu button:has-text('Delete my account')");
  await A.page.waitForFunction(() => !DSA.account.user, null, { timeout: 8000 }).catch(() => {});
  ok(!mine("leetcode", "u-alice").length && !mine("notes", "u-alice").length && !mine("progress", "u-alice").length && !S.users.has("u-alice"), "delete my account removes everything on the server");
  ok(!A.errors.length && !B.errors.length, "no errors on either computer", A.errors.concat(B.errors));
  await A.ctx.close(); await B.ctx.close();

  /* a note on every module page reopens its step after a reload */
  S.nextUser = { id: "u-bob", email: "bob@example.edu", name: "Bob" };
  const C = await computer();
  await go(C.page, "/cse214/index.html");
  await signIn(C.page);
  for (const name of PAGES) {
    await go(C.page, "/cse214/" + name + ".html");
    await C.page.waitForFunction(() => DSA.account.user);
    const r = await startRun(C.page);
    if (!r) { ok(false, name + ": a run to pin a note to"); continue; }
    await saveNote(C.page, "note on " + name);
    ok(await settled(C.page), name + ": the note syncs");
    const id = [...S.tables.notes.values()].find((n) => n.user_id === "u-bob" && n.page === name).id;
    await C.page.evaluate(() => DSA.account.sync());
    await go(C.page, "/cse214/" + name + ".html#note=" + id);
    await C.page.waitForFunction((cap) => DSA._players.some((p) => p.frames[p.index] && p.frames[p.index].note === cap), r.caption, { timeout: 8000 }).catch(() => {});
    ok(await C.page.evaluate((cap) => DSA._players.some((p) => p.frames[p.index] && p.frames[p.index].note === cap && p.ctlShown), r.caption), name + ": the note reopens its step", r);
  }
  ok(!C.errors.length, "no errors pinning and opening notes on every page", C.errors);
  await C.ctx.close();
}

/* ---------- keepalive: the daily job keeps the free Supabase project awake, and restores it if paused ---------- */
if (want("keepalive")) {
  console.log("keepalive");
  const S = fake.state;
  const env = { SUPABASE_URL: BASE + "/__supabase", SUPABASE_ANON_KEY: ANON, CRON_SECRET: "cron-test", SUPABASE_ACCESS_TOKEN: "mgmt-token", SUPABASE_API_URL: BASE + "/__supabase/mgmt", SUPABASE_PROJECT_REF: "proj" };
  Object.assign(process.env, env);
  const call = (auth) => fetch(BASE + "/api/keepalive", { headers: auth ? { authorization: auth } : {} });
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const cron = (cfg.crons || []).find((c) => c.path === "/api/keepalive");
  ok(cron && /^\d+ \d+ \* \* \*$/.test(cron.schedule), "vercel.json runs it once a day (the most Vercel's free plan allows)", cron);
  ok(cfg.functions && cfg.functions["api/keepalive.js"], "the function is declared");
  ok((await call()).status === 401 && (await call("Bearer wrong")).status === 401, "only Vercel Cron's secret can run it");
  const before = S.pings;
  const healthy = await call("Bearer cron-test");
  ok(healthy.status === 200 && S.pings - before === 3, "a healthy project gets three real database calls", await healthy.json());
  S.down = true; S.projectStatus = "INACTIVE";
  const paused = await call("Bearer cron-test");
  const pj = await paused.json();
  ok(paused.status === 200 && pj.restored === true && S.restored === 1, "a paused project is restored automatically", pj);
  S.down = true; S.projectStatus = "ACTIVE_HEALTHY";
  ok((await call("Bearer cron-test")).status === 502 && S.restored === 1, "an outage that isn't a pause is reported, not 'restored'");
  delete process.env.SUPABASE_ACCESS_TOKEN;
  const noToken = await call("Bearer cron-test");
  ok(noToken.status === 502 && (await noToken.json()).restore === "not configured", "without a token it says it can't restore");
  S.down = false; S.projectStatus = "ACTIVE_HEALTHY";
  Object.keys(env).forEach((k) => delete process.env[k]);
}

/* ---------- offline: sw.js saves the site and serves it with no network ---------- */
if (want("offline")) {
  console.log("offline");
  const VER = currentVersion();
  /* Playwright's setOffline does not reach a service worker's own requests, so this suite has its own server
     and really goes offline by shutting it down. */
  const own = await startServer(0, {});
  const OB = "http://127.0.0.1:" + own.address().port;
  const ctx = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("uncaught: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  const cached = () => page.evaluate(async () => {
    const out = {};
    for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).map((r) => r.url.replace(location.origin, ""));
    return out;
  });
  await page.goto(OB + "/cse214/sorting.html");
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
  let c = await cached();
  ok(Object.keys(c).join() === "dsa-" + VER, "one saved copy, named after the asset version", Object.keys(c));
  const saved = c["dsa-" + VER] || [];
  ok(["/cse214/trees.html", "/index.html", "/assets/js/trees.js?v=" + VER, "/assets/css/style.css?v=" + VER].every((u) => saved.includes(u)), "pages and their scripts are saved on the first visit", saved);
  ok(!saved.some((u) => /editor\.js|playground-examples|why-data|java-interp|growth-worker/.test(u)), "the heavy tools are not downloaded until used", saved);

  /* opening the playground saves it for later */
  await page.click("#pg-open");
  await page.waitForSelector(".cm-content");
  await page.click("#pg-run");
  await page.waitForFunction(() => !document.querySelector("#pg-run").disabled, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  c = await cached();
  ok(["editor.js", "playground-examples.js", "java-interp.js"].every((f) => (c["dsa-" + VER] || []).some((u) => u.includes(f + "?v=" + VER))), "a tool used once is saved", c["dsa-" + VER]);

  own.close(); own.closeAllConnections();
  await page.goto(OB + "/cse214/trees.html");
  ok(/Trees/.test(await page.title()), "offline: a page never opened before still loads", await page.title());
  ok(await page.evaluate(() => !!(window.DSA && DSA._players && DSA._players.length)), "offline: its visualizer starts");
  await page.goto(OB + "/");
  ok(/Choose a course/.test(await page.textContent("h1")), "offline: the site root loads");
  await page.goto(OB + "/cse214/sorting.html");
  await page.click("#pg-open");
  await page.waitForSelector(".cm-content", { timeout: 8000 }).catch(() => {});
  ok((await page.locator(".cm-content").count()) === 1, "offline: the playground opens with its editor");
  await page.click("#pg-run");
  await page.waitForFunction(() => DSA._players[DSA._players.length - 1].frames.length > 3, null, { timeout: 8000 }).catch(() => {});
  ok(await page.evaluate(() => DSA._players[DSA._players.length - 1].frames.length > 3), "offline: the playground runs code");
  await page.goto(OB + "/cse214/nope.html");
  ok(/You are offline/.test(await page.textContent("h1")), "offline: an unsaved address says so plainly");
  ok(!errors.length, "no errors offline", errors);
  await ctx.close();

  /* a new version replaces the old copy */
  {
    const ctx2 = await browser.newContext({ serviceWorkers: "allow" });
    const p2 = await ctx2.newPage();
    await p2.goto(BASE + "/cse214/sorting.html");
    await p2.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    await p2.evaluate(() => navigator.serviceWorker.register(DSA.ROOT + "sw.js?v=next"));
    let names = [];
    for (let i = 0; i < 50 && names.join() !== "dsa-next"; i++) { await p2.waitForTimeout(200); names = await p2.evaluate(() => caches.keys()); }
    ok(names.join() === "dsa-next", "a new version deletes the old saved copy", names);
    await ctx2.close();
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
  await shot("sorting", async (page) => { await openBox(page, "#growth"); await page.waitForFunction(() => /Stopped early|Measured every/.test(document.querySelector(".growth-status").textContent), null, { timeout: 40000 }); await openBox(page, "#growth"); }, { as: "growth" });
  const inPanel = (example, back) => async (page) => {
    await page.click("#pg-open");
    await page.waitForSelector("#pg-run");
    if (example) {
      /* a renamed starter should fail one check by name, not time out and stop the whole run */
      const names = await page.$$eval("#pg-example option", (o) => o.map((x) => x.textContent));
      if (!ok(names.includes(example), "screenshot starter \"" + example + "\" exists", names)) return;
      await page.selectOption("#pg-example", { label: example });
    }
    await page.click("#pg-run");
    await page.waitForFunction(() => { const p = DSA._players[DSA._players.length - 1]; return p.frames.length > 5 && !document.querySelector("#pg-run").disabled; });
    await page.evaluate((back) => { const p = DSA._players[DSA._players.length - 1]; p.pause(); p.noMotion = true; p.goto(Math.max(0, p.frames.length - back)); document.querySelector("#playground").scrollIntoView(); }, back);
  };
  await shot("trees", async (page) => { await inPanel("BST: iterative", 8)(page); }, { as: "pg-trees" });
  await shot("arrays", inPanel("singly linked list", 22), { as: "pg-phone", ctx: { viewport: { width: 390, height: 844 } }, full: true });
  await shot("hashtables", inPanel("separate chaining", 6), { as: "pg-hash" });
  await shot("graphs", inPanel("BFS only", 6), { as: "pg-graph" });
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
