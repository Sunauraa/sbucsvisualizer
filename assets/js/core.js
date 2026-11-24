/* ============================================================
   core.js: shared helpers + the frame-based animation player
   Every visualizer works the same way:
     1. an algorithm runs to completion and records "frames"
     2. the Player scrubs through those frames
     3. a render(frame) callback paints the current frame
   Recording up-front (instead of animating live) means you get
   step-back, scrubbing and instant replay for free.
   ============================================================ */
(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const DSA = (window.DSA = {});

  /* the site root, from this script's own URL (assets/js/core.js), so pages at any depth can find the
     Vercel function and the vendored files */
  DSA.ROOT = (function () {
    try { return new URL("../../", document.currentScript.src).href; } catch (e) { return "../"; }
  })();
  /* the asset version (?v=…) this page loaded core.js with; tools/stamp.mjs writes it into every page */
  DSA.VERSION = (function () {
    try { return new URL(document.currentScript.src).searchParams.get("v") || ""; } catch (e) { return ""; }
  })();
  /** DSA.asset("assets/vendor/editor.js") → its URL with this page's version. Browsers keep assets for two
      weeks, so anything loaded later (scripts, workers) must carry the version too or it would go stale. */
  DSA.asset = (p) => DSA.ROOT + p + (DSA.VERSION ? "?v=" + DSA.VERSION : "");

  /* Offline copy (sw.js). Not over file://, where browsers don't allow it, and not on localhost, so files
     edited while running `npm run serve` show up on reload. */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && location.hostname !== "localhost" && DSA.VERSION) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(DSA.ROOT + "sw.js?v=" + DSA.VERSION).catch(() => {});
    });
  }
  /* Features in their own files (motion, notes) add themselves to every Player through this list. */
  DSA.playerAddons = [];

  /* ---------------- feedback ----------------
     Every page gets a "Send feedback" button in the top bar that opens this link in a new tab.
     Paste your Google Form link between the quotes. While it is empty the button says the form is not
     connected yet.
     Optional: to pre-fill one short-answer question with the page, tab and operation the reader was on,
     open the form's ⋮ menu → "Get pre-filled link", type anything into that question, click "Get link",
     and copy the "entry.123456789" part of the link into FEEDBACK_PAGE_FIELD. */
  DSA.FEEDBACK_URL = "";
  DSA.FEEDBACK_PAGE_FIELD = "";

  /* ---------------- accounts (optional) ----------------
     Sign in with Google to sync a progress map, LeetCode status and notes pinned to a step (account.js).
     Paste your Supabase project's URL and its public "anon" key (Project Settings → API). Both are meant to be
     public: each student's rows are protected by the database's row-level security (supabase/schema.sql).
     While these are empty there is no Sign in button and the site works exactly as before. */
  DSA.ACCOUNT = { url: "https://dreipmmojqlhphopzocc.supabase.co", anonKey: "sb_publishable_0vYgxR2W4nxqupM8ksWoTw_Q0jQykSA" };

  /* ---------------- events ----------------
     Modules and tools announce what a student does; account.js listens to build the progress map.
       tab       { label }                      a tab was opened
       run       { player, user, keys }         a player loaded a run of several steps (keys: listings it ran;
                                                user: the student started it, not the page loading)
       practice  { mount }                      the LeetCode list was drawn */
  DSA.events = new EventTarget();
  DSA.emit = (type, detail) => { try { DSA.events.dispatchEvent(new CustomEvent(type, { detail: detail || {} })); } catch (e) { console.error(e); } };
  DSA.on = (type, fn) => DSA.events.addEventListener(type, (e) => { try { fn(e.detail); } catch (err) { console.error(err); } });

  /* ---------------- tiny DOM helpers ---------------- */
  DSA.$ = (sel, root) => (root || document).querySelector(sel);
  DSA.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  DSA.el = function (tag, attrs, children) {
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  };

  DSA.svg = function (tag, attrs, children) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    (children || []).forEach((c) => n.appendChild(c));
    return n;
  };

  /* svg convenience shapes */
  DSA.sText = (x, y, s, attrs) =>
    DSA.svg("text", Object.assign({ x, y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 13 }, attrs || {}), [
      document.createTextNode(s == null ? "" : String(s)),
    ]);
  DSA.sLine = (x1, y1, x2, y2, cls) => DSA.svg("line", { x1, y1, x2, y2, class: cls || "edge" });

  /* ---------------- misc utils ---------------- */
  DSA.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  DSA.randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  DSA.shuffled = function (a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  DSA.randArray = (n, lo, hi) => Array.from({ length: n }, () => DSA.randInt(lo == null ? 5 : lo, hi == null ? 99 : hi));

  /** Parse "3, 9 12,-4, 2.5" into a number array (negatives and decimals allowed). Returns [] on empty. */
  const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)$/;
  DSA.parseNums = function (s) {
    return String(s || "")
      .replace(/[−–]/g, "-")
      .split(/[\s,;]+/)
      .filter((t) => t.length && NUM_RE.test(t))
      .map(Number);
  };
  /** The number typed in an input, negative and decimal values included, or fallback() when it is empty
      or not a number. Values are kept to 2 decimal places so they fit in a cell. */
  DSA.readNum = function (sel, fallback) {
    const el = typeof sel === "string" ? DSA.$(sel) : sel;
    const t = el ? String(el.value).trim().replace(/[−–]/g, "-") : "";
    if (!NUM_RE.test(t)) return fallback ? fallback() : NaN;
    return Math.round(Number(t) * 100) / 100;
  };
  /** A whole number typed in an input (an index, a count), or NaN. 2.5 is not an index, so it gives NaN too. */
  DSA.readInt = function (sel) {
    const v = DSA.readNum(sel);
    return Number.isInteger(v) ? v : NaN;
  };
  DSA.parseTokens = function (s) {
    return String(s || "").split(/[\s,;]+/).filter((t) => t.length);
  };

  let toastEl = null, toastT = 0;
  DSA.toast = function (msg, isErr) {
    if (!toastEl) {
      toastEl = DSA.el("div", { class: "toast" });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(toastT);
    toastT = setTimeout(() => (toastEl.className = "toast"), 2200);
  };

  /* ============================================================
     code panels
     ------------------------------------------------------------
     Lines are written as PLAIN TEXT (no HTML) and highlighted here,
     so the same string is safe in every language.
     ============================================================ */
  const KEYWORDS = {
    java:
      "abstract boolean break case catch char class continue default do double else extends final finally " +
      "float for if implements import instanceof int interface long new null private protected public return " +
      "static super switch this throw throws true false try void while",
  };
  const KW_RE = {};
  for (const k in KEYWORDS) KW_RE[k] = new RegExp("^(?:" + KEYWORDS[k].split(" ").join("|") + ")$");

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /** Colourise one plain-text line for `lang`. Pseudocode only gets comments. */
  function paint(line, lang) {
    if (line === "") return "&nbsp;";
    const cmt = "//";
    const kw = KW_RE[lang];
    let out = "", rest = line;

    /* trailing comment first: everything after it is literal */
    const ci = rest.indexOf(cmt);
    let tail = "";
    if (ci >= 0) { tail = '<span class="cm">' + esc(rest.slice(ci)) + "</span>"; rest = rest.slice(0, ci); }
    if (!kw) return esc(rest) + tail;

    /* strings, numbers, keywords */
    const tok = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+\b)|([A-Za-z_]\w*)/g;
    let last = 0, m;
    while ((m = tok.exec(rest))) {
      out += esc(rest.slice(last, m.index));
      if (m[1]) out += '<span class="st">' + esc(m[1]) + "</span>";
      else if (m[2]) out += '<span class="nm">' + m[2] + "</span>";
      else if (kw.test(m[3])) out += '<span class="kw">' + m[3] + "</span>";
      else out += m[3];
      last = m.index + m[0].length;
    }
    return out + esc(rest.slice(last)) + tail;
  }

  /* which language the whole site is showing, remembered between pages */
  const LANGS = [
    { id: "pseudo", label: "Pseudocode" },
    { id: "java", label: "Java" },
  ];
  const LS_KEY = "dsa.lang";
  let curLang = "pseudo";
  try { const s = localStorage.getItem(LS_KEY); if (s && LANGS.some((l) => l.id === s)) curLang = s; } catch (e) {}
  DSA.lang = () => curLang;

  let blocks = [];
  function setLang(id) {
    if (id === curLang) return;
    curLang = id;
    try { localStorage.setItem(LS_KEY, id); } catch (e) {}
    /* panels are rebuilt whenever you pick a new algorithm; drop the detached ones */
    blocks = blocks.filter((b) => b.node.isConnected);
    blocks.forEach((b) => b.refresh());
    langListeners.forEach((fn) => { try { fn(id); } catch (e) { console.error(e); } });
  }
  const langListeners = [];
  DSA.onLang = (fn) => langListeners.push(fn);

  /** Plain single-language panel: CodePanel(mount, ["line", ...]). */
  DSA.CodePanel = function (mount, lines) {
    return DSA.CodeBlock(mount, { pseudo: lines });
  };

  /* ------------------------------------------------------------
     CodeBlock(mount, variants)
       variants = { pseudo: [...], java: [...], map: { java: [...] } }

     Two ways to say which line a frame is on:

     1. Named anchors (preferred). End a line with "@@name" (or
        "@@a,b" for several) in EVERY language that has an equivalent
        line; highlight("name") lights all lines carrying that anchor
        in whatever language is on screen. No index bookkeeping, and a
        step that is two lines in Java and one in pseudocode just works.

     2. Numeric (older listings). highlight(i) with i an index into the
        PSEUDOCODE listing; `map[lang][i]` translates it for the other
        languages. Identity if absent.
     ------------------------------------------------------------ */
  const ANCHOR = /\s*@@([\w-]+(?:,[\w-]+)*)\s*$/;
  function splitAnchor(t) {
    const m = ANCHOR.exec(t);
    return m ? { text: t.slice(0, m.index), tags: m[1].split(",") } : { text: t, tags: [] };
  }

  DSA.CodeBlock = function (mount, variants, opts) {
    const o = opts || {};
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    const maps = variants.map || {};
    const have = LANGS.filter((l) => Array.isArray(variants[l.id]) && variants[l.id].length);
    /* focusable, so a keyboard can scroll a listing that is wider or taller than its box */
    const pre = DSA.el("pre", { class: "code", tabindex: "0", "aria-label": "Code listing" });
    let spans = [], tags = [], line = null, bar = null;

    /* `switcher: false` for a second block that follows the panel's own switch;
       `switcherMount` to put the switch somewhere else (the dock header) */
    if (have.length > 1 && o.switcher !== false) {
      bar = DSA.el("div", { class: "lang-switch" });
      if (!o.switcherMount) bar.appendChild(DSA.el("span", { class: "lang-label", text: "language" }));
      have.forEach((l) =>
        bar.appendChild(DSA.el("button", { text: l.label, "data-lang": l.id, onclick: () => setLang(l.id) }))
      );
    }
    if (o.switcherMount) {
      o.switcherMount.innerHTML = "";
      if (bar) o.switcherMount.appendChild(bar);
    }
    if (m) {
      m.innerHTML = "";
      if (bar && !o.switcherMount) m.appendChild(bar);
      m.appendChild(pre);
    }

    const api = {
      node: pre,
      /** Repaint in the current language, keeping the highlighted step. */
      refresh() {
        const lang = variants[curLang] ? curLang : have.length ? have[0].id : "pseudo";
        pre.innerHTML = "";
        tags = [];
        spans = (variants[lang] || []).map((t) => {
          const a = splitAnchor(t);
          tags.push(a.tags);
          const s = DSA.el("span", { class: "ln", html: paint(a.text, lang) });
          pre.appendChild(s);
          return s;
        });
        if (bar) DSA.$$("button", bar).forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
        pre.dataset.lang = lang;
        api.highlight(line);
      },
      /** i: an anchor name, a pseudocode line index, or null to clear. */
      highlight(i) {
        line = i;
        let hit;
        /* "name^" lights only the FIRST line tagged "name": the condition of an
           if/while whose body did not run (a listing tags its condition line first) */
        const has = (j, a) => {
          if (a.endsWith("^")) { a = a.slice(0, -1); return tags[j].indexOf(a) >= 0 && tags.findIndex((t) => t.indexOf(a) >= 0) === j; }
          return tags[j].indexOf(a) >= 0;
        };
        if (i == null) hit = () => false;
        else if (typeof i === "string") hit = (j) => has(j, i);
        else if (Array.isArray(i)) hit = (j) => i.some((a) => has(j, a));
        else {
          const map = maps[pre.dataset.lang];
          const k = map && map[i] != null ? map[i] : i;
          hit = (j) => j === k;
        }
        let first = null;
        spans.forEach((s, j) => {
          const on = hit(j);
          s.classList.toggle("on", on);
          if (on && !first) first = s;
        });
        if (first && pre.scrollHeight > pre.clientHeight) {
          const top = first.offsetTop - pre.offsetTop;
          if (top < pre.scrollTop || top > pre.scrollTop + pre.clientHeight - 30)
            pre.scrollTop = Math.max(0, top - pre.clientHeight / 2);
        }
      },
    };
    blocks.push(api);
    api.refresh();
    return api;
  };

  /* ------------------------------------------------------------
     CodeDock(mount, listings)
       listings = { key: { title, pseudo, java, cpp, python, map? } }
     The panel that sits ABOVE every visualization: a title naming
     the running operation, the language switch, and the listing.
     Give it to a Player as `code:` and every frame drives it:
       frame.code  which listing to show (kept until a frame changes it)
       frame.line  anchor name / pseudocode index to highlight
     ------------------------------------------------------------ */
  /* ------------------------------------------------------------
     Signatures and calls
     Every listing's first line is its signature, so the dock can show
     how you would CALL the function in each language, with the values
     that were actually used (parsed from the operation's opening
     caption, e.g. "<b>insert(2, 99)</b>") or the parameter names.
     ------------------------------------------------------------ */
  function splitTop(s) {             /* split on commas not inside <> () [] {} */
    const out = []; let depth = 0, cur = "";
    for (const ch of s) {
      if ("<([{".includes(ch)) depth++;
      else if (">)]}".includes(ch)) depth--;
      if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }
  function sigOf(L, lang) {
    const first = L && L[lang] && L[lang][0];
    if (!first) return null;
    let t = splitAnchor(first).text;
    t = t.replace(/\/\/.*$/, "").trim();
    let m;
    if (lang === "pseudo") {
      m = /^([\w]+)\s*\(([^)]*)\)\s*:/.exec(t);
      if (!m) return null;
      return { name: m[1], params: splitTop(m[2]), type: null };
    }
    m = /^((?:(?:public|private|protected)\s+)?(?:static\s+)?)(.+?)\s*\b(\w+)\s*\((.*)\)\s*\{?\s*$/.exec(t);
    if (!m) return null;
    const params = splitTop(m[4]).map((p) => { const w = p.split("=")[0].trim().match(/(\w+)\s*(\[\s*\])*$/); return w ? w[1] : p; });
    /* a Java method without `static` belongs to an object, so the call names the receiver (stack.push(x)) */
    return { name: m[3], params: params, type: m[2].trim(), method: !/static/.test(m[1]) };
  }
  const resultName = (name, type) =>
    /^(boolean|bool)$/.test(type || "") ? "found"
      : /Node/.test(type || "") ? "node"
      : /^Entry/.test(type || "") ? "e"
      : /^(hash|poly_hash)$/.test(name) ? "h"
      : /^(indexOf|search|binarySearch|binarySearchIter)/i.test(name) ? "i"
      : /^(find)/i.test(name) ? "pos"
      : /^(remove|pop|dequeue|get|top|first|min|peek|removeMin|removeFirst|removeLast)/i.test(name) ? "x"
      : "result";
  /** the call statement for listing L in `lang`; recv = object name (null for a plain function), vals = {param: value} */
  DSA.callLine = function (L, lang, recv, vals) {
    const sig = sigOf(L, lang), pseudo = sigOf(L, "pseudo");
    if (!sig) return null;
    /* L.callVals: defaults for a top-level call, e.g. { lo: "0", hi: { pseudo: "n − 1", java: "a.length - 1" } } */
    const v = {};
    Object.entries(L.callVals || {}).forEach(([k, x]) => { const y = x && typeof x === "object" ? x[lang] : x; if (y != null) v[k] = y; });
    Object.assign(v, vals || {});
    const args = sig.params.map((p) => (v[p] != null ? v[p] : p)).join(", ");
    const java = sigOf(L, "java") || {};
    const target = (java.method && recv ? recv + "." : "") + sig.name + "(" + args + ")";
    const ret = java.type;
    const hasRet = ret && !/^void$/.test(ret);
    const nm = resultName(sig.name, ret);
    if (lang === "java") return (hasRet ? ret + " " + nm + " = " : "") + target + ";";
    return (hasRet ? nm + " ← " : "") + target;
  };
  /* values of a call written in a caption: "<b>insert(2, 99)</b>: …" → {i: 2, x: 99} (pseudocode parameter names) */
  function argsFromNote(L, note) {
    const sig = sigOf(L, "pseudo");
    if (!sig || !note) return null;
    const text = String(note).replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const m = new RegExp("\\b" + sig.name + "\\s*\\(").exec(text);
    if (!m || text.slice(0, m.index).trim()) return null;   /* only a call that OPENS the caption */
    let depth = 1, j = m.index + m[0].length, inner = "";
    for (; j < text.length && depth; j++) { const ch = text[j]; if (ch === "(") depth++; else if (ch === ")") depth--; if (depth) inner += ch; }
    const vals = splitTop(inner);
    if (vals.length !== sig.params.length) return null;
    const out = {};
    sig.params.forEach((p, i) => (out[p] = vals[i]));
    return out;
  }
  /* Tag every frame (and compare-mode sides) with the argument values of the operation it belongs to */
  function listingOf(key) {
    for (const d of docks) if (d.listings[key]) return d.listings[key];
    return null;
  }
  DSA.annotateArgs = function (frames) {
    const state = { S: { code: null, args: {} }, L: { code: null, args: {} }, R: { code: null, args: {} } };
    const visit = (f, st) => {
      if (!f) return;
      if (f.code && f.code !== st.code) st.code = f.code;
      const L = st.code && listingOf(st.code);
      if (L && f.note) { const a = argsFromNote(L, f.note); if (a) st.args[st.code] = a; }
      if (st.code && st.args[st.code]) f._args = st.args[st.code];
    };
    (frames || []).forEach((f) => { if (!f) return; if (f.L || f.R) { visit(f.L, state.L); visit(f.R, state.R); } else visit(f, state.S); });
  };

  /* spec block: what the function does, how to call it, parameters, result, errors, worst-case time and space */
  function specBox(L, key, recv, argsHook) {
    const box = DSA.el("div", { class: "code-spec" });
    const sp = L.spec || {};
    let vals = null;
    const callEl = DSA.el("code", { class: "spec-call-code" });
    function paintCall() {
      const lang = variantsHave(L, curLang) ? curLang : "pseudo";
      const r = typeof recv === "function" ? recv(key) : recv;
      const v = vals || (argsHook ? argsHook(key) : null);
      const line = DSA.callLine(L, lang, r, v);
      callEl.innerHTML = line ? paint(line, lang) : "";
      callRow.style.display = line ? "" : "none";
    }
    if (sp.does) box.appendChild(DSA.el("div", { class: "spec-does", html: sp.does }));
    const callRow = DSA.el("div", { class: "spec-row" }, [DSA.el("span", { class: "spec-k", text: "call" }), callEl]);
    box.appendChild(callRow);
    /* only what it does and the call; time and space are in the bar's badge */
    paintCall();
    return { node: box, setArgs(a) { if (a !== vals || argsHook) { vals = a || null; paintCall(); } }, repaint: paintCall };
  }
  /** specs(listings, { key: { does, params, returns, errors, time, space, callVals? } }): attach specs to listings.
      time / space are WORST-CASE bounds written with Θ (tight); space is the extra memory the call uses. */
  DSA.specs = function (listings, map) {
    Object.keys(map).forEach((k) => {
      const L = listings[k];
      if (!L) { console.warn("spec for unknown listing " + k); return; }
      const sp = Object.assign({}, map[k]);
      if (sp.callVals) { L.callVals = sp.callVals; delete sp.callVals; }
      L.spec = sp;
    });
  };
  function variantsHave(L, lang) { return Array.isArray(L[lang]) && L[lang].length > 0; }

  /* The code is HIDDEN on every page load so a newcomer first sees only the picture and the caption.
     "show code" opens every dock on the page, but it is not remembered: the next load starts hidden again. */
  let codeHidden = true;
  try { localStorage.removeItem("dsa.codeHidden.v3"); localStorage.removeItem("dsa.classHidden.v2"); } catch (e) {}

  /* ------------------------------------------------------------
     Classes. A method listing such as push(x) uses fields (data, t)
     that only make sense inside its class, so a listing can name the
     class it belongs to:
       D.classes(CODE, [{ name, pseudo: [...], java: [...], note, keys: /^st_/ }])
     The dock then shows that class (fields, constructor, Node class)
     above the method, with a one-line reminder of how objects work.
     ------------------------------------------------------------ */
  DSA.classes = function (listings, defs) {
    defs.forEach((d) => {
      Object.keys(listings).forEach((k) => {
        const hit = d.keys instanceof RegExp ? d.keys.test(k) : (d.keys || []).indexOf(k) >= 0;
        if (hit) listings[k].cls = d;
      });
    });
    return defs;
  };

  /* ------------------------------------------------------------
     Full code. DSA.fullSource puts together the whole source of one
     structure (not shown on the page; the tests compile it with javac): its fields and constructor, every method the module
     uses, and the helpers those methods call.
       D.CodeDock(mount, listings, { full: [group, ...] })
       group = a class from D.classes, or a plain { name, keys }, plus
         methods  listing keys, when keys alone would miss a shared one
         helpers  [{ pseudo: [...], java: [...] }], functions no step of
                  the animation runs, so they have no listing of their own

     A listing is cut at its blank lines, so a helper two listings both
     carry (AVL's rotations) appears once. Two versions of one method
     (delete with a successor, delete with a predecessor) both appear,
     each under a comment naming it.
     ------------------------------------------------------------ */
  const plainTitle = (t) => String(t || "").replace(/<[^>]*>/g, "");
  function chunksOf(lines) {
    const out = [];
    let cur = null;
    (lines || []).forEach((raw) => {
      const t = splitAnchor(raw).text;
      if (!t.trim()) { cur = null; return; }
      if (!cur) out.push((cur = []));
      cur.push(t);
    });
    return out;
  }
  /* the name a chunk defines: "void delete(double k) {" → delete */
  function chunkName(lines) {
    for (const l of lines) {
      const t = l.replace(/\/\/.*$/, "");
      const m = /([A-Za-z_]\w*)\s*\(/.exec(t);
      if (m) return m[1];
      if (t.trim()) return null;
    }
    return null;
  }
  const groupHas = (g, k) => {
    const list = g.methods || g.keys;
    return list instanceof RegExp ? list.test(k) : (list || []).indexOf(k) >= 0;
  };
  /** The functions of a group in one language: [{ lines, keys, title, name }] */
  DSA.fullChunks = function (g, listings, lang) {
    const out = [], seen = new Map();
    const put = (lines, key, title) => {
      const text = lines.join("\n");
      const had = seen.get(text);
      if (had) { if (key) had.keys.push(key); return; }
      const c = { lines: lines, keys: key ? [key] : [], title: title || null, name: chunkName(lines) };
      seen.set(text, c);
      out.push(c);
    };
    Object.keys(listings).forEach((k) => {
      if (!groupHas(g, k) || !listings[k][lang]) return;
      chunksOf(listings[k][lang]).forEach((c, i) => put(c, k, i === 0 ? plainTitle(listings[k].title) : null));
    });
    (g.helpers || []).forEach((h) => chunksOf(h[lang]).forEach((c) => put(c, null, null)));
    return out;
  };
  /** One group as a single listing: the class around every function, each line tagged with the listings it belongs to. */
  DSA.fullSource = function (g, listings, lang, chunks) {
    const list = chunks || DSA.fullChunks(g, listings, lang);
    const count = {};
    list.forEach((c) => { if (c.name) count[c.name] = (count[c.name] || 0) + 1; });
    const wrap = (g[lang] || []).filter((l) => !/^\s*\/\/.*\bbelow\b/.test(l));
    while (wrap.length && !wrap[wrap.length - 1].trim()) wrap.pop();
    const closes = lang === "java" && wrap.length && wrap[wrap.length - 1].trim() === "}";
    if (closes) wrap.pop();
    while (wrap.length && !wrap[wrap.length - 1].trim()) wrap.pop();
    const indent = wrap.length ? "  " : "";
    const out = [];
    wrap.forEach((l) => out.push(l));
    list.forEach((c) => {
      const tag = c.keys.length ? " @@" + c.keys.map((k) => "m_" + k).join(",") : "";
      if (out.length) out.push("");
      if (c.title && c.name && count[c.name] > 1) out.push(indent + "// " + c.title + tag);
      c.lines.forEach((l) => out.push(indent + l + tag));
    });
    if (closes) out.push("}");
    if (lang === "java" && /\b(List|ArrayList|LinkedList|Map|HashMap|Queue|Deque|ArrayDeque|Iterator|NoSuchElementException|EmptyStackException|Arrays)\b/.test(out.join("\n")))
      out.unshift("import java.util.*;", "");
    return out;
  };
  /* "Θ(1) time · Θ(1) space" for the dock header, from a listing's spec */
  function costBadge(L) {
    const sp = (L && L.spec) || {};
    const strip = (h) => String(h || "").replace(/<[^>]*>/g, "").split(/: |; /)[0].trim();   /* "Θ(n): why" → "Θ(n)" */
    const t = strip(sp.time), sMem = strip(sp.space);
    if (!t && !sMem) return "";
    return '<span class="cost-badge" title="worst case">' + (t ? "<b>" + t + "</b> time" : "") + (t && sMem ? " · " : "") + (sMem ? "<b>" + sMem + "</b> space" : "") + "</span>";
  }

  DSA.CodeDock = function (mount, listings, opts) {
    const o = opts || {};
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    /* the dock stays out of sight until the reader runs an operation (see Player.showControls) */
    m.classList.add("code-dock", "waiting");
    m.innerHTML = "";
    const head = DSA.el("div", { class: "code-head" });
    const title = DSA.el("div", { class: "code-title" });
    const sw = DSA.el("div", { class: "code-sw" });
    const hide = DSA.el("button", { class: "ghost code-hide", type: "button", title: "Show / hide the code" });
    const body = DSA.el("div", { class: "code-body" });
    head.appendChild(title);
    head.appendChild(sw);
    if (o.collapsible !== false) head.appendChild(hide);
    m.appendChild(head);
    m.appendChild(body);

    /* a dock made with collapsible: false has no toggle and always shows its code */
    const paintHidden = () => {
      const hidden = codeHidden && o.collapsible !== false;
      m.classList.toggle("collapsed", hidden);
      hide.textContent = hidden ? "show code" : "hide code";
      hide.classList.toggle("primary", hidden);
    };
    hide.addEventListener("click", () => {
      codeHidden = !codeHidden;
      docks.forEach((d) => d.paintHidden());
    });

    let key = null, block = null, spec = null;
    const specMount = DSA.el("div", { class: "code-spec-wrap" });
    const codeMount = DSA.el("div");
    body.appendChild(specMount);
    body.appendChild(codeMount);

    /* every function of each structure, for the Java tests that compile it (DSA.fullSource); not shown */
    const groups = o.full || [];
    DSA.onLang(() => { if (spec && specMount.isConnected) spec.repaint(); });
    const api = {
      listings: listings,
      paintHidden: () => { paintHidden(); if (api.onState) api.onState(); },
      setWaiting(on) { m.classList.toggle("waiting", !!on); if (api.onState) api.onState(); },
      groups: groups,
      recvOf: (k) => (typeof o.recv === "function" ? o.recv(k) : o.recv || null),
      get current() { return key; },
      /** Switch to listing `k` (no-op if already showing it). */
      show(k) {
        if (k === key && block) return api;
        const L = listings[k];
        if (!L) return api;
        key = k;
        /* just the method: "insert(i, x) · fixed capacity" → "insert(i, x)"; the tab already says which version */
        title.innerHTML = '<span class="mono">' + String(L.title || k).split(" · ")[0] + "</span>" + costBadge(L);
        specMount.innerHTML = "";
        spec = specBox(L, k, o.recv || null, o.args || null);
        specMount.appendChild(spec.node);
        block = DSA.CodeBlock(codeMount, L, { switcherMount: sw });
        return api;
      },
      highlight(line) { if (block) block.highlight(line == null ? null : line); },
      /** Follow a frame: switch listing if it names one, then highlight its line and show its call. */
      sync(f) {
        if (!f) return;
        if (f.code) api.show(f.code);
        if (spec) spec.setArgs(f._args || null);
        api.highlight(f.line);
      },
    };
    api.el = m;
    docks.push(api);
    paintHidden();
    if (o.initial) api.show(o.initial);
    else { const first = Object.keys(listings)[0]; if (first) api.show(first); }
    return api;
  };
  const docks = [];
  DSA._docks = docks;   /* exposed for the headless test harness */

  /* ------------------------------------------------------------
     Code beside the picture. On a wide screen, an open code dock
     becomes a column on the left with the visualizer on the right,
     instead of a full-width strip above it whose right side is empty.
     The dock and the boxes after it (up to the player) are wrapped once:
       <div class="code-side"> dock <div class="code-side-vis"> ... </div></div>
     and the wrapper only lays them out side by side (.side) while the
     code is shown and there is room; otherwise it is a plain block, so a
     phone, or hidden code, looks exactly as before.
     ------------------------------------------------------------ */
  const SIDE_MIN = 980;
  function sideWrap(api) {
    const dock = api.el;
    if (!dock || !dock.closest(".panel.main") || dock.parentElement.classList.contains("code-side")) return;
    const wrap = DSA.el("div", { class: "code-side" }), vis = DSA.el("div", { class: "code-side-vis" });
    const move = [];
    for (let n = dock.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === 1 && (n.matches(".player, #player") || n.querySelector(".player, #player"))) break;
      move.push(n);
    }
    dock.parentElement.insertBefore(wrap, dock);
    wrap.appendChild(dock);
    wrap.appendChild(vis);
    move.forEach((n) => vis.appendChild(n));
    const panel = wrap.closest(".panel");
    /* the code shown or hidden, or moved beside the picture, changes the panel's height for a reason:
       let it find its height again (Player._sync otherwise never lets it shrink during a run) */
    const unhold = () => { if (panel) { panel._holdRun = null; panel.style.minHeight = ""; } };
    const update = () => {
      const c = dock.classList;
      const on = wrap.clientWidth >= SIDE_MIN && !c.contains("collapsed") && !c.contains("waiting") && !c.contains("editing");
      unhold();
      if (wrap.classList.contains("side") === on) return;
      wrap.classList.toggle("side", on);
      /* the picture has a new width: draw the step again so it fits it */
      players.forEach((p) => { if (p.scope && p.scope.contains(wrap) && p.isVisible()) { try { p._sync(); } catch (e) { console.error(e); } } });
    };
    /* at once when the code is shown, hidden or appears (a run that starts then scrolls to the right place),
       and after any other change to the dock, such as the editor opening */
    api.onState = update;
    new MutationObserver(update).observe(dock, { attributes: true, attributeFilter: ["class"] });
    let lastW = 0;
    if (window.ResizeObserver) new ResizeObserver(() => { if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; update(); } }).observe(wrap);
    update();
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(() => docks.forEach(sideWrap), 0));

  /* ------------------------------------------------------------
     Function pickers. A toolbar marked data-ops does not lay out every
     operation as a button. It shows one "function" menu; the buttons stay
     in the page, hidden, and Run clicks the chosen one. Each button says
     which inputs it reads (data-needs="val idx"), and an input field
     (data-in="val") shows only while the chosen function needs it. A bar
     shared by several tabs (data-tab="single double") gets one menu per tab,
     and a button with its own data-tab only appears in those tabs' menus.
     ------------------------------------------------------------ */
  function opsPickers() {
    DSA.$$(".panel.main [data-ops]").forEach((bar) => {
      const main = bar.parentElement;
      const ids = bar.dataset.tab ? bar.dataset.tab.split(/\s+/) : [""];
      const btns = Array.from(bar.children).filter((b) => b.tagName === "BUTTON" && !b.hasAttribute("data-more"));
      if (!btns.length) return;
      const firstField = main.firstElementChild;
      ids.forEach((id) => {
        const mine = btns.filter((b) => !b.dataset.tab || b.dataset.tab.split(/\s+/).indexOf(id) >= 0);
        const sel = DSA.el("select", { "aria-label": "Function", style: "width:auto" });
        sel.appendChild(DSA.el("option", { value: "", text: "Choose a function…" }));
        mine.forEach((b) => sel.appendChild(DSA.el("option", { value: b.id, text: b.textContent.trim() })));
        const pick = DSA.el("div", { class: "field" });
        pick.appendChild(DSA.el("label", { text: "function" }));
        pick.appendChild(sel);
        const run = DSA.el("button", { type: "button", class: "primary", text: "▶ Run", hidden: "" });
        [pick, run].forEach((n) => { if (id) n.dataset.tab = id; });
        main.insertBefore(pick, firstField);
        main.insertBefore(run, bar);
        /* the inputs this menu's tab shows, and which of them the chosen function reads */
        const inputs = DSA.$$("[data-in]", main).filter((f) => !f.dataset.tab || f.dataset.tab.split(/\s+/).indexOf(id) >= 0);
        const chosen = () => (sel.value ? document.getElementById(sel.value) : null);
        const update = () => {
          const b = chosen();
          const need = b ? (b.dataset.needs || "").split(/\s+/) : [];
          inputs.forEach((f) => f.classList.toggle("need-off", need.indexOf(f.dataset.in) < 0));
          run.hidden = !b;
        };
        sel.addEventListener("change", update);
        run.addEventListener("click", () => { const b = chosen(); if (b) b.click(); });
        update();
        /* a bar with no data-tab is shown by the page's own script (display none / flex): its menu follows it,
           and the inputs it shares with the other bars are re-set for it when it comes back */
        if (!id) {
          const follow = () => {
            const on = bar.style.display !== "none";
            pick.style.display = on ? "" : "none";
            run.style.display = on ? "" : "none";
            if (on) update();
          };
          new MutationObserver(follow).observe(bar, { attributes: true, attributeFilter: ["style"] });
          follow();
        }
      });
      btns.forEach((b) => b.classList.add("ops-hidden"));
    });
  }
  document.addEventListener("DOMContentLoaded", opsPickers);
  /** for the headless tests: choose, in the visible function menu, the function whose label matches `re`,
      and return the Run button that now runs it (null when no visible menu has one) */
  DSA._pickOp = function (re) {
    const sel = DSA.$$(".panel.main select[aria-label='Function']").find((x) => x.offsetParent && Array.from(x.options).some((o) => o.value && re.test(o.text)));
    if (!sel) return null;
    sel.value = Array.from(sel.options).find((o) => o.value && re.test(o.text)).value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return DSA.$$(".panel.main button.primary").find((b) => b.offsetParent && b.textContent.includes("Run")) || null;
  };

  /* ------------------------------------------------------------
     Options menus. A toolbar keeps its operations on one line; the
     controls marked data-more (sizes, presets, random, clear...) go into
     a "⋯ More" menu at the end of the toolbar they sit in, so a tab
     only ever shows its own. A bar still too wide scrolls sideways.
     The menu floats (position: fixed), so the scrolling bar can't clip it.
     ------------------------------------------------------------ */
  function optionsMenus() {
    const bars = new Map();
    DSA.$$(".panel.main [data-more]").forEach((el) => {
      const bar = el.parentElement && el.parentElement.closest(".toolbar");
      if (!bar) return;
      if (!bars.has(bar)) bars.set(bar, []);
      bars.get(bar).push(el);
    });
    bars.forEach((items, bar) => {
      const det = DSA.el("details", { class: "tb-more" });
      const sum = DSA.el("summary", { text: "⋯", title: "More: settings, presets, random and clear", "aria-label": "More" });
      const menu = DSA.el("div", { class: "tb-more-menu", role: "group", "aria-label": "More" });
      items.forEach((el) => menu.appendChild(el));
      det.appendChild(sum);
      det.appendChild(menu);
      bar.appendChild(det);
      det._place = () => {
        const r = sum.getBoundingClientRect(), w = menu.offsetWidth;
        menu.style.top = Math.round(r.bottom + 6) + "px";
        menu.style.left = Math.round(Math.max(8, Math.min(innerWidth - w - 8, r.right - w))) + "px";
      };
      det.addEventListener("toggle", () => {
        if (!det.open) return;
        DSA.$$(".tb-more[open]").forEach((o) => { if (o !== det) o.open = false; });
        det._place();
      });
      /* a button runs something, so the menu closes; a field, a menu or a checkbox keeps it open */
      menu.addEventListener("click", (e) => { if (e.target.closest("button")) det.open = false; });
    });
    if (!bars.size) return;
    const openOnes = () => DSA.$$(".tb-more[open]");
    document.addEventListener("pointerdown", (e) => openOnes().forEach((d) => { if (!d.contains(e.target)) d.open = false; }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") openOnes().forEach((d) => { d.open = false; d.querySelector("summary").focus(); }); });
    const replace = () => openOnes().forEach((d) => d._place());
    addEventListener("scroll", replace, { passive: true });
    addEventListener("resize", replace);
    DSA.$$(".panel.main .toolbar").forEach((b) => b.addEventListener("scroll", replace, { passive: true }));
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(optionsMenus, 0));

  /* ---------------- per-tab visibility ---------------- */
  /** Show every [data-tab] element whose space-separated list names `id`; hide the rest. */
  DSA.showFor = function (id, root) {
    DSA.$$("[data-tab]", root).forEach((n) => {
      const on = n.dataset.tab.split(/\s+/).indexOf(id) >= 0;
      n.style.display = on ? "" : "none";
    });
  };

  /** Study notes show only the selected part. In #about, [data-part="a b"] shows for those parts;
      a table's data-cols lists each column's parts ("_" = always, "a,b" = either), and other parts'
      columns are hidden. A row left with nothing but "–" disappears too. */
  DSA.notesFor = function (id) {
    const box = DSA.$("#about");
    if (!box) return;
    const has = (list, sep) => list === "_" || list.split(sep).indexOf(id) >= 0;
    const show = (n, on) => (n.style.display = on ? "" : "none");
    DSA.$$("[data-part]", box).forEach((n) => { if (n.tagName !== "TR") show(n, has(n.dataset.part, /\s+/)); });
    DSA.$$("table", box).forEach((t) => {
      const cols = t.dataset.cols ? t.dataset.cols.split(/\s+/).map((c) => has(c, ",")) : null;
      DSA.$$("tr", t).forEach((tr) => {
        let at = 0, dashes = true, cells = 0;
        Array.from(tr.cells).forEach((td, k) => {
          const span = +(td.dataset.span || (td.dataset.span = td.colSpan));
          const vis = cols ? cols.slice(at, at + span).filter(Boolean).length : span;
          at += span;
          show(td, vis > 0);
          if (vis > 0) { td.colSpan = vis; if (k > 0) { cells++; if (td.textContent.trim() !== "–") dashes = false; } }
        });
        show(tr, (!tr.dataset.part || has(tr.dataset.part, /\s+/)) && !(cells && dashes));
      });
    });
  };

  /* ---------------- LeetCode practice ----------------
     Practice({ key: { label, note?, items: [[number, "Title", "slug", "Easy|Medium|Hard", "why"], ...] } })
     registers a page's lists; practiceShow(key) shows the list for the part the reader is on.
     The panel goes at the end of the page's About section (or right below the visualizer panel). */
  let pData = null, pKey = null;
  function practiceMount() {
    let m = DSA.$("#practice");
    if (!m) {
      const about = DSA.$("#about .about-body");
      const host = DSA.$("#player") && DSA.$("#player").closest(".panel");
      if (!about && !host) return null;
      m = DSA.el("section", { class: "panel", id: "practice" });
      if (about) about.appendChild(m);
      else host.parentNode.insertBefore(m, host.nextSibling);
    }
    return m;
  }
  function practiceRender() {
    if (!pData || pKey == null) return;
    const m = practiceMount();
    if (!m) return;
    const d = pData[pKey];
    m.innerHTML = "";
    m.style.display = d ? "" : "none";
    if (!d) return;
    m.appendChild(DSA.el("div", { class: "panel-title" }, [
      DSA.el("h3", { html: "Practice on LeetCode <span class='muted' style='font-weight:400'>· " + d.label + "</span>" }),
      DSA.el("span", { class: "hint", text: "opens in a new tab" }),
    ]));
    if (d.note) m.appendChild(DSA.el("p", { class: "small muted", style: "margin:-.3rem 0 .7rem", html: d.note }));
    const list = DSA.el("div", { class: "lc-list" });
    (d.items || []).forEach(([n, title, slug, diff, why]) => {
      const a = DSA.el("a", { class: "lc-item", href: "https://leetcode.com/problems/" + slug + "/", target: "_blank", rel: "noopener" });
      a.innerHTML = '<span class="lc-top"><span class="lc-num">' + n + '.</span> <span class="lc-title">' + title + '</span> <span class="lc-diff ' + diff.toLowerCase() + '">' + diff + "</span></span>" +
        (why ? '<span class="lc-why">' + why + "</span>" : "");
      /* a card holds the link and, for a signed-in student, a status menu (account.js) that can't go inside a link */
      list.appendChild(DSA.el("div", { class: "lc-cell", "data-n": String(n), "data-title": title }, [a]));
    });
    m.appendChild(list);
    DSA.collapsible(m);
    DSA.emit("practice", { mount: m });
  }
  DSA.Practice = function (data) { pData = data; practiceRender(); };

  /* ---------------- hide / show any box ----------------
     Every box on a page except the visualizer itself gets a "show / hide" button in its heading row. Boxes start
     hidden, so a newcomer sees the visualizer and a list of headings, and opens what they want; the boxes a
     student opens are remembered per page. A hidden box keeps its heading. Boxes with their own toggle (the code
     dock, the step note, the playground's Close) are left alone. Printing shows every box. */
  const LS_BOXES = "dsa.shownBoxes.v1";
  const PAGE_KEY = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");
  try { localStorage.removeItem("dsa.hiddenBoxes.v1"); } catch (e) {}  /* the old "hidden" list, from before boxes started hidden */
  const readShown = () => { try { return JSON.parse(localStorage.getItem(LS_BOXES) || "{}") || {}; } catch (e) { return {}; } };
  const isHidden = (key) => (readShown()[PAGE_KEY] || []).indexOf(key) < 0;
  function rememberHidden(key, hidden) {
    try {
      const all = readShown();
      const list = (all[PAGE_KEY] || []).filter((k) => k !== key);
      if (!hidden) list.push(key);
      if (list.length) all[PAGE_KEY] = list; else delete all[PAGE_KEY];
      localStorage.setItem(LS_BOXES, JSON.stringify(all));
    } catch (e) {}
  }
  const slug = (s) => s.split("·")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  let boxSeq = 0;
  /** collapsible(box): adds the hide button to box's heading row. Safe to call again after the box is redrawn. */
  DSA.collapsible = function (box) {
    if (!box || box.classList.contains("main") || box.classList.contains("playground")) return;
    let head = Array.from(box.children).find((c) => c.classList.contains("panel-title") || /^H[23]$/.test(c.tagName));
    if (!head) return;
    if (/^H[23]$/.test(head.tagName)) {
      const row = DSA.el("div", { class: "panel-title" });
      box.insertBefore(row, head);
      row.appendChild(head);
      head = row;
    }
    if (head.querySelector(":scope > .box-hide")) return;
    head.classList.add("box-head");
    const h = head.querySelector("h2, h3");
    const name = (h ? h.textContent : "").split("·")[0].trim() || "this box";
    const key = box.dataset.box || (box.dataset.box = box.id || slug(name) || "box" + boxSeq++);
    const btn = DSA.el("button", { type: "button", class: "ghost box-hide" });
    head.appendChild(btn);
    const paint = (hidden) => {
      box.classList.toggle("box-hidden", hidden);
      btn.textContent = hidden ? "show" : "hide";
      btn.classList.toggle("primary", hidden);
      btn.setAttribute("aria-expanded", String(!hidden));
      btn.setAttribute("aria-label", (hidden ? "Show " : "Hide ") + name);
    };
    paint(isHidden(key));
    btn.addEventListener("click", () => {
      const hidden = !box.classList.contains("box-hidden");
      paint(hidden);
      rememberHidden(key, hidden);
    });
  };
  document.addEventListener("DOMContentLoaded", () => {
    DSA.$$("main > .panel, main > .about, .about-body .panel").forEach(DSA.collapsible);
  });

  DSA.practiceShow = function (key) { pKey = key; practiceRender(); };
  /** every problem number this page lists, in any part (account.js counts them for the progress map) */
  DSA.practiceNumbers = () => (pData ? Array.from(new Set(Object.values(pData).flatMap((d) => (d.items || []).map((it) => it[0])))) : []);

  /* ---------------- segmented toggle ---------------- */
  /** Segmented(mount, [{id,label}], onChange, initialId): a small pill switch (mode pickers). */
  DSA.Segmented = function (mount, items, onChange, initial) {
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    m.className = "seg";
    m.innerHTML = "";
    let cur = null;
    const btns = items.map((it) =>
      DSA.el("button", { type: "button", text: it.label, "data-id": it.id, title: it.desc || "", onclick: () => pick(it.id) })
    );
    btns.forEach((b) => m.appendChild(b));
    function pick(id, silent) {
      cur = id;
      btns.forEach((b) => b.classList.toggle("active", b.dataset.id === id));
      if (!silent) onChange(id);
    }
    pick(initial || items[0].id, true);
    return { pick, get current() { return cur; } };
  };

  /* ---------------- a row of array cells ---------------- */
  /**
   * cells(values, opts) → element. The one array picture every module uses.
   *   marks   { index: stateClass }
   *   ptrs    { index: "label under the cell" }
   *   live    (v, i) => bool: false draws an empty dashed slot (default: v != null)
   *   show    (v, i) => text (default: the value, or "·" when not live)
   *   label   caption above the row
   *   index   false to hide the index labels
   *   start   first index label (default 0)
   *   ghost   (i) => bool: dim this cell
   *   w, h    cell size in px
   */
  DSA.cells = function (values, opts) {
    const o = opts || {};
    const marks = o.marks || {}, ptrs = o.ptrs || {};
    const live = o.live || ((v) => v != null);
    const wrap = DSA.el("div", { class: "cells-wrap" });
    if (o.label) wrap.appendChild(DSA.el("div", { class: "cells-cap", html: o.label }));
    const row = DSA.el("div", { class: "cells" + (o.index === false ? "" : " indexed") + (Object.keys(ptrs).length || o.roomBelow ? " pointed" : "") });
    values.forEach((v, i) => {
      const on = live(v, i);
      const text = o.show ? o.show(v, i) : on ? v : "·";
      const c = DSA.el("div", {
        class: "cell " + (marks[i] || "") + (on ? " filled" : " empty") + (o.ghost && o.ghost(i) ? " ghost" : ""),
        text: text,
      });
      if (o.w) c.style.setProperty("--cw", o.w + "px");   /* sizes are variables, so DSA.fit can scale them */
      if (o.h) c.style.setProperty("--ch", o.h + "px");
      if (o.index !== false) c.appendChild(DSA.el("span", { class: "idx", text: (o.start || 0) + i }));
      if (ptrs[i]) c.appendChild(DSA.el("span", { class: "ptr", text: ptrs[i] }));
      row.appendChild(c);
    });
    if (!values.length) row.appendChild(DSA.el("div", { class: "small muted", text: o.emptyText || "(empty)" }));
    wrap.appendChild(row);
    return wrap;
  };

  /* ---------------- a call stack, one card per frame ---------------- */
  /**
   * callStack(frames, opts) → element. frames: [{ id, label, vars: {name: value}, wait }], bottom first.
   *   opts.returning  id of the frame that is returning right now (drawn green, or red with opts.err)
   *   opts.retVal     what it returns
   *   opts.fmt        value formatter
   *   opts.compact    smaller cards
   *   opts.max        show at most this many frames from the top (default 6)
   */
  DSA.callStack = function (frames, opts) {
    const o = opts || {};
    const fmt = o.fmt || ((v) => String(v));
    /* horizontal: one row, the first call on the left and the running one on the right */
    const col = DSA.el("div", { class: "frame-stack" + (o.horizontal ? " h" : "") });
    const max = o.max || 6;
    if (!frames || !frames.length) {
      if (o.emptyText !== "") col.appendChild(DSA.el("p", { class: "small muted", text: o.emptyText || "The call stack is empty." }));
      return col;
    }
    frames.forEach((fr, k) => {
      const top = k === frames.length - 1;
      if (frames.length > max + 1 && k < frames.length - max) {
        if (k === 0) col.appendChild(DSA.el("div", { class: "small muted", text: "… " + (frames.length - max + (o.hidden || 0)) + (o.horizontal ? " earlier frame(s)" : " more frame(s) below") }));
        return;
      }
      const returning = o.returning != null && o.returning === fr.id;
      const cls = returning ? (o.err ? "err" : "ret") : top ? "active" : "wait";
      const card = DSA.el("div", { class: "frame-card " + cls + (o.compact ? " compact" : "") });
      const tag = returning ? (o.err ? "throws" : "returning") : top ? "running" : "waiting";
      card.appendChild(DSA.el("div", { class: "fc-head" }, [DSA.el("span", { class: "mono", text: fr.label }), DSA.el("span", { class: "fc-tag", text: tag })]));
      const vars = Object.keys(fr.vars || {});
      if (vars.length) card.appendChild(DSA.el("div", { class: "fc-vars mono", text: vars.map((k2) => k2 + "\u00a0=\u00a0" + fmt(fr.vars[k2])).join("   ") }));   /* a line breaks between variables, never inside one */
      if (returning) card.appendChild(DSA.el("div", { class: "fc-wait mono", text: o.err ? "✗ throws an exception" : "↩ returns " + o.retVal }));
      else if (fr.wait) card.appendChild(DSA.el("div", { class: "fc-wait mono", text: "⏳ " + fr.wait }));
      col.appendChild(card);
    });
    return col;
  };

  /* ---------------- a binary tree drawn from an index function ---------------- */
  /**
   * heapTree(n, opts) → svg. Draws a complete binary tree with n nodes laid out by
   * level, as used for heaps.  opts: { label(i), marks{i:cls}, dim(i), sub(i), r }
   */
  DSA.heapTree = function (n, opts) {
    const o = opts || {};
    const r = o.r || 17;
    const maxD = n ? Math.floor(Math.log2(n)) : 0;
    const W = Math.max(340, Math.pow(2, maxD) * 52 + 40);
    const H = 46 + maxD * 66 + 30;
    const svg = DSA.svg("svg", { class: "canvas", viewBox: "0 0 " + W + " " + H, width: W, height: H });
    const pos = (i) => {
      const d = Math.floor(Math.log2(i + 1));
      const k = i - (Math.pow(2, d) - 1);
      return { x: ((k + 0.5) * (W - 30)) / Math.pow(2, d) + 15, y: 32 + d * 66 };
    };
    for (let i = 1; i < n; i++) {
      const a = pos(Math.floor((i - 1) / 2)), b = pos(i);
      const dim = o.dim && o.dim(i);
      svg.appendChild(DSA.sLine(a.x, a.y + r, b.x, b.y - r, "edge " + (dim ? "dim" : (o.edge && o.edge(i)) || "")));
    }
    for (let i = 0; i < n; i++) {
      const p = pos(i);
      const g = DSA.svg("g", { opacity: o.dim && o.dim(i) ? 0.4 : 1 });
      g.appendChild(DSA.svg("circle", { cx: p.x, cy: p.y, r: r, class: "node-c " + ((o.marks && o.marks[i]) || "") }));
      g.appendChild(DSA.sText(p.x, p.y, o.label ? o.label(i) : i, { "font-size": 12 }));
      const sub = o.sub ? o.sub(i) : i;
      if (sub !== "" && sub != null) g.appendChild(DSA.sText(p.x, p.y + r + 10, sub, { class: "lbl-s", "font-size": 9 }));
      svg.appendChild(g);
    }
    if (!n) svg.appendChild(DSA.sText(W / 2, 40, o.emptyText || "empty", { class: "lbl-s" }));
    return svg;
  };

  /* ---------------- tab strip ---------------- */
  DSA.Tabs = function (mount, items, onChange) {
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    m.className = "tabs";
    m.innerHTML = "";
    const btns = items.map((it, i) =>
      DSA.el("button", {
        text: it.label,
        onclick: () => pick(i),
      })
    );
    btns.forEach((b) => m.appendChild(b));
    let cur = -1;
    function pick(i) {
      if (i === cur) return;
      cur = i;
      btns.forEach((b, k) => b.classList.toggle("active", k === i));
      onChange(items[i].id, i);
      DSA.emit("tab", { label: items[i].label });
    }
    pick(0);
    return { pick, get current() { return items[cur] && items[cur].id; } };
  };

  /* ============================================================
     Player: scrubs a recorded frame list
     opts: { mount, render(frame, index, frames), delay, onIdle }
       onIdle() runs when Play is pressed while nothing is loaded yet:
       a page either loads something to play or explains what to press.
     Frame is any object; by convention `frame.note` is the caption.
     ============================================================ */
  const players = [];
  DSA._players = players;   /* exposed for the headless test harness */

  /* ------------------------------------------------------------
     "Which operation is this?": the toolbar button whose click produced
     the animation on screen gets .current. A click that loads nothing
     (clear, random, a tab switch) or an example clears it again.
     ------------------------------------------------------------ */
  let clicked = null, loadedByClick = false;
  const isOp = (b) => b && b.closest(".toolbar") && !b.matches(".danger, [data-tool]") && !b.closest(".seg, .lang-switch, .code-dock, .player");
  const IGNORE = ".lang-switch, .code-dock, .player, .seg, [data-tool]";
  function markCurrent() {
    loadedByClick = true;
    document.querySelectorAll("button.current").forEach((x) => x.classList.remove("current"));
    if (isOp(clicked)) clicked.classList.add("current");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button");
    if (!b || b.closest(IGNORE)) return;
    clicked = b; loadedByClick = false;
    setTimeout(() => {
      if (!loadedByClick) document.querySelectorAll("button.current").forEach((x) => x.classList.remove("current"));
      clicked = null;
    }, 0);
  }, true);

  /* The step controls (play, step, speed, slider) only appear once the reader runs something.
     A load counts as "the reader ran something" when it follows a click, a changed field or typing
     within a moment (recursion rebuilds its trace a little after you stop typing). */
  let lastUser = -1e9;
  ["click", "change", "input"].forEach((t) =>
    document.addEventListener(t, (e) => { if (e.isTrusted !== false && !(e.target.closest && e.target.closest(".player"))) lastUser = performance.now(); }, true)
  );

  DSA.Player = function Player(opts) {
    const self = this;
    this.frames = [{ note: "Pick an operation above to load its steps." }];
    this.index = 0;
    this.playing = false;
    this.speed = 1;
    this.baseDelay = opts.delay || 620;
    this.render = opts.render || function () {};
    this.onFrame = opts.onFrame || null;
    this.code = opts.code || null;      /* a CodeDock this player drives */
    this.onIdle = opts.onIdle || null;
    const mount = typeof opts.mount === "string" ? DSA.$(opts.mount) : opts.mount;
    this.mount = mount;

    mount.classList.add("player");
    mount.innerHTML =
      '<div class="player-ctl" data-a="ctl" hidden>' +
      '<div class="player-row">' +
      '<button class="icon" data-a="first" title="First frame">&#124;&#9664;</button>' +
      '<button class="icon" data-a="prev" title="Step back (&larr;)">&#9664;</button>' +
      '<button class="primary" data-a="play" style="min-width:6.2rem" title="Play / pause (space)">&#9654; Play</button>' +
      '<button class="icon" data-a="next" title="Step forward (&rarr;)">&#9654;</button>' +
      '<button class="icon" data-a="last" title="Last frame">&#9654;&#124;</button>' +
      '<div class="sep"></div>' +
      '<div class="field"><label>Speed</label><select data-a="speed" aria-label="Playback speed">' +
      '<option value="0.35">0.35&times;</option><option value="0.6">0.6&times;</option>' +
      '<option value="1" selected>1&times;</option><option value="2">2&times;</option>' +
      '<option value="4">4&times;</option></select></div>' +
      '<div class="player-tools" data-a="tools"></div>' +
      '<div class="spacer" style="flex:1"></div>' +
      '<div class="counter" data-a="counter">0 / 0</div>' +
      "</div>" +
      '<div class="track"><input type="range" min="0" max="0" value="0" data-a="track" aria-label="Step"></div>' +
      "</div>" +
      '<div class="note" data-a="note" role="status" aria-live="polite"></div>' +
      '<div class="player-extra" data-a="extra"></div>';

    const q = (a) => mount.querySelector('[data-a="' + a + '"]');
    const btnPlay = q("play"), track = q("track"), counter = q("counter"), note = q("note"), ctl = q("ctl");
    this.ctlShown = false;
    this.tools = q("tools");            /* addons put their controls here */
    this.extra = q("extra");            /* and their panels here, under the caption */
    this.gate = null;                   /* gate(index) → true holds the player on this frame (unused since the quiz was archived) */
    this.frameHooks = [];               /* run after every painted frame */
    this.loadHooks = [];                /* run when a new frame list is loaded */
    this.noMotion = false;
    let prevIndex = 0, prevFrames = null, heldWidth = 0;
    /* noteHeld: while one run is stepped, the caption may grow but never shrink. A shorter caption would make the
       page shorter, and a reader scrolled to the bottom (pages are short now that boxes start hidden) would be
       pulled up by the browser. The height comes from a ResizeObserver, after the browser's own layout: reading
       offsetHeight during a step would force a layout in the middle of motion.js's before/after comparison. */
    let noteMax = 0;
    if ("ResizeObserver" in window) {
      new ResizeObserver((entries) => {
        const e = entries[entries.length - 1];
        const h = e.borderBoxSize && e.borderBoxSize[0] ? e.borderBoxSize[0].blockSize : e.target.offsetHeight;
        if (h > noteMax + 0.5) { noteMax = h; note.style.minHeight = h + "px"; }
      }).observe(note);
    }
    /* the code docks appear and disappear with a module's step controls: only once an operation has run */
    this.showControls = function (on) {
      this.ctlShown = !!on; ctl.hidden = !on;
      if (opts.code) docks.forEach((d) => d.setWaiting(!on));
    };

    mount.addEventListener("click", (e) => {
      const a = e.target.closest("button[data-a]");
      if (!a) return;
      const act = a.dataset.a;
      if (act === "play") self.toggle();
      else if (act === "next") { self.pause(); self.step(1); }
      else if (act === "prev") { self.pause(); self.step(-1); }
      else if (act === "first") { self.pause(); self.goto(0); }
      else if (act === "last") { self.pause(); self.goto(self.frames.length - 1); }
    });
    q("speed").addEventListener("change", (e) => {
      self.speed = parseFloat(e.target.value);
      if (self.playing) self._arm();
    });
    /* dragging the timeline jumps, it does not animate */
    track.addEventListener("input", (e) => { self.pause(); self.goto(parseInt(e.target.value, 10)); });

    this._sync = function () {
      const f = this.frames[this.index] || {};
      track.max = Math.max(0, this.frames.length - 1);
      track.value = this.index;
      counter.textContent = this.index + 1 + " / " + this.frames.length;
      note.innerHTML = f.note == null ? "" : f.note;
      btnPlay.innerHTML = this.playing ? "&#10073;&#10073; Pause" : "&#9654; Play";
      try { if (this.code) this.code.sync(f); } catch (err) { console.error(err); }
      /* one step forward or back slides things to their new places; a jump just repaints */
      const oneStep = prevFrames === this.frames && Math.abs(this.index - prevIndex) === 1;
      /* Within one run the panel never gets shorter. A repaint that briefly shrinks the page (Safari
         lays it out mid-repaint) would otherwise pull the reader's screen up on every step, when they
         are scrolled near the bottom. A new run, or a new window width, lets it find its height again.
         Nothing is measured during a repaint (a forced layout there starts the bars' height transitions
         early); the height is read on the next animation frame, once the browser has laid the step out. */
      const sc = this.scope && this.scope.style ? this.scope : null;
      if (sc) {
        if (sc._holdRun !== this.frames || sc._holdW !== innerWidth) { sc._holdRun = this.frames; sc._holdW = innerWidth; sc._holdH = 0; sc.style.minHeight = ""; }
        else if (sc._holdH) sc.style.minHeight = sc._holdH + "px";
      }
      const motion = DSA.motion ? DSA.motion.begin(this, oneStep && !this.noMotion) : null;
      try { this.render(f, this.index, this.frames); } catch (err) { console.error(err); }
      try { DSA.fit(this.scope, this.frames); } catch (err) { console.error(err); }
      if (motion) motion.play();
      if (sc && !sc._holdAsk) {
        sc._holdAsk = true;
        requestAnimationFrame(() => {
          sc._holdAsk = false;
          if (!sc._holdRun || !sc.isConnected) return;
          sc._holdH = Math.max(sc._holdH || 0, Math.ceil(sc.getBoundingClientRect().height));
          sc.style.minHeight = sc._holdH + "px";
        });
      }
      /* a new run, or a new window width, lets the caption find its height again (see noteHeld below) */
      if (prevFrames !== this.frames || heldWidth !== innerWidth) { noteMax = 0; note.style.minHeight = ""; heldWidth = innerWidth; }
      prevIndex = this.index; prevFrames = this.frames;
      if (this.onFrame) this.onFrame(f, this.index);
      this.frameHooks.forEach((fn) => { try { fn(f, this.index); } catch (err) { console.error(err); } });
    };

    this.load = function (frames, autoplay) {
      setActive(this);          /* running an operation claims the keyboard too */
      markCurrent();
      this.pause();
      this.frames = frames && frames.length ? frames : [{ note: "No steps were produced." }];
      /* a single still frame (a tab switch, clear, a new random structure) has nothing to step through */
      if (this.frames.length < 2) this.showControls(false);
      else if (performance.now() - lastUser < 1500) this.showControls(true);
      DSA.annotateArgs(this.frames);
      this.index = 0;
      this.loadHooks.forEach((fn) => { try { fn(this.frames); } catch (err) { console.error(err); } });
      if (this.frames.length > 1) DSA.emit("run", { player: this, user: performance.now() - lastUser < 1500, keys: Array.from(new Set(this.frames.map((f) => f.code).filter((k) => typeof k === "string"))) });
      this._sync();
      if (autoplay !== false) {
        if (this.frames.length > 1 && performance.now() - lastUser < 1500) this._reveal();
        this.play();
      }
      return this;
    };
    this.goto = function (i) {
      this.index = DSA.clamp(i, 0, this.frames.length - 1);
      this._sync();
    };
    this.step = function (d) {
      if (d > 0 && this.gate && this.gate(this.index)) return;
      this.goto(this.index + d);
    };
    this.play = function () {
      if (this.frames.length < 2) {
        if (this.onIdle) this.onIdle();
        else DSA.toast("Nothing to play yet. Pick an operation above.");
        return;
      }
      if (this.index >= this.frames.length - 1) this.index = 0;
      this.playing = true;
      this._sync();
      this._arm();
    };
    this.pause = function () {
      this.playing = false;
      clearTimeout(this._t);
      if (btnPlay) btnPlay.innerHTML = "&#9654; Play";
    };
    this.toggle = function () {
      if (this.playing) { this.pause(); return; }
      /* pressing Play from the first or last frame starts the run again; resuming mid-run stays put */
      if (this.frames.length > 1 && (this.index === 0 || this.index >= this.frames.length - 1)) this._reveal();
      this.play();
    };
    this._arm = function () {
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        if (!this.playing) return;
        if (this.gate && this.gate(this.index)) return;
        if (this.index < this.frames.length - 1) { this.index++; this._sync(); this._arm(); }
        else this.pause();
      }, Math.max(24, this.baseDelay / this.speed));
    };
    /* Starting a run brings the picture on screen, once. Nothing after that moves the page. */
    this._reveal = function () {
      const stage = DSA.$$(".stage", this.scope).find((s) => s.offsetParent);
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const bar = document.querySelector(".topbar");
      if (r.top >= (bar ? bar.getBoundingClientRect().bottom : 0) && r.bottom <= window.innerHeight) return;
      stage.scrollIntoView({ block: "start" });
    };
    this.isVisible = function () { return !!mount.offsetParent; };
    /* the panel this player belongs to: clicking anywhere in it claims the keyboard */
    this.scope = mount.closest(".panel") || mount;

    players.push(this);
    markMulti();
    DSA.playerAddons.forEach((fn) => { try { fn(self); } catch (err) { console.error(err); } });
    this._sync();
  };

  /* ---------------- which player owns the keyboard ---------------- */
  /* A page can host several players at once (arrays.html has one for the
     dynamic array and one for linked lists, both always on screen), so
     "the first visible one" is not good enough. Keys go to the player you
     last touched; failing that, the one nearest the middle of the viewport. */
  let activePlayer = null;

  function markMulti() {
    /* only show the "keys go here" cue when there is something to choose between */
    document.documentElement.classList.toggle("multi-player", players.length > 1);
  }

  function setActive(p) {
    if (!p || p === activePlayer) return;
    activePlayer = p;
    players.forEach((x) => x.mount.classList.toggle("is-active", x === p));
  }

  function playerAt(node) {
    return players.find((p) => p.scope.contains(node)) || null;
  }

  /* clicking a button, typing in a field, or focusing anything inside a
     panel hands that panel's player the keyboard */
  document.addEventListener("pointerdown", (e) => setActive(playerAt(e.target)), true);
  document.addEventListener("focusin", (e) => setActive(playerAt(e.target)), true);

  function nearestToViewportCentre() {
    const vis = players.filter((p) => p.isVisible());
    if (vis.length < 2) return vis[0] || null;
    const mid = window.innerHeight / 2;
    let best = null, bestD = Infinity;
    vis.forEach((p) => {
      const r = p.mount.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  }

  /* keyboard: space = play/pause, arrows = step, on the active player */
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
    /* on a focused button or link, Space and Enter belong to that control */
    if (e.code === "Space" && t && t.closest && t.closest("button, a, summary")) return;
    let p = activePlayer && activePlayer.isVisible() ? activePlayer : null;
    if (!p) p = nearestToViewportCentre();
    if (!p || !p.ctlShown) return;
    if (e.code === "Space") { e.preventDefault(); setActive(p); p.toggle(); }
    else if (e.code === "ArrowRight") { e.preventDefault(); setActive(p); p.pause(); p.step(1); }
    else if (e.code === "ArrowLeft") { e.preventDefault(); setActive(p); p.pause(); p.step(-1); }
  });

  /* ============================================================
     Recorder: the thing algorithms talk to
     ============================================================ */
  DSA.Recorder = function Recorder(limit) {
    this.frames = [];
    this.limit = limit || 4000;
    this.overflow = false;
  };
  DSA.Recorder.prototype.push = function (frame) {
    if (this.frames.length >= this.limit) { this.overflow = true; return false; }
    this.frames.push(frame);
    return true;
  };

  /* ------------------------------------------------------------
     Rec(snapshot, limit): a Recorder that also remembers which
     code listing and line the algorithm is on.
       r.code("listing")          switch listing (clears the line)
       r.at("anchor").snap({...}) push snapshot() + extras, tagged
     ------------------------------------------------------------ */
  DSA.Rec = function (snapshot, limit) {
    const R = new DSA.Recorder(limit || 3000);
    return {
      frames: R.frames,
      codeKey: null,
      lineKey: null,
      code(k) { this.codeKey = k; this.lineKey = null; return this; },
      at(l) { this.lineKey = l; return this; },
      snap(extra) {
        return R.push(Object.assign(snapshot ? snapshot() : {}, { code: this.codeKey, line: this.lineKey }, extra || {}));
      },
      get overflow() { return R.overflow; },
    };
  };

  /* ============================================================
     Layout helper: assign x/y to a binary tree by in-order index
     node: { left, right, ... }  -> writes _x, _y, _depth
     ============================================================ */
  DSA.layoutBinary = function (root, opts) {
    const o = Object.assign({ gapX: 46, gapY: 62, padX: 26, padY: 30 }, opts || {});
    let col = 0, maxD = 0;
    (function walk(n, d) {
      if (!n) return;
      walk(n.left, d + 1);
      n._x = o.padX + col++ * o.gapX;
      n._y = o.padY + d * o.gapY;
      n._depth = d;
      maxD = Math.max(maxD, d);
      walk(n.right, d + 1);
    })(root, 0);
    return { width: o.padX * 2 + Math.max(1, col) * o.gapX, height: o.padY * 2 + (maxD + 1) * o.gapY, count: col };
  };

  /* "Send feedback": where the reader was, so a bug report says which page / tab / operation */
  function feedbackContext() {
    const parts = [document.title];
    const tab = DSA.$("#tabs button.active, #algo-tabs button.active, #fn-tabs button.active");
    if (tab) parts.push("tab: " + tab.textContent.trim());
    const dock = docks.find((d) => d.current && d.listings[d.current]);
    if (dock) parts.push("running: " + (dock.listings[dock.current].title || dock.current));
    return parts.join(" · ");
  }
  function feedbackHref() {
    if (!DSA.FEEDBACK_URL) return null;
    if (!DSA.FEEDBACK_PAGE_FIELD) return DSA.FEEDBACK_URL;
    try {
      const u = new URL(DSA.FEEDBACK_URL);
      u.searchParams.set("usp", "pp_url");
      u.searchParams.set(DSA.FEEDBACK_PAGE_FIELD, feedbackContext());
      return u.toString();
    } catch (e) { return DSA.FEEDBACK_URL; }
  }
  function feedbackLink(cls, label) {
    const a = DSA.el("a", { class: cls, href: DSA.FEEDBACK_URL || "#", target: "_blank", rel: "noopener", title: "Found a bug or have an idea? Tell me." });
    a.innerHTML = label;
    const refresh = () => { const h = feedbackHref(); if (h) a.href = h; };
    a.addEventListener("mousedown", refresh);      /* also covers middle-click / open in new tab */
    a.addEventListener("focus", refresh);
    a.addEventListener("click", (e) => {
      const h = feedbackHref();
      if (!h) { e.preventDefault(); DSA.toast("The feedback form isn't connected yet. Please check back soon."); return; }
      a.href = h;
    });
    return a;
  }

  /* ------------------------------------------------------------
     fit(scope): use the room a wide screen gives. A picture drawn for
     a narrow column used to sit at the left of a wide stage with empty
     space beside it. After each repaint (before motion measures where
     things landed) every visible stage in scope is measured:
       cells   the stage gets --s, a scale for every .cell, chosen so the
               widest row of cells grows into the free width (1 to 1.5×)
       svg     a picture narrower than its box grows up to 1.4× its
               drawn size, never past the box
     A row that already wraps, or a picture that already fills the box,
     stays as it is, so phones and long arrays look exactly as before.
     Within one run (the same frames) a scale only ever shrinks and the
     stage never gets shorter, so stepping never makes the picture pulse
     or the page below it jump; a new run starts afresh.
     ------------------------------------------------------------ */
  const FIT_CELLS = 1.5, FIT_SVG = 1.4;
  DSA.fit = function (scope, run) {
    DSA.$$(".stage", scope || document).forEach((st) => {
      /* nothing to grow (the sorting bars): leave the stage alone, without even reading its layout,
         which would start the bars' height transition in the middle of a step */
      if (st.dataset.fit === "off" || !st.querySelector(".cell, svg.canvas")) return;
      /* the renderer has just drawn its pictures at their own size: put back this run's size before
         anything below reads the layout, or the page would be shorter for a moment and the browser
         would pull the scroll position up */
      if (run != null && st._fitRun === run && st._fitK) st.querySelectorAll("svg.canvas").forEach((svg, i) => {
        const w = parseFloat(svg.getAttribute("width")), k = st._fitK[i];
        if (w && k > 1.05) { svg.style.width = w * k + "px"; svg.style.marginLeft = svg.style.marginRight = "auto"; }
      });
      if (!st.offsetParent) return;
      const cs = getComputedStyle(st);
      const avail = st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (avail <= 0) return;
      const same = run != null && st._fitRun === run && st._fitW === avail;
      if (!same) { st._fitRun = run; st._fitW = avail; st._fitS = Infinity; st._fitK = []; st._fitH = 0; st.style.minHeight = ""; }
      const cells = st.querySelectorAll(".cell");
      if (cells.length) {
        /* measured at the scale it has now (resetting it to 1 first would shrink the page for a moment,
           and the browser would pull the scroll position up), then divided back to its natural size */
        const cur = parseFloat(st.style.getPropertyValue("--s")) || 1;
        const box = st.getBoundingClientRect();
        let lo = Infinity, hi = -Infinity, rowLen = 0;
        cells.forEach((c) => {
          const r = c.getBoundingClientRect();
          if (!r.width) return;
          lo = Math.min(lo, r.left); hi = Math.max(hi, r.right);
        });
        /* a row that wraps is as long as its cells laid end to end */
        st.querySelectorAll(".cells").forEach((row) => {
          const k = Array.from(row.children).filter((c) => c.classList.contains("cell"));
          if (k.length < 2) return;
          const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
          rowLen = Math.max(rowLen, k.reduce((t, c) => t + c.getBoundingClientRect().width, 0) + gap * (k.length - 1));
        });
        const natural = Math.max(hi - Math.max(lo, box.left), rowLen) / cur;
        let sc = 1;
        if (natural > 0) sc = Math.max(1, Math.min(FIT_CELLS, Math.floor(((avail * 0.94) / natural) * 20) / 20));
        sc = Math.min(sc, st._fitS);
        st._fitS = sc;
        st.style.setProperty("--s", String(sc));
      }
      st.querySelectorAll("svg.canvas").forEach((svg, i) => {
        const w = parseFloat(svg.getAttribute("width")), h = parseFloat(svg.getAttribute("height"));
        if (!w || svg.dataset.fit === "off") return;
        const par = svg.parentElement, pcs = getComputedStyle(par);
        const room = par.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
        let k = Math.min(FIT_SVG, room / w);
        /* inside a box with a height limit (it scrolls), grow only as far as that limit */
        if (pcs.maxHeight !== "none" && h) k = Math.min(k, parseFloat(pcs.maxHeight) / h);
        /* and never past about 60% of the window's height: a bigger picture would no longer fit the screen */
        if (h) k = Math.min(k, Math.max(1, (innerHeight * 0.6) / h));
        k = Math.min(k, st._fitK[i] == null ? Infinity : st._fitK[i]);
        st._fitK[i] = k;
        if (k > 1.05) { svg.style.width = w * k + "px"; svg.style.marginLeft = svg.style.marginRight = "auto"; }
        else svg.style.width = "";
      });
      /* hold the tallest height this run has reached */
      const hNow = st.offsetHeight;
      if (hNow >= st._fitH) st._fitH = hNow;
      else st.style.minHeight = st._fitH + "px";
    });
  };
  let fitTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => DSA.fit(document), 120); });

  /* ------------------------------------------------------------
     Download a diagram as PNG, JPG, SVG or PDF.
     A stage can be drawn with SVG, with HTML boxes (cells, bars,
     tables) or with both, so the exporter redraws whatever is on
     screen as one plain SVG: a rectangle per painted box, a <text>
     per run of text, and each inline <svg> copied with its computed
     styles. Plain SVG, unlike HTML in a foreignObject, can be drawn
     onto a canvas in every browser, which gives the PNG, the JPG and
     (a JPG wrapped in a one-page PDF) the PDF. No libraries.
     ------------------------------------------------------------ */
  const XML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  const xesc = (t) => String(t).replace(/[&<>"]/g, (c) => XML_ESC[c]);
  const clear = (c) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);
  const SVG_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "stroke-linecap", "opacity",
    "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "visibility"];

  function snapshotSVG(root) {
    const r0 = root.getBoundingClientRect();
    const W = Math.ceil(Math.max(r0.width, root.scrollWidth)), H = Math.ceil(Math.max(r0.height, root.scrollHeight));
    const ox = r0.left - root.scrollLeft, oy = r0.top - root.scrollTop;
    const out = [];
    let bg = "#ffffff";
    for (let e = root; e && e.nodeType === 1; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!clear(c)) { bg = c; break; } }
    out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + bg + '"/>');
    const font = (cs) => 'font-family="' + xesc(cs.fontFamily) + '" font-size="' + cs.fontSize + '" font-weight="' + cs.fontWeight + '"' + (cs.fontStyle !== "normal" ? ' font-style="' + cs.fontStyle + '"' : "") + ' fill="' + cs.color + '"';
    function text(node, cs) {
      const raw = node.textContent;
      if (!raw.trim()) return;
      const up = cs.textTransform === "uppercase" ? (t) => t.toUpperCase() : (t) => t;
      const range = document.createRange();
      const words = [];
      const re = /\S+/g;
      let m;
      while ((m = re.exec(raw))) words.push([m.index, m.index + m[0].length]);
      /* one box: the whole run in one piece; wrapped text: word by word */
      range.setStart(node, words[0][0]);
      range.setEnd(node, words[words.length - 1][1]);
      const rects = range.getClientRects();
      const put = (r, t) => { if (r.width || r.height) out.push('<text x="' + (r.left - ox).toFixed(1) + '" y="' + (r.top - oy + r.height / 2).toFixed(1) + '" dominant-baseline="central" ' + font(cs) + ' xml:space="preserve">' + xesc(up(t)) + "</text>"); };
      if (rects.length <= 1) { if (rects[0]) put(rects[0], raw.slice(words[0][0], words[words.length - 1][1]).replace(/\s+/g, " ")); return; }
      words.forEach(([a, b]) => { range.setStart(node, a); range.setEnd(node, b); const r = range.getBoundingClientRect(); put(r, raw.slice(a, b)); });
    }
    function svgCopy(el) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const copy = el.cloneNode(true);
      const a = [el].concat(Array.from(el.querySelectorAll("*"))), b = [copy].concat(Array.from(copy.querySelectorAll("*")));
      a.forEach((o, i) => {
        const cs = getComputedStyle(o);
        let st = SVG_PROPS.map((k) => { const v = cs.getPropertyValue(k); return v ? k + ":" + v : ""; }).filter(Boolean).join(";");
        if (cs.display === "none") st += ";display:none";
        b[i].setAttribute("style", st);
        b[i].removeAttribute("class");
      });
      copy.setAttribute("x", (r.left - ox).toFixed(1));
      copy.setAttribute("y", (r.top - oy).toFixed(1));
      copy.setAttribute("width", r.width.toFixed(1));
      copy.setAttribute("height", r.height.toFixed(1));
      copy.setAttribute("style", "overflow:visible");
      if (!copy.getAttribute("viewBox") && el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.width) { const v = el.viewBox.baseVal; copy.setAttribute("viewBox", [v.x, v.y, v.width, v.height].join(" ")); }
      out.push(new XMLSerializer().serializeToString(copy));
    }
    function walk(el) {
      if (el.classList && el.classList.contains("dl")) return;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const op = parseFloat(cs.opacity);
      if (op === 0) return;
      if (el.namespaceURI === SVGNS && el.tagName.toLowerCase() === "svg") { svgCopy(el); return; }
      if (op < 1) out.push('<g opacity="' + op + '">');
      if (el !== root) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height) {
          const x = r.left - ox, y = r.top - oy, w = r.width, h = r.height;
          const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
          const sides = ["Top", "Right", "Bottom", "Left"].map((sd) => ({ w: cs["border" + sd + "Style"] === "none" ? 0 : parseFloat(cs["border" + sd + "Width"]) || 0, c: cs["border" + sd + "Color"], st: cs["border" + sd + "Style"] }));
          const same = sides.every((sd) => sd.w === sides[0].w && sd.c === sides[0].c);
          const fill = clear(cs.backgroundColor) ? "none" : cs.backgroundColor;
          if (same && sides[0].w && !clear(sides[0].c)) {
            const bw = sides[0].w;
            out.push('<rect x="' + (x + bw / 2).toFixed(1) + '" y="' + (y + bw / 2).toFixed(1) + '" width="' + Math.max(0, w - bw).toFixed(1) + '" height="' + Math.max(0, h - bw).toFixed(1) + '" rx="' + Math.max(0, rad - bw / 2).toFixed(1) + '" fill="' + fill + '" stroke="' + sides[0].c + '" stroke-width="' + bw + '"' + (sides[0].st === "dashed" ? ' stroke-dasharray="' + bw * 3 + " " + bw * 2 + '"' : sides[0].st === "dotted" ? ' stroke-dasharray="' + bw + " " + bw * 1.5 + '"' : "") + "/>");
          } else {
            if (fill !== "none") out.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + rad.toFixed(1) + '" fill="' + fill + '"/>');
            const [t, rt, bt, lt] = sides;
            const strip = (sx, sy, sw, sh, c) => out.push('<rect x="' + sx.toFixed(1) + '" y="' + sy.toFixed(1) + '" width="' + sw.toFixed(1) + '" height="' + sh.toFixed(1) + '" fill="' + c + '"/>');
            if (t.w && !clear(t.c)) strip(x, y, w, t.w, t.c);
            if (bt.w && !clear(bt.c)) strip(x, y + h - bt.w, w, bt.w, bt.c);
            if (lt.w && !clear(lt.c)) strip(x, y, lt.w, h, lt.c);
            if (rt.w && !clear(rt.c)) strip(x + w - rt.w, y, rt.w, h, rt.c);
          }
        }
      }
      el.childNodes.forEach((c) => { if (c.nodeType === 3) text(c, cs); else if (c.nodeType === 1) walk(c); });
      if (op < 1) out.push("</g>");
    }
    walk(root);
    return { w: W, h: H, svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' + out.join("") + "</svg>" };
  }

  function svgToCanvas(snap, scale) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = Math.round(snap.w * scale); c.height = Math.round(snap.h * scale);
        const g = c.getContext("2d");
        g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c);
      };
      img.onerror = () => reject(new Error("could not draw the picture"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(snap.svg);
    });
  }
  const canvasBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));

  /** a one-page PDF holding one JPEG, page size = picture size (1 px = 0.75 pt) */
  function pdfFromJpeg(jpg, pxW, pxH, wPt, hPt) {
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const add = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; add(n + " 0 obj\n"); body(); add("\nendobj\n"); };
    const content = "q " + wPt + " 0 0 " + hPt + " 0 0 cm /Im0 Do Q";
    add("%PDF-1.4\n%âã\n");
    obj(1, () => add("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
    obj(3, () => add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + wPt + " " + hPt + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"));
    obj(4, () => { add("<< /Type /XObject /Subtype /Image /Width " + pxW + " /Height " + pxH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n"); add(jpg); add("\nendstream"); });
    obj(5, () => add("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream"));
    const xref = len;
    add("xref\n0 6\n0000000000 65535 f \n");
    for (let n = 1; n <= 5; n++) add(String(offs[n]).padStart(10, "0") + " 00000 n \n");
    add("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
  }

  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /** exportDiagram(el, format, baseName): save what el shows as "png" | "jpg" | "svg" | "pdf" */
  DSA.exportDiagram = async function (el, fmt, base) {
    const snap = snapshotSVG(el);
    if (!snap.w || !snap.h) throw new Error("the diagram is empty or hidden");
    const name = (base || "diagram") + "." + fmt;
    if (fmt === "svg") return saveBlob(new Blob([snap.svg], { type: "image/svg+xml" }), name);
    const c = await svgToCanvas(snap, 2);
    const blobOf = async (type, q) => { const bl = await canvasBlob(c, type, q); if (!bl) throw new Error("the picture is too big for this browser"); return bl; };
    if (fmt === "png") return saveBlob(await blobOf("image/png"), name);
    const jpg = await blobOf("image/jpeg", 0.92);
    if (fmt === "jpg") return saveBlob(jpg, name);
    const bytes = new Uint8Array(await jpg.arrayBuffer());
    saveBlob(pdfFromJpeg(bytes, c.width, c.height, +(snap.w * 0.75).toFixed(2), +(snap.h * 0.75).toFixed(2)), name);
  };
  DSA._snapshotSVG = snapshotSVG;   /* exposed for the headless test harness */

  /** downloadable(stage, label): a small "Download" menu under a diagram */
  DSA.downloadable = function (stage, label) {
    if (!stage || stage._dl) return;
    stage._dl = true;
    const page = (location.pathname.split("/").pop() || "page").replace(/\.html$/, "") || "page";
    const base = page + (label ? "-" + label : "");
    const menu = DSA.el("details", { class: "dl" }, [
      DSA.el("summary", { html: '<span aria-hidden="true">⤓</span> Download picture', title: "Save this diagram as an image or a PDF" }),
    ]);
    const list = DSA.el("div", { class: "dl-menu", role: "menu" });
    [["png", "PNG image"], ["jpg", "JPG image"], ["svg", "SVG (sharp at any size)"], ["pdf", "PDF"]].forEach(([fmt, txt]) => {
      list.appendChild(DSA.el("button", { type: "button", role: "menuitem", text: txt, onclick: async () => {
        menu.open = false;
        try { await DSA.exportDiagram(stage, fmt, base); }
        catch (e) { console.error(e); DSA.toast("Could not save the picture: " + e.message, true); }
      } }));
    });
    menu.appendChild(list);
    document.addEventListener("click", (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    stage.insertAdjacentElement("afterend", menu);
  };
  document.addEventListener("DOMContentLoaded", () => {
    DSA.$$("main .stage").forEach((st, i, all) => DSA.downloadable(st, st.id || (all.length > 1 ? "diagram-" + (i + 1) : "")));
  });

  /* footer, injected so every page shares one */
  DSA.footer = function () {
    const f = DSA.$("footer.site");
    // only pages with a player get a footer: the keyboard shortcuts
    if (f && !f.innerHTML.trim() && DSA.$("#player")) {
      f.innerHTML =
        '<div class="wrap">keyboard: <span class="mono">space</span> play/pause, <span class="mono">&larr; &rarr;</span> step</div>';
    }
    const bar = DSA.$(".topbar-in");
    /* no form connected yet: show nothing rather than a button that goes nowhere */
    if (DSA.FEEDBACK_URL && bar && !DSA.$(".fb-btn", bar)) {
      const btn = feedbackLink("fb-btn", '<span aria-hidden="true">✉</span> <span class="fb-long">Send </span>feedback');
      const pill = DSA.$(".pill", bar);
      bar.insertBefore(btn, pill || null);
    }
  };
  document.addEventListener("DOMContentLoaded", DSA.footer);
  /* after every page script's own DOMContentLoaded work: see "show-anyway" in style.css */
  document.addEventListener("DOMContentLoaded", () => setTimeout(() => document.documentElement.classList.add("ready")));
})();
