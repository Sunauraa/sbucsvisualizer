/* ============================================================
   playground.js: the "Code playground" button on every module.

   The button opens a panel right under the visualizer, where a student
   types Java and steps through it. The panel starts on a program for the
   tab they are looking at. The editor and the starter programs load the
   first time it opens, so a page that never uses them doesn't pay for them.

   The interpreter runs in a Web Worker (java-interp.js) and returns
   frames, exactly like a module records its own, so the same Player,
   animation, quiz and Why? all work here too.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const PAGE = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  const LS = "dsa.playground." + PAGE + ".v1";
  const RUN_LIMIT_MS = 6000;
  const MINE = "__mine";
  /* only if the starter programs fail to load */
  const FALLBACK = "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello\");\n  }\n}\n";
  let cancelRun = null;

  const q = (id) => D.$("#" + id);
  let editor = null, player = null, worker = null, timer = 0, output = "", panel = null, openBtn = null, examples = [], building = null;
  let edited = false, programmatic = false;

  /* ---------- editor, or a plain box if the vendored editor fails to load ---------- */
  function makeEditor(host, code, onChange, onRun) {
    if (window.DSAEditor) return window.DSAEditor.create(host, code, onChange, onRun);
    const t = D.el("textarea", { spellcheck: "false", "aria-label": "Java code" });
    t.value = code;
    t.addEventListener("input", () => onChange(t.value));
    host.appendChild(t);
    return { get value() { return t.value; }, set value(v) { t.value = v; }, mark() {} };
  }

  /* ---------- drawing one frame ---------- */
  const isRef = (v) => v && typeof v === "object" && v.ref != null;
  function refName(f, id, depth) {
    depth = depth || 0;
    /* the friendliest name for a heap object: a variable that holds it */
    /* oldest frame first: a structure keeps one name (root) rather than changing with each recursive call (t) */
    for (let i = 0; i < f.stack.length; i++) {
      const vars = f.stack[i].vars;
      for (const k in vars) if (k !== "this" && isRef(vars[k]) && vars[k].ref === id) return k;
    }
    for (const k in f.statics) if (isRef(f.statics[k]) && f.statics[k].ref === id) return k.split(".").pop();
    /* held inside another object or array: stack.data, adj[2] */
    if (depth > 3) return null;
    for (const pid in f.heap) {
      const h = f.heap[pid];
      if (h.kind === "obj") {
        for (const k in h.fields) if (isRef(h.fields[k]) && h.fields[k].ref === id) { const o = refName(f, +pid, depth + 1); if (o) return o + "." + k; }
      } else if (h.data) {
        for (let i = 0; i < h.data.length; i++) if (isRef(h.data[i]) && h.data[i].ref === id) { const o = refName(f, +pid, depth + 1); if (o) return o + "[" + i + "]"; }
      }
    }
    return null;
  }
  /* main's empty args array is noise on every single step */
  const isEmptyArgs = (f, name, v) => name === "args" && isRef(v) && f.heap[v.ref] && f.heap[v.ref].kind === "array" && !f.heap[v.ref].length;
  const refText = (f, id) => { const h = f.heap[id]; return "→ " + (h ? h.cls || (h.elem ? h.elem + "[]" : "object") : "object"); };
  const valText = (f, v) => (isRef(v) ? refText(f, v.ref) : String(v));

  /* linked structures: objects whose reference fields point at their own class */
  /* a link back up (parent, prev) isn't drawn: the forward links already show the shape */
  const BACK = /^(parent|prev|previous)$/i;
  function selfLinks(f, h) {
    return Object.keys(h.fields).filter((k) => {
      if (BACK.test(k)) return false;
      const v = h.fields[k];
      if (isRef(v)) { const t = f.heap[v.ref]; return t && t.cls === h.cls; }
      return false;
    });
  }
  function linkInfo(f) {
    /* which fields of each class are links, learned from every object of that class in this frame */
    const byCls = {};
    Object.values(f.heap).forEach((h) => {
      if (h.kind !== "obj") return;
      const s = (byCls[h.cls] = byCls[h.cls] || new Set());
      selfLinks(f, h).forEach((k) => s.add(k));
    });
    return byCls;
  }
  function nodeLabel(f, h, links) {
    const parts = Object.keys(h.fields).filter((k) => !links.has(k) && !BACK.test(k)).map((k) => valText(f, h.fields[k]));
    return parts.join(", ") || h.cls;
  }

  function drawChains(f, parent, prev) {
    const links = linkInfo(f);
    const objs = Object.keys(f.heap).map(Number).filter((id) => f.heap[id].kind === "obj");
    const linked = objs.filter((id) => links[f.heap[id].cls] && (links[f.heap[id].cls].size || isChainField(f, f.heap[id])));
    /* a node class is one with a null-or-self field; Node with next == null still counts once any Node links */
    const pointedAt = new Set();
    objs.forEach((id) => {
      const h = f.heap[id];
      Object.keys(h.fields).forEach((k) => { const v = h.fields[k]; if (isRef(v) && links[h.cls] && links[h.cls].has(k)) pointedAt.add(v.ref); });
    });
    const shown = new Set();
    const roots = linked.filter((id) => !pointedAt.has(id));
    const isTree = (c) => links[c] && links[c].size >= 2;

    const treeRoots = roots.filter((id) => isTree(f.heap[id].cls));
    const chainRoots = roots.filter((id) => !isTree(f.heap[id].cls));

    treeRoots.forEach((rootId) => {
      const h0 = f.heap[rootId];
      const lf = Array.from(links[h0.cls]);
      const L = lf.find((k) => /left/i.test(k)) || lf[0], R = lf.find((k) => /right/i.test(k)) || lf[1];
      /* in-order x, depth y, the same layout the Trees page uses */
      const build = (id, seen) => {
        if (id == null || seen.has(id) || !f.heap[id]) return null;
        seen.add(id);
        shown.add(id);
        const h = f.heap[id];
        const a = h.fields[L], b = h.fields[R];
        return { id, h, left: isRef(a) ? build(a.ref, seen) : null, right: isRef(b) ? build(b.ref, seen) : null };
      };
      const tree = build(rootId, new Set());
      const geo = D.layoutBinary(tree, { gapX: 58, gapY: 62, padX: 34, padY: 30 });
      const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + geo.width + " " + geo.height, width: geo.width, height: geo.height, style: "margin:0" });
      (function edges(n) { if (!n) return; [n.left, n.right].forEach((k) => { if (k) { svg.appendChild(D.sLine(n._x, n._y + 17, k._x, k._y - 17, "edge")); edges(k); } }); })(tree);
      (function nodes(n) {
        if (!n) return;
        const g = D.svg("g", {});
        const before = prev && prev.heap[n.id];
        const changed = before && JSON.stringify(before.fields) !== JSON.stringify(n.h.fields);
        g.appendChild(D.svg("circle", { cx: n._x, cy: n._y, r: 17, class: "node-c " + (changed || !before ? "swap" : "") }));
        const label = nodeLabel(f, n.h, links[n.h.cls]);
        g.appendChild(D.sText(n._x, n._y, label, { "font-size": label.length > 3 ? 9 : 12 }));
        svg.appendChild(g);
        nodes(n.left); nodes(n.right);
      })(tree);
      section(parent, labelFor(f, rootId, h0.cls + " tree"), wrapCanvas(svg));
    });

    chainRoots.forEach((rootId) => {
      const h0 = f.heap[rootId];
      const field = Array.from(links[h0.cls])[0] || chainFieldName(h0);
      const ids = [], seen = new Set();
      for (let id = rootId; id != null && !seen.has(id) && f.heap[id];) {
        seen.add(id); ids.push(id); shown.add(id);
        const nx = f.heap[id].fields[field];
        id = isRef(nx) ? nx.ref : null;
      }
      const NW = 56, GAP = 34, Y = 12;
      const w = 20 + ids.length * (NW + GAP) + 44, h = 60;
      const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + w + " " + h, width: w, height: h, style: "margin:0" });
      svg.appendChild(D.svg("defs", {}, [D.svg("marker", { id: "pgArw", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [D.svg("path", { d: "M0 0L10 5L0 10z", fill: "#666" })])]));
      ids.forEach((id, i) => {
        const x = 10 + i * (NW + GAP);
        const before = prev && prev.heap[id];
        const changed = !before || JSON.stringify(before.fields) !== JSON.stringify(f.heap[id].fields);
        svg.appendChild(D.svg("rect", { x, y: Y, width: NW, height: 34, rx: 7, class: "node-c " + (changed ? "swap" : "") }));
        svg.appendChild(D.sText(x + NW / 2, Y + 17, nodeLabel(f, f.heap[id], links[h0.cls]), { "font-size": 13 }));
        const line = D.sLine(x + NW, Y + 17, x + NW + GAP - 3, Y + 17, "edge");
        if (i < ids.length - 1) { line.setAttribute("marker-end", "url(#pgArw)"); svg.appendChild(line); }
        else svg.appendChild(D.sText(x + NW + 22, Y + 17, "null", { class: "lbl-s", "font-size": 11 }));
      });
      section(parent, labelFor(f, rootId, h0.cls + " chain"), wrapCanvas(svg));
    });
    return shown;
  }
  /* a Node on its own, before anything links it, is still a node: the field is null but declared as itself */
  const chainFieldName = (h) => Object.keys(h.fields).find((k) => /next|prev|link/i.test(k)) || null;
  const isChainField = (f, h) => !!chainFieldName(h) || Object.keys(h.fields).some((k) => /left|right/i.test(k));
  function labelFor(f, id, fallback) { const n = refName(f, id); return n ? n : fallback; }
  function wrapCanvas(svg) { const d = D.el("div", { class: "pg-canvas" }); d.appendChild(svg); return d; }
  function section(parent, title, node) {
    parent.appendChild(D.el("h3", { text: title }));
    parent.appendChild(node);
  }

  function render(f, i, frames) {
    const box = q("pg-view");
    box.innerHTML = "";
    if (!f.stack) {
      box.appendChild(D.el("p", { class: "small muted", text: "Press Run code to see it step by step." }));
      q("pg-out").textContent = "";
      if (editor) editor.mark(f.errLine || null, "err");
      return;
    }
    const prev = frames[i - 1] && frames[i - 1].stack ? frames[i - 1] : null;
    if (editor) editor.mark(f.line, f.event === "throw" ? "err" : "run");

    /* call stack */
    const cards = f.stack.map((fr) => {
      const vars = {};
      Object.keys(fr.vars).forEach((k) => { if (!isEmptyArgs(f, k, fr.vars[k])) vars[k] = valText(f, fr.vars[k]); });
      return { id: fr.id, label: fr.label, vars };
    });
    const top = cards[cards.length - 1];
    const returning = f.event === "return" && top ? top.id : null;
    box.appendChild(D.el("h3", { text: "Call stack (top is running)" }));
    box.appendChild(D.callStack(cards, { returning, retVal: f.retVal == null ? "nothing" : f.retVal, err: false, compact: true, fmt: String, hidden: f.hiddenFrames || 0 }));

    /* arrays and lists, under the name of the variable that holds them */
    const shownLinks = drawChains(f, box, prev);
    const shownIds = new Set(shownLinks);
    /* a 2-D array is drawn once, as a grid, rather than one block per row */
    const isGrid = (h) => h.kind === "array" && h.data.length && h.data.every((v) => isRef(v) && f.heap[v.ref] && f.heap[v.ref].kind === "array");
    Object.keys(f.heap).map(Number).forEach((id) => { const h = f.heap[id]; if (isGrid(h)) h.data.forEach((v) => shownIds.add(v.ref)); });
    Object.keys(f.heap).map(Number).forEach((id) => {
      const h = f.heap[id];
      if (!isGrid(h) || shownIds.has(id)) return;
      shownIds.add(id);
      const rows = D.el("div", { class: "pg-rows" });
      h.data.forEach((v, r) => {
        const row = f.heap[v.ref], before = prev && prev.heap[v.ref];
        const marks = {};
        row.data.forEach((x, j) => { if (before && before.data && JSON.stringify(before.data[j]) !== JSON.stringify(x)) marks[j] = "swap"; });
        rows.appendChild(D.el("div", { class: "pg-row" }, [
          D.el("span", { class: "pg-row-i", text: "[" + r + "]" }),
          D.cells(row.data.map((x) => valText(f, x)), { marks, w: 34, h: 30, index: false, emptyText: "(empty)" }),
        ]));
      });
      section(box, labelFor(f, id, h.elem + "[]"), rows);
    });
    Object.keys(f.heap).map(Number).forEach((id) => {
      const h = f.heap[id];
      if (shownIds.has(id)) return;
      if (h.kind === "array" && !h.length && refName(f, id) === "args") return;
      if (h.kind === "array" || h.kind === "list") {
        const before = prev && prev.heap[id];
        const marks = {};
        h.data.forEach((v, j) => { if (before && before.data && JSON.stringify(before.data[j]) !== JSON.stringify(v)) marks[j] = "swap"; });
        const title = labelFor(f, id, h.cls || h.elem + "[]") + (h.kind === "list" ? " (" + h.cls + ")" : "") + (h.length > h.data.length ? " (first " + h.data.length + " of " + h.length + ")" : "");
        const cellsEl = D.cells(h.data.map((v) => valText(f, v)), { marks, w: 42, h: 38, emptyText: "(empty)" });
        section(box, title, cellsEl);
      } else if (h.kind === "map") {
        const wrap = D.el("div", { class: "pg-objs" });
        if (!h.entries.length) wrap.appendChild(D.el("span", { class: "small muted", text: "(empty)" }));
        h.entries.forEach((e) => wrap.appendChild(D.el("div", { class: "pg-obj", text: valText(f, e[0]) + " = " + valText(f, e[1]) })));
        section(box, labelFor(f, id, h.cls) + " (" + h.cls + ")", wrap);
      }
    });

    /* remaining objects as cards */
    const cardsEl = D.el("div", { class: "pg-objs" });
    Object.keys(f.heap).map(Number).forEach((id) => {
      const h = f.heap[id];
      if (shownIds.has(id) || h.kind !== "obj") return;
      const before = prev && prev.heap[id];
      const changed = before && JSON.stringify(before.fields) !== JSON.stringify(h.fields);
      const c = D.el("div", { class: "pg-obj" + (changed ? " changed" : "") }, [D.el("b", { text: (refName(f, id) || "") + " " + h.cls })]);
      Object.keys(h.fields).forEach((k) => c.appendChild(D.el("div", { text: k + " = " + valText(f, h.fields[k]) })));
      cardsEl.appendChild(c);
    });
    if (cardsEl.children.length) section(box, "Objects", cardsEl);

    /* output, up to this step */
    const out = q("pg-out");
    out.textContent = output.slice(0, f.out);
    out.scrollTop = out.scrollHeight;
  }

  /* ---------- captions: what this step changed ---------- */
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function diffNote(prev, f) {
    if (!prev) return "";
    const out = [];
    const a = prev.stack[prev.stack.length - 1], b = f.stack[f.stack.length - 1];
    if (a && b && a.id === b.id) {
      Object.keys(b.vars).forEach((k) => {
        if (k === "this") return;
        const x = a.vars[k], y = b.vars[k];
        if (JSON.stringify(x) === JSON.stringify(y)) return;
        out.push(x === undefined ? "<b>" + esc(k) + "</b> is now " + esc(valText(f, y)) : "<b>" + esc(k) + "</b> went from " + esc(valText(prev, x)) + " to " + esc(valText(f, y)));
      });
    }
    Object.keys(f.heap).forEach((id) => {
      const h = f.heap[id], p = prev.heap[id];
      if (!p || h.kind !== p.kind) return;
      if (h.kind === "array" || h.kind === "list") {
        const name = refName(f, +id) || (h.cls || "array");
        h.data.forEach((v, i) => {
          if (JSON.stringify(p.data[i]) !== JSON.stringify(v)) out.push("<b>" + esc(name) + "[" + i + "]</b> became " + esc(valText(f, v)));
        });
        if (h.kind === "list" && p.length !== h.length) out.push("<b>" + esc(name) + "</b> now holds " + h.length);
      } else if (h.kind === "obj") {
        Object.keys(h.fields).forEach((k) => {
          if (JSON.stringify(p.fields[k]) !== JSON.stringify(h.fields[k])) out.push("<b>" + esc((refName(f, +id) || h.cls) + "." + k) + "</b> became " + esc(valText(f, h.fields[k])));
        });
      }
    });
    return out.slice(0, 4).join(", ");
  }
  function buildCaptions(frames, src) {
    const lines = src.split("\n");
    frames.forEach((f, i) => {
      const text = (lines[f.line - 1] || "").trim();
      f.whyLine = text;
      const top = f.stack[f.stack.length - 1];
      f.whyFn = top ? (/(\w+)\(/.exec(top.label) || [])[1] : null;
      f.whyKind = f.event === "call" ? "call" : f.event === "return" && text.replace(/\s/g, "") === "}" ? "return" : null;
      const change = i ? diffNote(frames[i - 1], f) : "";
      let lead;
      if (f.event === "call") lead = "Call <b>" + esc(f.stack[f.stack.length - 1].label) + "</b>: a new frame goes on the stack.";
      else if (f.event === "return") lead = "<b>" + esc(f.fnName) + "</b> " + (f.retVal == null ? "finishes" : "returns <b>" + esc(f.retVal) + "</b>") + ", and its frame leaves the stack.";
      else if (f.event === "throw") lead = "<b>" + esc(f.thrown) + "</b>";
      else lead = "Next: line " + f.line + ", <span class='mono'>" + esc(text.length > 60 ? text.slice(0, 57) + "…" : text) + "</span>";
      f.note = lead + (change ? "<br>Last step: " + change + "." : "");
    });
  }

  /* ---------- running ---------- */
  function setError(msg) { q("pg-err").textContent = msg || ""; }
  function runCode(autoplay) {
    return new Promise((resolve) => runInto(autoplay, resolve));
  }
  function runInto(autoplay, resolve) {
    const code = editor.value;
    setError("");
    if (worker) worker.terminate();
    clearTimeout(timer);
    const btn = q("pg-run");
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Running…";
    const finish = () => { btn.disabled = false; btn.textContent = label; clearTimeout(timer); if (worker) { worker.terminate(); worker = null; } cancelRun = null; resolve(); };
    cancelRun = finish;
    try {
      worker = new Worker(D.asset("assets/js/java-interp.js"));
    } catch (e) {
      finish();
      setError("This browser blocked the code runner. Open the site over http instead of from a file.");
      return;
    }
    worker.onerror = () => { finish(); setError("The code runner crashed. That's a playground bug, not your code: please send feedback."); };
    /* the interpreter stops itself on long programs; this catches anything it cannot stop */
    timer = setTimeout(() => { finish(); setError("Your program ran for over " + RUN_LIMIT_MS / 1000 + " seconds, so it was stopped. Does a loop never end?"); }, RUN_LIMIT_MS);
    worker.onmessage = (e) => {
      const done = finish;
      const r = e.data.result;
      output = r.output || "";
      if (r.error && r.error.kind === "compile") {
        done();
        setError("Line " + r.error.line + ": " + r.error.message);
        player.load([{ errLine: r.error.line, note: "Fix line " + r.error.line + ", then press Run code again." }], false);
        return;
      }
      if (!r.frames.length) { done(); player.load([{ note: "The program finished without running a statement." }], false); return; }
      buildCaptions(r.frames, code);
      if (r.error) {
        setError(r.error.kind === "limit" ? r.error.message : "Line " + r.error.line + ": " + r.error.cls + (r.error.message ? ": " + r.error.message : ""));
      } else if (r.truncated) {
        setError("Too many steps to show, so here are the first " + r.frames.length.toLocaleString("en-US") + ". The output is complete.");
      }
      const end = r.frames[r.frames.length - 1];
      r.frames.push(Object.assign({}, end, {
        event: r.error ? "throw" : "end", retVal: null,
        out: output.length,
        note: r.error ? "The program stopped with an error at line " + r.error.line + "." : "The program finished. Step back through it or change the code.",
        whyLine: null, line: r.error ? r.error.line : null,
      }));
      player.showControls(true);
      player.load(r.frames, autoplay !== false);
      done();
    };
    worker.postMessage({ code });
  }

  /* ---------- the panel ---------- */
  function loadScript(path) {
    return new Promise((res) => {
      const s = document.createElement("script");
      s.src = D.asset(path);
      s.onload = res;
      s.onerror = res;
      document.head.appendChild(s);
    });
  }
  const saved = () => { try { return localStorage.getItem(LS); } catch (e) { return null; } };
  const activeTab = () => { const t = D.$(".panel.main ~ * .tabs button.active, .tabs button.active"); return t ? t.textContent.trim() : ""; };
  const exampleForTab = () => { const t = activeTab(); return examples.find((e) => e.tabs && e.tabs.test(t)) || examples[0]; };
  function setCode(code) { programmatic = true; editor.value = code; programmatic = false; editor.mark(null); }
  function showIntro(text) {
    output = "";
    setError("");
    player.load([{ note: text || "Press <b>Run code</b> to step through it. Each line in <span class='mono'>main</span> calls one function: change its values, or delete it to skip it." }], false);
  }
  function fillSelect(current) {
    const select = q("pg-example");
    select.innerHTML = "";
    if (saved() != null) select.appendChild(D.el("option", { value: MINE, text: "my code" }));
    examples.forEach((e, i) => select.appendChild(D.el("option", { value: String(i), text: e.name })));
    select.value = current;
  }

  function build() {
    if (building) return building;
    building = Promise.all([loadScript("assets/vendor/editor.js"), loadScript("assets/js/playground-examples.js")]).then(() => {
      examples = (D.PLAYGROUND_EXAMPLES && D.PLAYGROUND_EXAMPLES[PAGE]) || [];
      panel.innerHTML =
        '<div class="panel-title"><h2 id="pg-title">Code playground</h2><button type="button" class="ghost" id="pg-close">Close</button></div>' +
        '<div class="toolbar">' +
        '<div class="field"><label for="pg-example">Program</label><select id="pg-example"></select></div>' +
        '<button type="button" class="primary" id="pg-run" title="Ctrl or Cmd + Enter">Run code</button>' +
        "</div>" +
        '<p class="pg-err" id="pg-err" role="alert"></p>' +
        '<div class="pg-grid"><div class="pg-editor" id="pg-editor"></div><div class="stage pg-stage" tabindex="0" role="group" aria-label="What the program is doing"><div id="pg-view"></div><h3>Output</h3><pre class="pg-out" id="pg-out" role="log" aria-label="Program output" tabindex="0"></pre></div></div>' +
        '<div id="pg-player"></div><div id="pg-legend"></div>' +
        '<details class="pg-help"><summary>What Java works here?</summary>' +
        '<p>Your code runs entirely in your browser and is saved on this device. Nothing is uploaded.</p>' +
        '<p>In the editor, Tab indents your code. To move on with the keyboard, press Esc and then Tab.</p>' +
        '<p>This is a teaching interpreter, not a full JDK, so check a program with <span class="mono">javac</span> before you hand it in. Some type errors only appear once the line actually runs.</p>' +
        '<p><b>Works:</b> classes, fields, constructors, static and instance methods, inheritance with <span class="mono">super</span>, generics, recursion, arrays of any dimension, loops, <span class="mono">switch</span>, <span class="mono">try</span> / <span class="mono">catch</span> / <span class="mono">throw</span>, <span class="mono">String</span>, <span class="mono">StringBuilder</span>, <span class="mono">Math</span>, <span class="mono">Arrays</span>, <span class="mono">Collections</span>, <span class="mono">ArrayList</span>, <span class="mono">LinkedList</span>, <span class="mono">Stack</span>, <span class="mono">ArrayDeque</span>, <span class="mono">PriorityQueue</span>, <span class="mono">HashMap</span>, <span class="mono">HashSet</span>.</p>' +
        '<p><b>Not yet:</b> interfaces, enums, lambdas, streams, anonymous classes, threads, files and <span class="mono">Scanner</span> input. <span class="mono">long</span> is exact only up to 2<sup>53</sup>, and <span class="mono">HashMap</span> keeps insertion order rather than Java\'s order.</p>' +
        "</details>";

      const mine = saved();
      const start = mine != null ? mine : (exampleForTab() || { code: FALLBACK }).code;
      edited = mine != null;
      fillSelect(mine != null ? MINE : String(examples.indexOf(exampleForTab())));

      player = new D.Player({ mount: "#pg-player", render: render, delay: 720, onIdle: () => runCode(true) });
      editor = makeEditor(q("pg-editor"), start, (code) => {
        if (programmatic) return;
        editor.mark(null);
        try { localStorage.setItem(LS, code); } catch (e) {}
        if (!edited || q("pg-example").value !== MINE) { edited = true; fillSelect(MINE); }
      }, () => runCode(true));

      q("pg-example").addEventListener("change", (e) => {
        const v = e.target.value;
        if (v === MINE) { setCode(saved() || ""); edited = true; }
        else { setCode(examples[+v].code); edited = false; }
        showIntro();
      });
      q("pg-run").addEventListener("click", () => runCode(true));
      q("pg-close").addEventListener("click", () => toggle(false));

      D.legend("#pg-legend", [
        { color: "var(--c-swap)", label: "changed by the last step" },
        { color: "var(--c-active)", label: "running frame" },
        { color: "var(--c-visit)", label: "waiting frame" },
        { color: "var(--c-done)", label: "returning frame" },
      ]);
      showIntro();
    });
    return building;
  }

  async function toggle(want) {
    const on = want == null ? panel.hidden : want;
    panel.hidden = !on;
    openBtn.setAttribute("aria-expanded", String(on));
    openBtn.classList.toggle("on", on);
    if (!on) {
      if (player) player.pause();
      if (cancelRun) cancelRun();
      openBtn.focus({ preventScroll: true });
      return;
    }
    D._players.forEach((p) => p.pause());
    const firstTime = !building;
    await build();
    /* unchanged code follows the tab the student is on now */
    if (!firstTime && !edited && examples.length) {
      const e = exampleForTab();
      if (e && editor.value !== e.code) { setCode(e.code); fillSelect(String(examples.indexOf(e))); showIntro(); }
    }
    panel.scrollIntoView({ block: "start" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const main = D.$(".panel.main");
    openBtn = q("pg-open");
    if (!main || !openBtn) return;
    panel = D.el("section", { class: "panel playground", id: "playground", hidden: "", "aria-labelledby": "pg-title" });
    main.parentNode.insertBefore(panel, main.nextSibling);
    openBtn.addEventListener("click", () => toggle());
  });
})();
