/* ============================================================
   share.js: a link that reopens this exact input and step.

   The frames are too big for a URL, and every module keeps its state
   differently, so a link stores how to get here instead:
     - a seed for Math.random (so "New array" gives the same array)
     - the controls the reader used, in order
     - module state that is not in a control (D.share.state)
     - which frame each player was on
   Opening the link replays that list, then jumps to the frame. It is all
   in the #hash: nothing is sent to any server. lz-string keeps it short.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const VERSION = 1, PREFIX = "#s=";
  const MAX_ACTIONS = 300, MAX_URL = 12000;
  const IGNORE = ".player, .code-dock, .about, footer, .topbar, .learn-panel, .growth, [data-noshare]";

  /* ---------- repeatable randomness ---------- */
  const mulberry = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let seed = (Math.random() * 0x7fffffff) | 0;
  const incoming = readHash();
  if (incoming) seed = incoming.seed;
  let stream = mulberry(seed);
  Math.random = () => stream();
  /* every action gets its own random stream, so nothing else calling Math.random can change what a replay draws */
  const reseed = (n) => { stream = mulberry((seed ^ Math.imul(n + 1, 0x9e3779b1)) | 0); };

  function readHash() {
    if (!location.hash.startsWith(PREFIX) || !window.LZString) return null;
    try {
      return clean(JSON.parse(window.LZString.decompressFromEncodedURIComponent(location.hash.slice(PREFIX.length))));
    } catch (e) { return null; }
  }

  /* A link can be written by anyone, so nothing in it is trusted: wrong shapes are dropped here. */
  function clean(d) {
    if (!d || d.v !== VERSION || !Array.isArray(d.acts) || d.acts.length > MAX_ACTIONS) return null;
    const acts = d.acts.filter((a) => a && typeof a.q === "string" && a.q.length < 300 &&
      (a.t === "c" || a.t === "s" || (a.t === "i" && (typeof a.v === "string" || typeof a.v === "boolean") && String(a.v).length < 2000)));
    return {
      v: VERSION,
      seed: Number.isInteger(d.seed) ? d.seed : 1,
      acts: acts,
      players: Array.isArray(d.players) ? d.players.filter((p) => Number.isInteger(p) && p >= 0).slice(0, 8) : [],
      lang: d.lang === "java" || d.lang === "pseudo" ? d.lang : null,
      codeOpen: d.codeOpen === true,
    };
  }
  /* a replay may only press this page's own controls, never a link or anything outside the page's content */
  function controlFor(selector) {
    let el = null;
    try { el = document.querySelector(selector); } catch (e) { return null; }
    if (!el || !el.closest("main") || el.closest(IGNORE)) return null;
    return el.matches("button, input, select, textarea, [data-tool]") ? el : null;
  }

  /* ---------- naming a control so a replay can find it again ---------- */
  function selectorOf(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.id) { parts.unshift("#" + CSS.escape(n.id)); break; }
      const i = Array.from(n.parentElement.children).indexOf(n) + 1;
      parts.unshift(n.tagName.toLowerCase() + ":nth-child(" + i + ")");
    }
    return parts.join(">");
  }

  /* ---------- the action log ---------- */
  const log = incoming ? incoming.acts.slice() : [];
  const custom = new Map();
  let replaying = false;

  function record(a) {
    if (replaying) return;
    /* typing again in the same box replaces the earlier value */
    const last = log[log.length - 1];
    if (last && last.t === a.t && last.q === a.q && (a.t === "i" || a.t === "s")) { log[log.length - 1] = a; return; }
    log.push(a);
  }
  document.addEventListener("click", (e) => {
    if (replaying) return;
    const b = e.target.closest && e.target.closest("button, [data-tool]");
    if (!b || b.closest(IGNORE)) return;
    record({ t: "c", q: selectorOf(b) });
    reseed(log.length);
  }, true);
  const onField = (e) => {
    if (replaying) return;
    const el = e.target;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.closest(IGNORE)) return;
    const isBox = el.type === "checkbox" || el.type === "radio";
    record({ t: "i", q: selectorOf(el), v: isBox ? el.checked : el.value });
    reseed(log.length);
  };
  document.addEventListener("input", onField, true);
  document.addEventListener("change", onField, true);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function replay(data) {
    replaying = true;
    try {
      for (let n = 0; n < data.acts.length; n++) {
        const a = data.acts[n];
        reseed(n + 1);
        if (a.t === "s") { const c = custom.get(a.q); if (c) await c.set(a.v); continue; }
        const el = controlFor(a.q);
        if (!el) continue;
        if (a.t === "c") el.click();
        else {
          if (el.type === "checkbox" || el.type === "radio") el.checked = a.v;
          else el.value = a.v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        await sleep(0);
      }
      /* some inputs rebuild a moment after typing stops (Recursion waits 450 ms) */
      await sleep(data.acts.some((a) => a.t === "i") ? 520 : 30);
      /* the playground's player may have only just been created, so controls are set up here too */
      (data.players || []).forEach((p, i) => {
        const pl = D._players[i];
        if (!pl) return;
        pl.pause();
        if (pl.frames.length > 1) pl.showControls(true);
        pl.noMotion = true;
        pl.goto(p);
        pl.noMotion = false;
      });
      if (data.lang && data.lang !== D.lang()) {
        const b = document.querySelector('.lang-switch [data-lang="' + data.lang + '"]');
        if (b) b.click();
      }
      if (data.codeOpen) { const h = document.querySelector(".code-dock.collapsed .code-hide"); if (h) h.click(); }
      D.toast("Opened the shared step.");
    } catch (err) {
      console.error(err);
      D.toast("Could not fully rebuild this link.", true);
    } finally { replaying = false; }
  }

  function buildLink() {
    if (log.length > MAX_ACTIONS) return { error: "This session has too many steps to fit in a link. Reload the page and repeat the last few." };
    if (!window.LZString) return { error: "The link helper did not load. Reload the page and try again." };
    /* state that changes without a run (code being typed) is read now */
    custom.forEach((c, name) => { if (c.live) D.share.note(name); });
    const data = {
      v: VERSION, seed: seed, acts: log,
      players: D._players.map((p) => p.index),
      lang: D.lang(),
      codeOpen: !!document.querySelector(".code-dock:not(.collapsed) .code-hide") || undefined,
    };
    const url = location.href.split("#")[0] + PREFIX + window.LZString.compressToEncodedURIComponent(JSON.stringify(data));
    if (url.length > MAX_URL) return { error: "This link would be too long to work everywhere. Reload the page and repeat the last few steps." };
    return { url: url };
  }

  D.share = {
    /** Register state that controls do not hold: state(name, get, set). */
    state(name, get, set, opts) { custom.set(name, { get: get, set: set, live: !!(opts && opts.live) }); },
    /** The state called `name` just changed: remember a copy at this point in the log. */
    note(name) {
      const c = custom.get(name);
      if (!c) return;
      const v = c.get();
      if (v != null) record({ t: "s", q: name, v: JSON.parse(JSON.stringify(v)) });
    },
    link: buildLink,
  };

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const t = D.el("textarea", { style: "position:fixed;opacity:0" });
    t.value = text;
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    t.remove();
    return ok;
  }

  D.playerAddons.push(function (player) {
    const btn = D.el("button", { type: "button", class: "tool-btn", title: "Copy a link that reopens this input at this step", text: "Copy link" });
    btn.addEventListener("click", async () => {
      const r = buildLink();
      if (r.error) { D.toast(r.error, true); return; }
      history.replaceState(null, "", r.url);
      const ok = await copy(r.url);
      D.toast(ok ? "Link copied. It opens this input at this step." : "The link is in the address bar: copy it from there.");
    });
    player.tools.appendChild(btn);
  });

  /* after every page script has set up its starting picture */
  window.addEventListener("load", () => {
    const data = readHash();
    if (data) replay(data);
    else if (location.hash.startsWith(PREFIX)) D.toast("This link is damaged or from an older version.", true);
  });
})();
