/* ============================================================
   core.js — shared helpers + the frame-based animation player
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

  /* ---------------- feedback ----------------
     Every page gets a "Send feedback" button (top bar and footer) that opens this link in a new tab.
     Paste your Google Form link between the quotes. While it is empty the button says the form is not
     connected yet.
     Optional: to pre-fill one short-answer question with the page, tab and operation the reader was on,
     open the form's ⋮ menu → "Get pre-filled link", type anything into that question, click "Get link",
     and copy the "entry.123456789" part of the link into FEEDBACK_PAGE_FIELD. */
  DSA.FEEDBACK_URL = "";
  DSA.FEEDBACK_PAGE_FIELD = "";

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

  /** Parse "3, 9 12,-4" into a number array. Returns [] on empty. */
  DSA.parseNums = function (s) {
    return String(s || "")
      .split(/[\s,;]+/)
      .filter((t) => t.length && /^-?\d+(\.\d+)?$/.test(t))
      .map(Number);
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

  /* ---------------- legend ---------------- */
  DSA.legend = function (mount, items) {
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    if (!m) return;
    m.className = "legend";
    m.innerHTML = items
      .map((it) => `<span><i style="background:${it.color}"></i>${it.label}</span>`)
      .join("");
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
    cpp:
      "auto bool break case catch class const constexpr continue default delete do double else enum false " +
      "float for if inline int long namespace new nullptr private protected public return short signed sizeof " +
      "static struct swap switch template this throw true try typedef typename unsigned using vector void while",
    python:
      "and as assert break class continue def del elif else except False finally for from global if import " +
      "in is lambda None nonlocal not or pass raise return True try while with yield",
  };
  const KW_RE = {};
  for (const k in KEYWORDS) KW_RE[k] = new RegExp("^(?:" + KEYWORDS[k].split(" ").join("|") + ")$");

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /** Colourise one plain-text line for `lang`. Pseudocode only gets comments. */
  function paint(line, lang) {
    if (line === "") return "&nbsp;";
    const cmt = lang === "python" ? "#" : "//";
    const kw = KW_RE[lang];
    let out = "", rest = line;

    /* trailing comment first — everything after it is literal */
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
    { id: "cpp", label: "C++" },
    { id: "python", label: "Python" },
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
    /* panels are rebuilt whenever you pick a new algorithm — drop the detached ones */
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
       variants = { pseudo: [...], java: [...], cpp: [...], python: [...],
                    map: { java: [...], ... } }

     Two ways to say which line a frame is on:

     1. Named anchors (preferred). End a line with "@@name" (or
        "@@a,b" for several) in EVERY language that has an equivalent
        line; highlight("name") lights all lines carrying that anchor
        in whatever language is on screen. No index bookkeeping, and a
        step that is two lines in Python and one in Java just works.

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
    const pre = DSA.el("pre", { class: "code" });
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
    t = t.replace(lang === "python" ? /#.*$/ : /\/\/.*$/, "").trim();
    let m;
    if (lang === "python") {
      m = /^def\s+(\w+)\s*\((.*)\)\s*:/.exec(t);
      if (!m) return null;
      let ps = splitTop(m[2]).map((p) => p.split("=")[0].split(":")[0].trim());
      const method = ps[0] === "self";
      if (method) ps = ps.slice(1);
      return { name: m[1], params: ps, method: method, type: null };
    }
    if (lang === "pseudo") {
      m = /^([\w]+)\s*\(([^)]*)\)\s*:/.exec(t);
      if (!m) return null;
      return { name: m[1], params: splitTop(m[2]), type: null };
    }
    m = /^(?:static\s+)?(.+?)\s*\b(\w+)\s*\((.*)\)\s*(?:const)?\s*\{?\s*$/.exec(t);
    if (!m) return null;
    const params = splitTop(m[3]).map((p) => { const w = p.split("=")[0].trim().match(/(\w+)\s*(\[\s*\])*$/); return w ? w[1] : p; });
    return { name: m[2], params: params, type: m[1].trim() };
  }
  const resultName = (name, type) =>
    /^(boolean|bool)$/.test(type || "") ? "found"
      : /Node/.test(type || "") ? "node"
      : /^Entry/.test(type || "") ? "e"
      : /^(hash|poly_hash)$/.test(name) ? "h"
      : /^(indexOf|index_of|search|binarySearch|binary_search|binarySearchIter|binary_search_iter)/i.test(name) ? "i"
      : /^(find)/i.test(name) ? "pos"
      : /^(remove|pop|dequeue|get|top|first|min|peek|removeMin|remove_min|removeFirst|removeLast)/i.test(name) ? "x"
      : "result";
  /** the call statement for listing L in `lang`; recv = object name (null for a plain function), vals = {param: value} */
  DSA.callLine = function (L, lang, recv, vals) {
    const sig = sigOf(L, lang), pseudo = sigOf(L, "pseudo");
    if (!sig) return null;
    /* L.callVals: defaults for a top-level call, e.g. { lo: "0", hi: { java: "a.length - 1", python: "len(a) - 1" } } */
    const v = {};
    Object.entries(L.callVals || {}).forEach(([k, x]) => { const y = x && typeof x === "object" ? x[lang] : x; if (y != null) v[k] = y; });
    Object.assign(v, vals || {});
    const args = sig.params.map((p) => (v[p] != null ? v[p] : p)).join(", ");
    const isMethod = lang === "python" ? sig.method : (sigOf(L, "python") || {}).method;
    const target = (isMethod && recv ? recv + "." : "") + sig.name + "(" + args + ")";
    const pyType = (sigOf(L, "java") || {}).type;
    const ret = lang === "java" || lang === "cpp" ? sig.type : pyType;
    const hasRet = ret && !/^void$/.test(ret);
    const nm = resultName(sig.name, (sigOf(L, "java") || {}).type);
    if (lang === "java" || lang === "cpp") return (hasRet ? ret + " " + nm + " = " : "") + target + ";";
    if (lang === "python") return (hasRet ? nm + " = " : "") + target;
    return (hasRet ? nm + " ← " : "") + target;
  };
  /* values of a call written in a caption: "<b>insert(2, 99)</b> — …" → {i: 2, x: 99} (pseudocode parameter names) */
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

  /* spec block: what the function does, how to call it, parameters, result, errors, cost */
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
    const rows = [["params", sp.params], ["returns", sp.returns], ["errors", sp.errors], ["cost", sp.cost]];
    rows.forEach(([k, v]) => { if (v) box.appendChild(DSA.el("div", { class: "spec-row" }, [DSA.el("span", { class: "spec-k", text: k }), DSA.el("span", { class: "spec-v", html: v })])); });
    paintCall();
    return { node: box, setArgs(a) { if (a !== vals || argsHook) { vals = a || null; paintCall(); } }, repaint: paintCall };
  }
  /** specs(listings, { key: { does, params, returns, errors, cost, callVals? } }) — attach specs to listings */
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

  const LS_HIDE = "dsa.codeHidden";
  let codeHidden = false;
  try { codeHidden = localStorage.getItem(LS_HIDE) === "1"; } catch (e) {}

  DSA.CodeDock = function (mount, listings, opts) {
    const o = opts || {};
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    m.classList.add("code-dock");
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

    const paintHidden = () => {
      m.classList.toggle("collapsed", codeHidden);
      hide.textContent = codeHidden ? "show code" : "hide code";
    };
    hide.addEventListener("click", () => {
      codeHidden = !codeHidden;
      try { localStorage.setItem(LS_HIDE, codeHidden ? "1" : "0"); } catch (e) {}
      docks.forEach((d) => d.paintHidden());
    });

    let key = null, block = null, spec = null;
    const specMount = DSA.el("div", { class: "code-spec-wrap" });
    const codeMount = DSA.el("div");
    body.appendChild(specMount);
    body.appendChild(codeMount);
    DSA.onLang(() => { if (spec && specMount.isConnected) spec.repaint(); });
    const api = {
      listings: listings,
      paintHidden: paintHidden,
      get current() { return key; },
      /** Switch to listing `k` (no-op if already showing it). */
      show(k) {
        if (k === key && block) return api;
        const L = listings[k];
        if (!L) return api;
        key = k;
        title.innerHTML = '<span class="lang-label">running</span> <span class="mono">' + (L.title || k) + "</span>";
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
    docks.push(api);
    paintHidden();
    if (o.initial) api.show(o.initial);
    else { const first = Object.keys(listings)[0]; if (first) api.show(first); }
    return api;
  };
  const docks = [];
  DSA._docks = docks;   /* exposed for the headless test harness */

  /* ---------------- examples bar ---------------- */
  /** Examples(mount, [{ label, desc, run }]) — one-click worked scenarios. */
  DSA.Examples = function (mount, items) {
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    if (!m) return;
    m.className = "examples";
    m.innerHTML = "";
    m.appendChild(DSA.el("span", { class: "ex-label", text: "Examples" }));
    items.forEach((it) =>
      m.appendChild(DSA.el("button", { class: "ex", type: "button", text: it.label, title: it.desc || "", onclick: it.run }))
    );
  };

  /* ---------------- stat tiles ---------------- */
  /** stats(mount, [[label, value], ...]) — replaces the row of stat tiles. */
  DSA.stats = function (mount, pairs) {
    const m = typeof mount === "string" ? DSA.$(mount) : mount;
    if (!m) return;
    m.className = "stats";
    m.innerHTML = pairs
      .map((p) => '<div class="stat"><span class="k">' + p[0] + '</span><span class="v">' + (p[1] == null ? "–" : p[1]) + "</span></div>")
      .join("");
  };

  /* ---------------- per-tab visibility ---------------- */
  /** Show every [data-tab] element whose space-separated list names `id`; hide the rest. */
  DSA.showFor = function (id, root) {
    DSA.$$("[data-tab]", root).forEach((n) => {
      const on = n.dataset.tab.split(/\s+/).indexOf(id) >= 0;
      n.style.display = on ? "" : "none";
    });
  };

  /* ---------------- LeetCode practice ----------------
     Practice({ key: { label, note?, items: [[number, "Title", "slug", "Easy|Medium|Hard", "why"], ...] } })
     registers a page's lists; practiceShow(key) shows the list for the part the reader is on.
     The panel is created right below the visualizer panel. */
  let pData = null, pKey = null;
  function practiceMount() {
    let m = DSA.$("#practice");
    if (!m) {
      const host = DSA.$("#player") && DSA.$("#player").closest(".panel");
      if (!host) return null;
      m = DSA.el("section", { class: "panel", id: "practice" });
      host.parentNode.insertBefore(m, host.nextSibling);
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
      DSA.el("h2", { html: "Practice on LeetCode <span class='muted' style='font-weight:400'>— " + d.label + "</span>" }),
      DSA.el("span", { class: "hint", text: "opens in a new tab" }),
    ]));
    if (d.note) m.appendChild(DSA.el("p", { class: "small muted", style: "margin:-.3rem 0 .7rem", html: d.note }));
    const list = DSA.el("div", { class: "lc-list" });
    (d.items || []).forEach(([n, title, slug, diff, why]) => {
      const a = DSA.el("a", { class: "lc-item", href: "https://leetcode.com/problems/" + slug + "/", target: "_blank", rel: "noopener" });
      a.innerHTML = '<span class="lc-top"><span class="lc-num">' + n + '.</span> <span class="lc-title">' + title + '</span> <span class="lc-diff ' + diff.toLowerCase() + '">' + diff + "</span></span>" +
        (why ? '<span class="lc-why">' + why + "</span>" : "");
      list.appendChild(a);
    });
    m.appendChild(list);
  }
  DSA.Practice = function (data) { pData = data; practiceRender(); };
  DSA.practiceShow = function (key) { pKey = key; practiceRender(); };

  /* ---------------- segmented toggle ---------------- */
  /** Segmented(mount, [{id,label}], onChange, initialId) — a small pill switch (mode pickers). */
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
   *   live    (v, i) => bool — false draws an empty dashed slot (default: v != null)
   *   show    (v, i) => text (default: the value, or "·" when not live)
   *   label   caption above the row
   *   index   false to hide the index labels
   *   start   first index label (default 0)
   *   ghost   (i) => bool — dim this cell
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
      if (o.w) c.style.minWidth = o.w + "px";
      if (o.h) c.style.height = o.h + "px";
      if (o.index !== false) c.appendChild(DSA.el("span", { class: "idx", text: (o.start || 0) + i }));
      if (ptrs[i]) c.appendChild(DSA.el("span", { class: "ptr", text: ptrs[i] }));
      row.appendChild(c);
    });
    if (!values.length) row.appendChild(DSA.el("div", { class: "small muted", text: o.emptyText || "(empty)" }));
    wrap.appendChild(row);
    return wrap;
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

  /* ---------------- side-by-side comparisons ---------------- */
  /** Zip two frame lists into { L, R, note } frames, holding whichever finishes first on its last frame. */
  DSA.zip = function (a, b, note) {
    const n = Math.max(a.length, b.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const L = a[Math.min(i, a.length - 1)], R = b[Math.min(i, b.length - 1)];
      out.push({
        L: L, R: R, done: [i >= a.length - 1, i >= b.length - 1],
        note: typeof note === "function" ? note(L, R, i, a.length, b.length) : note || "",
      });
    }
    return out;
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
    }
    pick(0);
    return { pick, get current() { return items[cur] && items[cur].id; } };
  };

  /* ============================================================
     Player — scrubs a recorded frame list
     opts: { mount, render(frame, index, frames), delay }
     Frame is any object; by convention `frame.note` is the caption.
     ============================================================ */
  const players = [];
  DSA._players = players;   /* exposed for the headless test harness */

  /* ------------------------------------------------------------
     "Which operation is this?" — the toolbar button whose click produced
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

  DSA.Player = function Player(opts) {
    const self = this;
    this.frames = [{ note: "Press an operation button to begin." }];
    this.index = 0;
    this.playing = false;
    this.speed = 1;
    this.baseDelay = opts.delay || 620;
    this.render = opts.render || function () {};
    this.onFrame = opts.onFrame || null;
    this.code = opts.code || null;      /* a CodeDock this player drives */
    const mount = typeof opts.mount === "string" ? DSA.$(opts.mount) : opts.mount;
    this.mount = mount;

    mount.classList.add("player");
    mount.innerHTML =
      '<div class="player-row">' +
      '<button class="icon" data-a="first" title="First frame">&#124;&#9664;</button>' +
      '<button class="icon" data-a="prev" title="Step back (&larr;)">&#9664;</button>' +
      '<button class="primary" data-a="play" style="min-width:6.2rem" title="Play / pause (space)">&#9654; Play</button>' +
      '<button class="icon" data-a="next" title="Step forward (&rarr;)">&#9654;</button>' +
      '<button class="icon" data-a="last" title="Last frame">&#9654;&#124;</button>' +
      '<div class="sep"></div>' +
      '<div class="field"><label>Speed</label><select data-a="speed">' +
      '<option value="0.35">0.35&times;</option><option value="0.6">0.6&times;</option>' +
      '<option value="1" selected>1&times;</option><option value="2">2&times;</option>' +
      '<option value="4">4&times;</option><option value="8">8&times;</option></select></div>' +
      '<div class="spacer" style="flex:1"></div>' +
      '<div class="counter" data-a="counter">0 / 0</div>' +
      "</div>" +
      '<div class="track"><input type="range" min="0" max="0" value="0" data-a="track"></div>' +
      '<div class="note" data-a="note"></div>';

    const q = (a) => mount.querySelector('[data-a="' + a + '"]');
    const btnPlay = q("play"), track = q("track"), counter = q("counter"), note = q("note");

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
    track.addEventListener("input", (e) => { self.pause(); self.goto(parseInt(e.target.value, 10)); });

    this._sync = function () {
      const f = this.frames[this.index] || {};
      track.max = Math.max(0, this.frames.length - 1);
      track.value = this.index;
      counter.textContent = this.index + 1 + " / " + this.frames.length;
      note.innerHTML = f.note == null ? "" : f.note;
      btnPlay.innerHTML = this.playing ? "&#10073;&#10073; Pause" : "&#9654; Play";
      try { if (this.code) this.code.sync(f); } catch (err) { console.error(err); }
      try { this.render(f, this.index, this.frames); } catch (err) { console.error(err); }
      if (this.onFrame) this.onFrame(f, this.index);
    };

    this.load = function (frames, autoplay) {
      setActive(this);          /* running an operation claims the keyboard too */
      markCurrent();
      this.pause();
      this.frames = frames && frames.length ? frames : [{ note: "No steps were produced." }];
      DSA.annotateArgs(this.frames);
      this.index = 0;
      this._sync();
      if (autoplay !== false) this.play();
      return this;
    };
    this.goto = function (i) {
      this.index = DSA.clamp(i, 0, this.frames.length - 1);
      this._sync();
    };
    this.step = function (d) { this.goto(this.index + d); };
    this.play = function () {
      if (this.frames.length < 2) return;
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
    this.toggle = function () { this.playing ? this.pause() : this.play(); };
    this._arm = function () {
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        if (!this.playing) return;
        if (this.index < this.frames.length - 1) { this.index++; this._sync(); this._arm(); }
        else this.pause();
      }, Math.max(24, this.baseDelay / this.speed));
    };
    this.isVisible = function () { return !!mount.offsetParent; };
    /* the panel this player belongs to — clicking anywhere in it claims the keyboard */
    this.scope = mount.closest(".panel") || mount;

    players.push(this);
    markMulti();
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
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    let p = activePlayer && activePlayer.isVisible() ? activePlayer : null;
    if (!p) p = nearestToViewportCentre();
    if (!p) return;
    if (e.code === "Space") { e.preventDefault(); setActive(p); p.toggle(); }
    else if (e.code === "ArrowRight") { e.preventDefault(); setActive(p); p.pause(); p.step(1); }
    else if (e.code === "ArrowLeft") { e.preventDefault(); setActive(p); p.pause(); p.step(-1); }
  });

  /* ============================================================
     Recorder — the thing algorithms talk to
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
     Rec(snapshot, limit) — a Recorder that also remembers which
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
      if (!h) { e.preventDefault(); DSA.toast("The feedback form isn't connected yet — please check back soon."); return; }
      a.href = h;
    });
    return a;
  }

  /* footer, injected so every page shares one */
  DSA.footer = function () {
    const f = DSA.$("footer.site");
    if (f && !f.innerHTML.trim()) {
      f.innerHTML =
        '<div class="wrap">Data Structure &amp; Algorithm Visualizer &middot; built for CSE 214 / CSE 373 &middot; ' +
        "keyboard: <span class=\"mono\">space</span> play/pause, <span class=\"mono\">&larr; &rarr;</span> step" +
        '<span class="fb-foot"> &middot; Found a bug? </span></div>';
      DSA.$(".fb-foot", f).appendChild(feedbackLink("", "Send feedback"));
    }
    const bar = DSA.$(".topbar-in");
    if (bar && !DSA.$(".fb-btn", bar)) {
      const btn = feedbackLink("fb-btn", '<span aria-hidden="true">✉</span> <span class="fb-long">Send </span>feedback');
      const pill = DSA.$(".pill", bar);
      bar.insertBefore(btn, pill || null);
    }
  };
  document.addEventListener("DOMContentLoaded", DSA.footer);
})();
