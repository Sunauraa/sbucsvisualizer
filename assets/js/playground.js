/* ============================================================
   playground.js: edit the code of every visualizer, and run it.

   The code box above each visualizer has an "Edit & run" button. It turns
   that box into an editor holding a whole Java program for the tab the
   student is on; Run code steps through it right there, in place of the
   module's own picture, until "Back to the animation" puts it back. The
   editor and the starter programs load the first time it opens, so a page
   that never uses them doesn't pay for them.

   The interpreter runs in a Web Worker (java-interp.js) and returns
   frames, exactly like a module records its own, so the same Player,
   and its animation work here too.
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
  let dock = null, main = null, away = [];
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
    /* the nodes the running call's variables point at (n, cur, node...): blue, with the variable's name under them */
    const top = f.stack[f.stack.length - 1], pointedBy = {};
    if (top) Object.keys(top.vars).forEach((k) => { const v = top.vars[k]; if (k !== "this" && isRef(v)) pointedBy[v.ref] = (pointedBy[v.ref] ? pointedBy[v.ref] + ", " : "") + k; });
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
        const ptr = pointedBy[n.id];
        g.appendChild(D.svg("circle", { cx: n._x, cy: n._y, r: 17, class: "node-c " + (ptr ? "active" : changed || !before ? "swap" : "") }));
        const label = nodeLabel(f, n.h, links[n.h.cls]);
        g.appendChild(D.sText(n._x, n._y, label, { "font-size": label.length > 3 ? 9 : 12 }));
        if (ptr) g.appendChild(D.sText(n._x, n._y + 28, ptr, { class: "lbl-s", fill: "#2563eb", "font-size": 10.5 }));
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
      const w = 20 + ids.length * (NW + GAP) + 44, h = 68;
      const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + w + " " + h, width: w, height: h, style: "margin:0" });
      svg.appendChild(D.svg("defs", {}, [D.svg("marker", { id: "pgArw", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [D.svg("path", { d: "M0 0L10 5L0 10z", fill: "#666" })])]));
      ids.forEach((id, i) => {
        const x = 10 + i * (NW + GAP);
        const before = prev && prev.heap[id];
        const changed = !before || JSON.stringify(before.fields) !== JSON.stringify(f.heap[id].fields);
        const ptr = pointedBy[id];
        svg.appendChild(D.svg("rect", { x, y: Y, width: NW, height: 34, rx: 7, class: "node-c " + (ptr ? "active" : changed ? "swap" : "") }));
        if (ptr) svg.appendChild(D.sText(x + NW / 2, Y + 46, ptr, { class: "lbl-s", fill: "#2563eb", "font-size": 10.5 }));
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

  /* ---------- what a step did: the pictures a module draws, rebuilt from the raw run ----------
     The interpreter knows only variables, arrays, objects, calls and returns, so these are guesses
     from shape and names: an array of numbers can be bars; a small int named like an index (i, j, lo,
     hi, mid...) is a pointer under the slot it names; the slots a line read light up amber and the
     ones it wrote red; recursive calls grow a call tree; and lists of vertex numbers become a graph. */
  const ARR_LS = "dsa.playground.arrays." + PAGE;
  const arrMode = () => { let v = null; try { v = localStorage.getItem(ARR_LS); } catch (e) {} return v || (PAGE === "sorting" ? "bars" : "boxes"); };
  const IDX_NAME = /^([ijkpqrs]|lo|hi|low|high|mid|left|right|l|r|m|start|end|first|last|front|rear|top|head|tail|pos|idx|index|child|parent|largest|smallest)$|(Idx|Index|Pos)$/;
  const asInt = (v) => (typeof v === "string" && /^-?\d+$/.test(v) ? +v : null);
  const isNumText = (v) => typeof v === "string" && /^-?\d+(\.\d+)?(E-?\d+)?$/.test(v);
  /* index-like ints of the running call and of the object it runs on, and the arrays they can point into */
  function pointerVars(f) {
    const top = f.stack[f.stack.length - 1], list = [], refs = new Set();
    if (!top) return { list, refs };
    const take = (name, v) => {
      if (isRef(v)) { refs.add(v.ref); return; }
      const n = asInt(v);
      if (n != null && IDX_NAME.test(name)) list.push({ name, v: n });
    };
    Object.keys(top.vars).forEach((k) => { if (k !== "this") take(k, top.vars[k]); });
    const self = top.vars.this;
    if (isRef(self) && f.heap[self.ref] && f.heap[self.ref].kind === "obj") { const fl = f.heap[self.ref].fields; Object.keys(fl).forEach((k) => take(k, fl[k])); }
    return { list, refs };
  }
  /* amber: read by the last step (a comparison); red: written by it */
  function stepMarks(f, prev, id, h) {
    const marks = {};
    (f.rd || []).forEach((r) => { if (r[0] === id && r[1] < h.data.length) marks[r[1]] = "cmp"; });
    const before = prev && prev.heap[id];
    h.data.forEach((v, j) => { if (before && before.data && JSON.stringify(before.data[j]) !== JSON.stringify(v)) marks[j] = "swap"; });
    return marks;
  }
  function ptrMap(pv, id, len) {
    const out = {};
    if (!pv.refs.has(id)) return out;
    pv.list.forEach((p) => { if (p.v >= 0 && p.v < len) out[p.v] = out[p.v] ? out[p.v] + " " + p.name : p.name; });
    return out;
  }
  function barsView(vals, marks, ptrs) {
    const nums = vals.map(Number);
    const hi = Math.max(0, ...nums), lo = Math.min(0, ...nums), span = hi - lo || 1;
    const wrap = D.el("div", { class: "pg-barwrap" });
    const bars = D.el("div", { class: "bars labeled pg-bars" });
    nums.forEach((v, k) => {
      const b = D.el("div", { class: "bar " + (v < 0 ? "neg " : "") + (marks[k] || "") }, [D.el("span", { class: "lbl", text: vals.length <= 40 ? vals[k] : "" })]);
      b.style.height = Math.max(0.7, (Math.abs(v) / span) * 100) + "%";
      b.style.bottom = ((Math.min(v, 0) - lo) / span) * 100 + "%";
      b.dataset.v = vals[k];
      bars.appendChild(b);
    });
    if (lo < 0) bars.appendChild(D.el("div", { class: "zero-line", style: "bottom:" + (-lo / span) * 100 + "%" }));
    wrap.appendChild(bars);
    if (Object.keys(ptrs).length) {
      const row = D.el("div", { class: "pg-ptrs", "data-motion": "off", "aria-hidden": "true" });
      vals.forEach((v, k) => row.appendChild(D.el("span", { text: ptrs[k] || "" })));
      wrap.appendChild(row);
    }
    return wrap;
  }

  /* ---------- the call tree of a recursive program (one box per call, as on the Recursion page) ---------- */
  const callsCache = new WeakMap();
  function buildCalls(frames) {
    if (callsCache.has(frames)) return callsCache.get(frames);
    const nodes = [], byId = {};
    frames.forEach((f, idx) => {
      const top = f.stack && f.stack[f.stack.length - 1];
      if (!top) return;
      if (f.event === "call" && !byId[top.id]) {
        if (/^main\(/.test(top.label) || /^new /.test(top.label)) return;   /* where it starts, and constructors, are not calls worth a box */
        const below = f.stack[f.stack.length - 2];
        const parent = below && byId[below.id] ? byId[below.id] : null;
        const nd = { id: top.id, label: top.label, fn: (/^([\w$]+)/.exec(top.label) || [])[1], parent: parent, kids: [], born: idx, doneAt: Infinity, ret: null };
        if (parent) parent.kids.push(nd);
        byId[top.id] = nd;
        nodes.push(nd);
      } else if (f.event === "return" && byId[top.id] && byId[top.id].doneAt === Infinity) {
        byId[top.id].doneAt = idx;
        byId[top.id].ret = f.retVal;
      }
    });
    const out = nodes.some((n) => n.parent && n.parent.fn === n.fn) ? nodes : null;
    if (out) {
      /* sideways, like the Recursion page: each call's calls to its right, siblings stacked; the whole
         run's tree, so the picture keeps its size */
      const NW = Math.min(160, Math.max(56, ...nodes.map((n) => n.label.length * 6.7 + 16))), gapX = NW + 30, gapY = 50;
      let leaf = 0, maxD = 0;
      const walk = (n, d) => {
        n.d = d; maxD = Math.max(maxD, d); n.x = 8 + NW / 2 + d * gapX;
        if (!n.kids.length) n.y = 20 + leaf++ * gapY;
        else { n.kids.forEach((k) => walk(k, d + 1)); n.y = (n.kids[0].y + n.kids[n.kids.length - 1].y) / 2; }
      };
      nodes.filter((n) => !n.parent).forEach((r) => walk(r, 0));
      out.geo = { w: Math.max(200, 16 + NW + maxD * gapX), h: 20 + (leaf - 1) * gapY + 38, nw: NW };
    }
    callsCache.set(frames, out);
    return out;
  }
  const CALLS_MAX = 160;
  function drawCalls(parent, f, i, frames) {
    const nodes = buildCalls(frames);
    if (!nodes) return;
    if (nodes.length > CALLS_MAX) { section(parent, "Recursion tree", D.el("p", { class: "small muted", text: nodes.length + " calls: too many to draw clearly. Try a smaller input." })); return; }
    const g = nodes.geo, NH = 26, top = f.stack[f.stack.length - 1];
    const onStack = new Set(f.stack.map((fr) => fr.id));
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + g.w + " " + g.h, width: g.w, height: g.h, style: "max-width:100%;min-width:" + Math.round(g.w * 0.7) + "px;height:auto;margin:0 auto;display:block" });
    const shown = nodes.filter((n) => n.born <= i);
    shown.forEach((n) => { if (n.parent && n.parent.born <= i) svg.appendChild(D.sLine(n.parent.x + g.nw / 2, n.parent.y, n.x - g.nw / 2, n.y, "edge " + (n.doneAt <= i ? "tree" : "on"))); });
    shown.forEach((n) => {
      const st = n.doneAt <= i ? "done" : top && n.id === top.id ? "active" : onStack.has(n.id) ? "visit" : "done";
      const gEl = D.svg("g", {});
      gEl.appendChild(D.svg("rect", { x: n.x - g.nw / 2, y: n.y - NH / 2, width: g.nw, height: NH, rx: 7, class: "node-c " + st }));
      gEl.appendChild(D.sText(n.x, n.y, n.label, { "font-size": Math.min(11.5, (g.nw - 8) / Math.max(1, n.label.length * 0.62)) }));
      if (n.doneAt <= i && n.ret != null) gEl.appendChild(D.sText(n.x, n.y + NH / 2 + 10, "↩ " + n.ret, { class: "lbl-s", fill: "#16a34a", "font-size": 10 }));
      svg.appendChild(gEl);
    });
    /* a window that follows the running call, not the whole tree */
    const win = wrapCanvas(svg);
    win.style.maxHeight = "240px";
    win.style.overflow = "auto";
    win.tabIndex = 0;
    section(parent, "Recursion tree (blue: running · purple: waiting · green: returned)", win);
    const cur = top && nodes.find((n) => n.id === top.id && n.born <= i);
    if (cur) Promise.resolve().then(() => {
      const k = svg.getBoundingClientRect().width / g.w || 1;
      if (win.scrollHeight > win.clientHeight) win.scrollTop = Math.max(0, cur.y * k - win.clientHeight / 2);
      if (win.scrollWidth > win.clientWidth) win.scrollLeft = Math.max(0, cur.x * k - win.clientWidth / 2);
    });
  }

  /* ---------- a graph, from adjacency lists or a 0/1 adjacency matrix ---------- */
  const GRAPH_NAME = /adj|graph|^g$|edges|neigh|matrix/i;
  function findGraph(f) {
    for (const id of Object.keys(f.heap)) {
      const h = f.heap[id];
      if ((h.kind !== "array" && h.kind !== "list") || !h.data || h.data.length < 2 || h.data.length > 26 || h.length !== h.data.length) continue;
      const V = h.data.length;
      const rows = h.data.map((v) => (isRef(v) && f.heap[v.ref] && f.heap[v.ref].data ? f.heap[v.ref] : null));
      if (rows.some((r) => !r || r.length !== r.data.length)) continue;
      const name = refName(f, +id) || "";
      const bit = (x) => x === "1" || x === "true";
      if (rows.every((r) => r.data.length === V && r.data.every((x) => bit(x) || x === "0" || x === "false"))) {
        if (!GRAPH_NAME.test(name) && h.elem !== "boolean[]") continue;
        const edges = [];
        rows.forEach((r, u) => r.data.forEach((x, v) => { if (bit(x) && u !== v) edges.push([u, v]); }));
        return { id: +id, V, edges, name, rowIds: h.data.map((v) => v.ref) };
      }
      const listy = rows.every((r) => r.kind === "list");
      if (!(listy || GRAPH_NAME.test(name))) continue;
      if (!rows.every((r) => r.data.every((x) => { const n = asInt(x); return n != null && n >= 0 && n < V; }))) continue;
      const edges = [];
      rows.forEach((r, u) => r.data.forEach((x) => edges.push([u, asInt(x)])));
      return { id: +id, V, edges, name, rowIds: h.data.map((v) => v.ref) };
    }
    return null;
  }
  function drawGraph(parent, f) {
    const G = findGraph(f);
    if (!G) return;
    const V = G.V, has = new Set(G.edges.map((e) => e[0] + ">" + e[1]));
    const directed = G.edges.some((e) => !has.has(e[1] + ">" + e[0]));
    /* what the run is doing to it: visited flags, the queue or stack, and the vertices u and v in hand */
    const state = new Array(V).fill("");
    const rowIds = new Set(G.rowIds || []);
    Object.keys(f.heap).forEach((id) => {
      const h = f.heap[id];
      if (+id === G.id || rowIds.has(+id) || !h.data) return;
      const nm = refName(f, +id) || "";
      if (h.kind === "array" && h.data.length === V && /visit|seen|mark|disc|done|explored|color/i.test(nm))
        h.data.forEach((x, k) => { if (x === "true" || (asInt(x) || 0) > 0) state[k] = "done"; });
    });
    Object.keys(f.heap).forEach((id) => {
      const h = f.heap[id];
      if (+id === G.id || rowIds.has(+id) || h.kind !== "list") return;
      if (/Deque|Queue|Stack|LinkedList/.test(h.cls || "") || /queue|^q$|stack|frontier|deque/i.test(refName(f, +id) || ""))
        h.data.forEach((x) => { const n = asInt(x); if (n != null && n >= 0 && n < V) state[n] = "cmp"; });
    });
    const top = f.stack[f.stack.length - 1];
    if (top) Object.keys(top.vars).forEach((k) => {
      const n = asInt(top.vars[k]);
      if (n == null || n < 0 || n >= V) return;
      if (/^(u|cur|curr|current|node|s|src|source|start|from|vertex)$/.test(k)) state[n] = "active";
      else if (/^(v|w|nbr|next|neighbor|neighbour|to|adjV)$/.test(k) && state[n] !== "active") state[n] = "target";
    });
    const R = Math.max(70, V * 15), cx = R + 30, cy = R + 26, W = 2 * R + 60, H = 2 * R + 52, r = 15;
    const P = Array.from({ length: V }, (_, k) => ({ x: cx + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * k) / V), y: cy + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * k) / V) }));
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + W + " " + H, width: W, height: H, style: "max-width:100%;height:auto;margin:0 auto;display:block" });
    if (directed) svg.appendChild(D.svg("defs", {}, [D.svg("marker", { id: "pgGArw", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [D.svg("path", { d: "M0 0L10 5L0 10z", fill: "#666" })])]));
    const drawn = new Set();
    G.edges.forEach(([u, v]) => {
      if (u === v) return;
      if (!directed && drawn.has(v + ">" + u)) return;
      drawn.add(u + ">" + v);
      const a = P[u], b = P[v], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const ln = D.sLine(a.x + (dx / d) * r, a.y + (dy / d) * r, b.x - (dx / d) * (r + (directed ? 2 : 0)), b.y - (dy / d) * (r + (directed ? 2 : 0)), "edge");
      if (directed) ln.setAttribute("marker-end", "url(#pgGArw)");
      svg.appendChild(ln);
    });
    P.forEach((p, k) => {
      const g = D.svg("g", {});
      g.appendChild(D.svg("circle", { cx: p.x, cy: p.y, r: r, class: "node-c " + state[k] }));
      g.appendChild(D.sText(p.x, p.y, String(k), { "font-size": 12 }));
      svg.appendChild(g);
    });
    section(parent, "Graph " + (G.name || "") + " (green: visited · amber: in the queue or stack · blue: u · teal: v)", wrapCanvas(svg));
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
    drawGraph(box, f);
    const pv = pointerVars(f);

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
        const marks = stepMarks(f, prev, v.ref, row);
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
        const marks = stepMarks(f, prev, id, h);
        const ptrs = ptrMap(pv, id, h.data.length);
        const title = labelFor(f, id, h.cls || h.elem + "[]") + (h.kind === "list" ? " (" + h.cls + ")" : "") + (h.length > h.data.length ? " (first " + h.data.length + " of " + h.length + ")" : "");
        const vals = h.data.map((v) => valText(f, v));
        const asBars = arrMode() === "bars" && h.kind === "array" && vals.length >= 2 && vals.length <= 60 && vals.every(isNumText);
        section(box, title, asBars ? barsView(vals, marks, ptrs) : D.cells(vals, { marks, ptrs, w: 42, h: 38, emptyText: "(empty)" }));
      } else if (h.kind === "map") {
        const wrap = D.el("div", { class: "pg-objs" });
        if (!h.entries.length) wrap.appendChild(D.el("span", { class: "small muted", text: "(empty)" }));
        h.entries.forEach((e) => wrap.appendChild(D.el("div", { class: "pg-obj", text: valText(f, e[0]) + " = " + valText(f, e[1]) })));
        section(box, labelFor(f, id, h.cls) + " (" + h.cls + ")", wrap);
      }
    });

    drawCalls(box, f, i, frames);

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
        '<div class="toolbar">' +
        '<div class="field"><label for="pg-example">Program</label><select id="pg-example"></select></div>' +
        '<button type="button" class="primary" id="pg-run" title="Ctrl or Cmd + Enter">▶ Run code</button>' +
        '<div class="field"><label for="pg-arr">Arrays as</label><select id="pg-arr" style="width:auto"><option value="boxes">boxes</option><option value="bars">bars</option></select></div>' +
        '<div class="spacer"></div>' +
        '<button type="button" id="pg-close" title="Close the editor and show the visualizer again">← Back to the animation</button>' +
        "</div>" +
        '<p class="pg-err" id="pg-err" role="alert"></p>' +
        '<div class="pg-grid"><div class="pg-editor" id="pg-editor"></div><div class="stage pg-stage" tabindex="0" role="group" aria-label="What the program is doing"><div id="pg-view"></div><h3>Output</h3><pre class="pg-out" id="pg-out" role="log" aria-label="Program output" tabindex="0"></pre></div></div>' +
        '<div id="pg-player"></div>';

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
      q("pg-arr").value = arrMode();
      q("pg-arr").addEventListener("change", (e) => { try { localStorage.setItem(ARR_LS, e.target.value); } catch (err) {} if (player) player.goto(player.index); });
      q("pg-close").addEventListener("click", () => toggle(false));

      showIntro();
    });
    return building;
  }

  /* the rest of the visualizer (its controls, its picture, its player) steps aside while the student's code runs */
  function stepAside(on) {
    away.forEach((n) => n.classList.remove("pg-away"));
    away = [];
    if (!on) return;
    for (let n = dock; n && n !== main; n = n.parentElement)
      Array.from(n.parentElement.children).forEach((c) => { if (c !== n) { c.classList.add("pg-away"); away.push(c); } });
  }
  const isOpen = () => !!panel && !panel.hidden;
  /* unchanged code follows the tab the student is on now */
  function followTab() {
    if (edited || !examples.length) return;
    const e = exampleForTab();
    if (e && editor.value !== e.code) { setCode(e.code); fillSelect(String(examples.indexOf(e))); if (cancelRun) cancelRun(); showIntro(); }
  }

  async function toggle(want) {
    const on = want == null ? !isOpen() : want;
    panel.hidden = !on;
    dock.classList.toggle("editing", on);
    openBtn.setAttribute("aria-expanded", String(on));
    stepAside(on);
    /* the visualizer and the editor are different heights: let the panel find its own again */
    main.style.minHeight = ""; main._holdRun = null;
    if (!on) {
      if (player) player.pause();
      if (cancelRun) cancelRun();
      openBtn.focus({ preventScroll: true });
      dock.scrollIntoView({ block: "nearest" });
      return;
    }
    D._players.forEach((p) => p.pause());
    const firstTime = !building;
    await build();
    if (!firstTime) followTab();
    dock.scrollIntoView({ block: "start" });
  }

  /* after every page script's own DOMContentLoaded work, since that is where the code box gets made */
  document.addEventListener("DOMContentLoaded", () => setTimeout(() => {
    main = D.$(".panel.main");
    dock = main && D.$("#code.code-dock", main);
    const head = dock && D.$(".code-head", dock);
    if (!head) return;
    openBtn = D.el("button", { type: "button", class: "code-edit pg-open", id: "pg-open", "aria-expanded": "false", "aria-controls": "playground", title: "Change this code and watch it run step by step", text: "✎ Edit & run" });
    head.insertBefore(openBtn, D.$(".code-hide", head));
    head.insertBefore(D.el("div", { class: "code-edit-title", html: "Your code <span class='muted'>· Java, runs right here, step by step</span>" }), head.firstChild);
    panel = D.el("div", { class: "playground pg-pane", id: "playground", hidden: "", role: "region", "aria-label": "Edit and run the code" });
    dock.appendChild(panel);
    openBtn.addEventListener("click", () => toggle(true));
    /* switching tabs while editing: the module draws its new tab behind the editor, and untouched code follows it */
    document.addEventListener("click", (e) => {
      if (isOpen() && e.target.closest && e.target.closest(".tabs button")) setTimeout(() => { stepAside(true); if (editor) followTab(); }, 0);
    });
  }, 0));
})();
