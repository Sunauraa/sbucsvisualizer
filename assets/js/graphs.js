/* ============================================================
   graphs.js — build a graph by clicking, then run BFS / DFS
   with a live queue or stack, adjacency matrix and adjacency list
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const q = (id) => D.$("#" + id);

  const VW = 760, VH = 400, R = 18;
  const G = { pos: [], adj: [], directed: false, weighted: false, w: {} };
  let player, tool = "add", dragging = -1, pendingEdge = -1;

  const name = (i) => (i < 26 ? String.fromCharCode(65 + i) : "V" + i);
  const nCount = () => G.pos.length;
  const ekey = (u, v) => (G.directed ? u + ">" + v : Math.min(u, v) + "-" + Math.max(u, v));

  /* ---------------- graph mutation ---------------- */
  function addNode(x, y) {
    if (nCount() >= 12) return D.toast("12 vertices is plenty for a visualizer.", true);
    G.pos.push({ x: D.clamp(x, R + 4, VW - R - 4), y: D.clamp(y, R + 4, VH - R - 4) });
    G.adj.push([]);
    refresh("Added vertex <b>" + name(nCount() - 1) + "</b>.");
  }
  function delNode(i) {
    G.pos.splice(i, 1);
    G.adj.splice(i, 1);
    G.adj = G.adj.map((l) => l.filter((v) => v !== i).map((v) => (v > i ? v - 1 : v)));
    refresh("Deleted a vertex. Note that every edge touching it had to go too.");
  }
  function toggleEdge(u, v) {
    if (u === v) return;
    const has = G.adj[u].indexOf(v) >= 0;
    if (has) {
      G.adj[u] = G.adj[u].filter((x) => x !== v);
      if (!G.directed) G.adj[v] = G.adj[v].filter((x) => x !== u);
      refresh("Removed edge " + name(u) + (G.directed ? "→" : "–") + name(v) + ".");
    } else {
      G.adj[u].push(v);
      G.adj[u].sort((a, b) => a - b);
      if (!G.directed) { G.adj[v].push(u); G.adj[v].sort((a, b) => a - b); }
      refresh("Added edge " + name(u) + (G.directed ? "→" : "–") + name(v) + ".");
    }
  }
  function edgeList() {
    const out = [], seen = {};
    for (let u = 0; u < nCount(); u++)
      G.adj[u].forEach((v) => {
        const k = ekey(u, v);
        if (!G.directed && seen[k]) return;
        seen[k] = 1;
        out.push({ u: u, v: v, k: k });
      });
    return out;
  }
  const edgeCount = () => edgeList().length;

  /* ---------------- presets ---------------- */
  const PRESETS = {
    sample: () => {
      set([[120, 80], [300, 60], [470, 90], [630, 70], [110, 250], [290, 220], [470, 250], [640, 240], [380, 350]],
        [[0, 1], [0, 4], [1, 2], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [5, 6], [5, 8], [6, 7], [6, 8]]);
    },
    tree: () => {
      set([[380, 50], [200, 140], [560, 140], [110, 240], [290, 240], [470, 240], [650, 240], [70, 340], [160, 340], [430, 340]],
        [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [3, 7], [3, 8], [5, 9]]);
    },
    cycle: () => {
      const n = 8, pts = [], es = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pts.push([380 + 150 * Math.cos(a), 200 + 140 * Math.sin(a)]);
        es.push([i, (i + 1) % n]);
      }
      set(pts, es);
    },
    complete: () => {
      const n = 6, pts = [], es = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pts.push([380 + 150 * Math.cos(a), 200 + 140 * Math.sin(a)]);
        for (let j = 0; j < i; j++) es.push([j, i]);
      }
      set(pts, es);
    },
    grid: () => {
      const pts = [], es = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) pts.push([160 + c * 150, 90 + r * 110]);
      const id = (r, c) => r * 4 + c;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        if (c < 3) es.push([id(r, c), id(r, c + 1)]);
        if (r < 2) es.push([id(r, c), id(r + 1, c)]);
      }
      set(pts, es);
    },
    disconnected: () => {
      set([[140, 100], [280, 70], [230, 210], [110, 230], [500, 90], [640, 130], [520, 250], [400, 330], [660, 320]],
        [[0, 1], [0, 3], [1, 2], [2, 3], [4, 5], [5, 6], [4, 6], [7, 8]]);
    },
    random: () => {
      const n = D.randInt(7, 9), pts = [], es = [];
      for (let i = 0; i < n; i++) pts.push([D.randInt(70, VW - 70), D.randInt(60, VH - 60)]);
      for (let i = 1; i < n; i++) es.push([D.randInt(0, i - 1), i]);          /* keep it connected */
      for (let k = 0; k < n; k++) { const a = D.randInt(0, n - 1), b = D.randInt(0, n - 1); if (a !== b) es.push([a, b]); }
      set(pts, es);
    },
  };
  function set(pts, es) {
    G.pos = pts.map((p) => ({ x: p[0], y: p[1] }));
    G.adj = pts.map(() => []);
    es.forEach((e) => {
      if (G.adj[e[0]].indexOf(e[1]) < 0) G.adj[e[0]].push(e[1]);
      if (!G.directed && G.adj[e[1]].indexOf(e[0]) < 0) G.adj[e[1]].push(e[0]);
    });
    G.adj.forEach((l) => l.sort((a, b) => a - b));
  }

  /* ---------------- traversals ---------------- */
  function Ctx(limit, code) {
    const R2 = new D.Recorder(limit || 900);
    return {
      frames: R2.frames,
      snap(o) { R2.push(Object.assign({ ns: {}, es: {}, tags: {}, queue: null, stack: null, note: "", mhl: null, lhl: null, order: [], code: code }, o)); },
    };
  }

  function bfs(start) {
    const c = Ctx(1200, "bfs");
    const n = nCount();
    const state = {}, dist = {}, parent = {}, order = [];
    const Q = [];
    const ns = () => {
      const o = {};
      for (let i = 0; i < n; i++) o[i] = state[i] === 2 ? "done" : state[i] === 1 ? "cmp" : "";
      return o;
    };
    const tags = () => {
      const o = {};
      for (let i = 0; i < n; i++) if (dist[i] != null) o[i] = "d=" + dist[i];
      return o;
    };
    const tre = {};
    c.snap({ line: null, ns: ns(), note: "<b>BFS from " + name(start) + ".</b> Every vertex is <em>undiscovered</em>; the queue is empty.", queue: [], tags: tags() });
    state[start] = 1; dist[start] = 0; Q.push(start);
    c.snap({ line: "init", ns: Object.assign(ns(), { [start]: "active" }), note: "Discover " + name(start) + " with dist 0 and <b>enqueue</b> it. Marking it discovered <em>now</em> (not when it is dequeued) is what stops a vertex entering the queue twice.", queue: Q.slice(), tags: tags(), es: Object.assign({}, tre) });
    c.snap({ line: "loop", ns: Object.assign(ns(), { [start]: "active" }), note: "The queue holds " + name(start) + ", so it is not empty — enter the loop.", queue: Q.slice(), tags: tags(), es: Object.assign({}, tre) });
    while (Q.length) {
      const u = Q.shift();
      order.push(u);
      c.snap({ line: "deq", ns: Object.assign(ns(), { [u]: "active" }), note: "<b>Dequeue " + name(u) + "</b> (dist " + dist[u] + "). Everything in the queue is at distance " + dist[u] + " or " + (dist[u] + 1) + " — BFS never mixes more than two levels.", queue: Q.slice(), tags: tags(), es: Object.assign({}, tre), lhl: u, order: order.slice() });
      for (const v of G.adj[u]) {
        const nsx = ns();
        nsx[u] = "active";
        if (!state[v]) nsx[v] = "target";
        c.snap({ line: ["nbr", "check"], ns: nsx, es: Object.assign({}, tre, { [ekey(u, v)]: "on" }), note: "Next neighbour of " + name(u) + " is " + name(v) + ": " + (state[v] ? "already discovered, so <b>skip</b> it — this edge is not part of the BFS tree." : "<b>undiscovered</b>."), queue: Q.slice(), tags: tags(), mhl: { r: u, c: v }, lhl: u, order: order.slice() });
        if (!state[v]) {
          state[v] = 1; dist[v] = dist[u] + 1; parent[v] = u;
          tre[ekey(u, v)] = "tree";
          Q.push(v);
          c.snap({ line: "set", ns: ns(), es: Object.assign({}, tre), note: "Set dist[" + name(v) + "] = dist[" + name(u) + "] + 1 = " + dist[v] + ", parent = " + name(u) + ", and enqueue. Because the queue is FIFO, this is guaranteed to be the <b>shortest</b> path in edges.", queue: Q.slice(), tags: tags(), mhl: { r: u, c: v }, lhl: u, order: order.slice() });
        }
      }
      state[u] = 2;
      c.snap({ line: "loop", ns: ns(), es: Object.assign({}, tre), note: (G.adj[u].length ? "No neighbours of " + name(u) + " are left" : name(u) + " has no neighbours") + ", so it is finished. Back to the while test: the queue " + (Q.length ? "still holds " + Q.map(name).join(", ") + "." : "is <b>empty</b>, so the loop ends."), queue: Q.slice(), tags: tags(), order: order.slice() });
    }
    const unreached = [];
    for (let i = 0; i < n; i++) if (!state[i]) unreached.push(name(i));
    c.snap({
      line: null, ns: ns(), es: Object.assign({}, tre), queue: [], tags: tags(), order: order.slice(),
      note: "BFS is done. Visit order: <b>" + order.map(name).join(" ") + "</b>. " +
        (unreached.length ? "Never reached: <b>" + unreached.join(", ") + "</b> — they are in different connected components." : "Every vertex was reached, so the graph is connected from " + name(start) + ".") +
        " The green edges form the <b>BFS tree</b>, and each dist label is a shortest-path length. Total work Θ(V + E).",
    });
    return c;
  }

  function dfs(start, forest) {
    const c = Ctx(1600, "dfs");
    const n = nCount();
    const color = {}, disc = {}, fin = {}, stack = [], order = [];
    let time = 0;
    const tre = {};
    const ns = () => {
      const o = {};
      for (let i = 0; i < n; i++) o[i] = color[i] === 2 ? "done" : color[i] === 1 ? "cmp" : "";
      return o;
    };
    const tags = () => {
      const o = {};
      for (let i = 0; i < n; i++) if (disc[i] != null) o[i] = disc[i] + "/" + (fin[i] == null ? "…" : fin[i]);
      return o;
    };
    c.snap({ line: forest ? "forest" : null, ns: ns(), stack: [], note: "<b>DFS from " + name(start) + ".</b> Labels below each vertex will show <span class='mono'>discovery/finish</span> times. White = undiscovered, amber = on the stack (grey), green = finished (black).", tags: tags() });

    function visit(u) {
      color[u] = 1; disc[u] = ++time; stack.push(u); order.push(u);
      c.snap({ line: "disc", ns: Object.assign(ns(), { [u]: "active" }), es: Object.assign({}, tre), stack: stack.slice(), tags: tags(), lhl: u, order: order.slice(), note: "<b>Discover " + name(u) + "</b> at time " + disc[u] + " and push it. DFS goes as deep as it can before backtracking." });
      for (const v of G.adj[u]) {
        const kind = !color[v] ? "tree" : color[v] === 1 ? "back" : disc[u] < disc[v] ? "forward" : "cross";
        c.snap({
          line: !color[v] ? ["nbr", "check", "rec"] : ["nbr", "check"], ns: Object.assign(ns(), { [u]: "active" }), es: Object.assign({}, tre, { [ekey(u, v)]: "on" }), stack: stack.slice(), tags: tags(), mhl: { r: u, c: v }, lhl: u, order: order.slice(),
          note: "Edge " + name(u) + "→" + name(v) + ": " + name(v) + " is " +
            (!color[v] ? "<b>white</b>, so this is a <b>tree edge</b> — call DFS(" + name(v) + ") and go deeper. " + name(u) + " waits on the stack." :
              color[v] === 1 ? "<b>grey</b> (still on the stack), so this is a <b>back edge</b> — it closes a cycle." :
                G.directed ? "<b>black</b>, so this is a <b>" + kind + " edge</b> (no new information)." : "already finished — in an undirected graph this is just the edge we came in on, seen from the other side."),
        });
        if (!color[v]) { tre[ekey(u, v)] = "tree"; visit(v); c.snap({ line: "rec", ns: Object.assign(ns(), { [u]: "active" }), es: Object.assign({}, tre), stack: stack.slice(), tags: tags(), lhl: u, order: order.slice(), note: "Back at " + name(u) + " after finishing that subtree — continue with its remaining neighbours." }); }
      }
      color[u] = 2; fin[u] = ++time; stack.pop();
      c.snap({ line: "fin", ns: ns(), es: Object.assign({}, tre), stack: stack.slice(), tags: tags(), order: order.slice(), note: (G.adj[u].length ? "The neighbour loop is done" : name(u) + " has no neighbours") + " — no unexplored edges left at " + name(u) + " — <b>finish</b> it at time " + fin[u] + " and pop. Its whole subtree is done." });
    }

    visit(start);
    if (forest) {
      for (let i = 0; i < n; i++)
        if (!color[i]) {
          c.snap({ line: "forest", ns: ns(), es: Object.assign({}, tre), stack: [], tags: tags(), order: order.slice(), note: "The stack is empty but " + name(i) + " is still white — it is in another component. Start a <b>new DFS tree</b> there. Repeating this over all vertices is how you count connected components." });
          visit(i);
        }
    }
    const unreached = [];
    for (let i = 0; i < n; i++) if (!color[i]) unreached.push(name(i));
    c.snap({
      line: null, ns: ns(), es: Object.assign({}, tre), stack: [], tags: tags(), order: order.slice(),
      note: "DFS complete. Discovery order: <b>" + order.map(name).join(" ") + "</b>. " +
        (unreached.length ? "Unreached: <b>" + unreached.join(", ") + "</b> (try <em>DFS forest</em> to cover them). " : "") +
        "Every vertex has an interval [disc, fin]; two intervals are either nested or disjoint — never partially overlapping. That is the <b>parenthesis theorem</b>, and it is why sorting by decreasing finish time gives a topological order. Θ(V + E).",
    });
    return c;
  }

  /* ---------------- rendering ---------------- */
  function render(f) {
    const host = q("gr-canvas");
    host.innerHTML = "";
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + VW + " " + VH, width: VW, height: VH, style: "max-width:100%;height:auto;margin:0 auto;cursor:" + (tool === "add" ? "crosshair" : "pointer") });
    svg.appendChild(D.svg("defs", {}, [mk("gArw", "#5b6a92"), mk("gArwOn", "#6ea8fe"), mk("gArwTree", "#4ade80")]));
    svg.appendChild(D.svg("rect", { x: 0, y: 0, width: VW, height: VH, fill: "transparent" }));

    edgeList().forEach((e) => {
      const a = G.pos[e.u], b = G.pos[e.v];
      const st = (f.es && (f.es[e.k] || f.es[ekey(e.v, e.u)])) || "";
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const x1 = a.x + Math.cos(ang) * R, y1 = a.y + Math.sin(ang) * R;
      const x2 = b.x - Math.cos(ang) * R, y2 = b.y - Math.sin(ang) * R;
      const line = D.sLine(x1, y1, x2, y2, "edge " + st);
      if (G.directed) line.setAttribute("marker-end", "url(#" + (st === "tree" ? "gArwTree" : st === "on" ? "gArwOn" : "gArw") + ")");
      svg.appendChild(line);
    });

    for (let i = 0; i < nCount(); i++) {
      const p = G.pos[i];
      const cls = (f.ns && f.ns[i]) || "";
      const g = D.svg("g", { style: "cursor:grab", "data-node": i });
      g.appendChild(D.svg("circle", { cx: p.x, cy: p.y, r: R, class: "node-c " + cls + (pendingEdge === i ? " target" : "") }));
      g.appendChild(D.sText(p.x, p.y, name(i), { "font-size": 13 }));
      if (f.tags && f.tags[i]) g.appendChild(D.sText(p.x, p.y + R + 11, f.tags[i], { class: "lbl-s", fill: "#ffc14d", "font-size": 11 }));
      svg.appendChild(g);
    }
    if (!nCount()) svg.appendChild(D.sText(VW / 2, VH / 2, "click anywhere to add a vertex", { class: "lbl-s", "font-size": 14 }));
    host.appendChild(svg);

    /* queue / stack */
    const fr = q("frontier");
    const list = f.queue || f.stack;
    fr.innerHTML = "";
    if (list) {
      fr.appendChild(D.el("div", { class: "small muted", text: f.queue ? "queue (FIFO — dequeue from the left)" : "stack (LIFO — the current DFS path)", style: "margin-bottom:.35rem" }));
      const row = D.el("div", { class: "cells" });
      if (!list.length) row.appendChild(D.el("div", { class: "small muted", text: "(empty)" }));
      list.forEach((i, k) =>
        row.appendChild(D.el("div", { class: "cell filled " + (k === 0 && f.queue ? "target" : k === list.length - 1 && f.stack ? "active" : "cmp"), text: name(i), style: "min-width:36px;height:32px;font-size:.78rem" }))
      );
      fr.appendChild(row);
      if (f.order && f.order.length) fr.appendChild(D.el("div", { class: "small mono", style: "margin-top:.5rem;color:var(--c-done)", text: "visited: " + f.order.map(name).join(" ") }));
    }

    /* matrix */
    const mv = q("matrix");
    mv.innerHTML = "";
    const n = nCount();
    const tbl = D.el("table", { class: "tbl" });
    let head = "<tr><th></th>";
    for (let j = 0; j < n; j++) head += "<th" + (f.mhl && f.mhl.c === j ? ' class="hl"' : "") + ">" + name(j) + "</th>";
    head += "</tr>";
    let body = "";
    for (let i = 0; i < n; i++) {
      body += "<tr><th" + (f.mhl && f.mhl.r === i ? ' class="hl"' : "") + ">" + name(i) + "</th>";
      for (let j = 0; j < n; j++) {
        const one = G.adj[i].indexOf(j) >= 0;
        const hl = f.mhl && f.mhl.r === i && f.mhl.c === j;
        body += "<td class='" + (one ? "one" : "") + (hl ? " hl" : "") + "'>" + (one ? 1 : 0) + "</td>";
      }
      body += "</tr>";
    }
    tbl.innerHTML = head + body;
    mv.appendChild(n ? tbl : D.el("p", { class: "small muted", text: "no vertices" }));

    /* list */
    const lv = q("adjlist");
    lv.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const row = D.el("div", {
        class: "mono small",
        style: "padding:.16rem .4rem;border-radius:6px;" + (f.lhl === i ? "background:#6ea8fe22;color:#fff" : "color:var(--muted)"),
        text: name(i) + " → " + (G.adj[i].length ? G.adj[i].map(name).join(", ") : "∅"),
      });
      lv.appendChild(row);
    }
    if (!n) lv.appendChild(D.el("p", { class: "small muted", text: "no vertices" }));

    q("g-v").textContent = n;
    q("g-e").textContent = edgeCount();
    q("g-kind").textContent = G.directed ? "directed" : "undirected";
    q("g-deg").textContent = n ? (G.adj.reduce((s, l) => s + l.length, 0) / n).toFixed(2) : "–";
    q("g-dense").textContent = n > 1 ? ((edgeCount() / ((n * (n - 1)) / (G.directed ? 1 : 2))) * 100).toFixed(0) + "%" : "–";
  }

  function mk(id, color) {
    return D.svg("marker", { id: id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, [
      D.svg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }),
    ]);
  }

  /* ---------------- mouse interaction ---------------- */
  function localPt(svg, ev) {
    const r = svg.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * VW, y: ((ev.clientY - r.top) / r.height) * VH };
  }
  function hit(pt) {
    for (let i = nCount() - 1; i >= 0; i--) {
      const p = G.pos[i];
      if ((p.x - pt.x) * (p.x - pt.x) + (p.y - pt.y) * (p.y - pt.y) <= (R + 4) * (R + 4)) return i;
    }
    return -1;
  }
  /* Listeners live on the host <div>, not the <svg>: the svg is rebuilt on every
     frame, which would drop pointer capture in the middle of a drag.
     Any vertex can be dragged in any tool mode; a press that doesn't move counts
     as a click (add / connect / delete). Dragging redraws the CURRENT frame, so
     you can rearrange the picture in the middle of a BFS/DFS without losing it. */
  let down = null;
  function wireHost(host) {
    host.style.touchAction = "none";
    host.addEventListener("pointerdown", (ev) => {
      const svg = host.querySelector("svg");
      if (!svg || ev.button > 0) return;
      const pt = localPt(svg, ev);
      down = { i: hit(pt), x: ev.clientX, y: ev.clientY, moved: false, pt: pt };
      try { host.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
    });
    host.addEventListener("pointermove", (ev) => {
      const svg = host.querySelector("svg");
      if (!svg) return;
      if (!down) { const i = hit(localPt(svg, ev)); svg.style.cursor = i >= 0 ? "grab" : tool === "add" ? "crosshair" : "default"; return; }
      if (down.i < 0) return;
      if (!down.moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 4) return;
      down.moved = true;
      const pt = localPt(svg, ev);
      G.pos[down.i] = { x: D.clamp(pt.x, R + 4, VW - R - 4), y: D.clamp(pt.y, R + 4, VH - R - 4) };
      dragging = down.i;
      render(player.frames[player.index] || baseFrame());
      const s2 = host.querySelector("svg");
      if (s2) s2.style.cursor = "grabbing";
    });
    const up = (ev) => {
      if (!down) return;
      const d = down;
      down = null;
      dragging = -1;
      try { host.releasePointerCapture(ev.pointerId); } catch (e) {}
      if (d.moved) return;
      click(d.i, d.pt);
    };
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", () => { down = null; dragging = -1; });
  }
  function click(i, pt) {
    if (tool === "del") { if (i >= 0) delNode(i); return; }
    if (i < 0) { pendingEdge = -1; addNode(pt.x, pt.y); return; }
    if (pendingEdge < 0) { pendingEdge = i; refresh("Selected <b>" + name(i) + "</b>. Now click another vertex to add or remove that edge, or click empty space to cancel."); return; }
    if (pendingEdge === i) { pendingEdge = -1; refresh("Deselected."); return; }
    const a = pendingEdge;
    pendingEdge = -1;
    toggleEdge(a, i);
  }

  /* ---------------- driver ---------------- */
  function baseFrame(note) {
    return { ns: {}, es: {}, tags: {}, queue: null, stack: null, note: note || "Build the graph, pick a start vertex, then run BFS or DFS.", mhl: null, lhl: null, order: [] };
  }
  function renderStatic(note, quiet) {
    if (quiet) { render(baseFrame(note)); return; }
    player.load([baseFrame(note)], false);
  }
  function refresh(note) {
    syncStart();
    renderStatic(note);
  }
  function syncStart() {
    const sel = q("start");
    const prev = sel.value;
    sel.innerHTML = "";
    for (let i = 0; i < nCount(); i++) sel.appendChild(D.el("option", { value: i, text: name(i) }));
    if (prev && +prev < nCount()) sel.value = prev;
  }

  /* ---------- the two traversals, side by side in four languages ---------- */
  const CODE = {
    bfs: {
      title: "BFS(s) — breadth-first search",
      pseudo: [
        "BFS(s):",
        "  mark s discovered;  dist[s] ← 0 @@init",
        "  Q ← [s] @@init",
        "  while Q is not empty: @@loop",
        "    u ← Q.dequeue() @@deq",
        "    for each v in adj[u]: @@nbr",
        "      if v is undiscovered: @@check",
        "        dist[v] ← dist[u] + 1;  parent[v] ← u @@set",
        "        mark v discovered           // now, not when dequeued @@set",
        "        Q.enqueue(v) @@set",
      ],
      java: [
        "void bfs(int s) {",
        "  seen[s] = true;  dist[s] = 0; @@init",
        "  Queue<Integer> q = new ArrayDeque<>();  q.add(s); @@init",
        "  while (!q.isEmpty()) { @@loop",
        "    int u = q.remove(); @@deq",
        "    for (int v : adj.get(u)) @@nbr",
        "      if (!seen[v]) { @@check",
        "        dist[v] = dist[u] + 1;  parent[v] = u; @@set",
        "        seen[v] = true; @@set",
        "        q.add(v); @@set",
        "      }",
        "  }",
        "}",
      ],
      cpp: [
        "void bfs(int s) {",
        "  seen[s] = true;  dist[s] = 0; @@init",
        "  queue<int> q;  q.push(s); @@init",
        "  while (!q.empty()) { @@loop",
        "    int u = q.front();  q.pop(); @@deq",
        "    for (int v : adj[u]) @@nbr",
        "      if (!seen[v]) { @@check",
        "        dist[v] = dist[u] + 1;  parent[v] = u; @@set",
        "        seen[v] = true; @@set",
        "        q.push(v); @@set",
        "      }",
        "  }",
        "}",
      ],
      python: [
        "def bfs(s):",
        "  seen[s], dist[s] = True, 0 @@init",
        "  q = deque([s]) @@init",
        "  while q: @@loop",
        "    u = q.popleft() @@deq",
        "    for v in adj[u]: @@nbr",
        "      if not seen[v]: @@check",
        "        dist[v], parent[v] = dist[u] + 1, u @@set",
        "        seen[v] = True @@set",
        "        q.append(v) @@set",
      ],
    },
    dfs: {
      title: "DFS(u) — depth-first search",
      pseudo: [
        "DFS(u):",
        "  color[u] ← GREY;  d[u] ← ++time        // discover @@disc",
        "  for each v in adj[u]: @@nbr",
        "    if color[v] == WHITE: @@check",
        "      DFS(v)                               // tree edge @@rec",
        "  color[u] ← BLACK;  f[u] ← ++time       // finish @@fin",
        "",
        "DFSForest():",
        "  for each vertex u: @@forest",
        "    if color[u] == WHITE: DFS(u)           // a new tree @@forest",
      ],
      java: [
        "void dfs(int u) {",
        "  color[u] = GREY;  d[u] = ++time; @@disc",
        "  for (int v : adj.get(u)) @@nbr",
        "    if (color[v] == WHITE) @@check",
        "      dfs(v); @@rec",
        "  color[u] = BLACK;  f[u] = ++time; @@fin",
        "}",
        "",
        "void dfsForest() {",
        "  for (int u = 0; u < n; u++) @@forest",
        "    if (color[u] == WHITE) dfs(u); @@forest",
        "}",
      ],
      cpp: [
        "void dfs(int u) {",
        "  color[u] = GREY;  d[u] = ++time; @@disc",
        "  for (int v : adj[u]) @@nbr",
        "    if (color[v] == WHITE) @@check",
        "      dfs(v); @@rec",
        "  color[u] = BLACK;  f[u] = ++time; @@fin",
        "}",
        "",
        "void dfsForest() {",
        "  for (int u = 0; u < n; u++) @@forest",
        "    if (color[u] == WHITE) dfs(u); @@forest",
        "}",
      ],
      python: [
        "def dfs(u):",
        "  global time",
        "  time += 1;  color[u], d[u] = GREY, time @@disc",
        "  for v in adj[u]: @@nbr",
        "    if color[v] == WHITE: @@check",
        "      dfs(v) @@rec",
        "  time += 1;  color[u], f[u] = BLACK, time @@fin",
        "",
        "def dfs_forest():",
        "  for u in range(n): @@forest",
        "    if color[u] == WHITE: @@forest",
        "      dfs(u) @@forest",
      ],
    },
  };
  D.specs(CODE, {
    bfs: { does: "Breadth-first search from " + "<span class='mono'>s</span>" + ": visits vertices in order of distance, using a FIFO queue.", params: "<span class='mono'>s</span> — the start vertex", returns: "nothing; fills dist[] (edge counts) and parent[] (the BFS tree)", errors: "none — unreachable vertices keep no distance", cost: "Θ(V + E) with adjacency lists, Θ(V²) with a matrix", callVals: { s: "0" } },
    dfs: { does: "Depth-first search: goes as deep as possible from " + "<span class='mono'>u</span>" + " before backtracking, recording discovery and finish times.", params: "<span class='mono'>u</span> — the vertex to explore from", returns: "nothing; colours every reachable vertex and records d[] / f[]", errors: "none", cost: "Θ(V + E); recursion depth up to V", callVals: { u: "0" } },
  });

  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "graphs": {
    "label": "BFS & DFS",
    "items": [
     [
      733,
      "Flood Fill",
      "flood-fill",
      "Easy",
      "BFS or DFS on a grid graph."
     ],
     [
      1971,
      "Find if Path Exists in Graph",
      "find-if-path-exists-in-graph",
      "Easy",
      "Reachability from a start vertex."
     ],
     [
      200,
      "Number of Islands",
      "number-of-islands",
      "Medium",
      "Count components, like the DFS-forest example."
     ],
     [
      547,
      "Number of Provinces",
      "number-of-provinces",
      "Medium",
      "Components from an adjacency matrix."
     ],
     [
      994,
      "Rotting Oranges",
      "rotting-oranges",
      "Medium",
      "Multi-source BFS: distance by levels."
     ],
     [
      207,
      "Course Schedule",
      "course-schedule",
      "Medium",
      "Cycle detection with DFS: a back edge means a cycle."
     ],
     [
      785,
      "Is Graph Bipartite?",
      "is-graph-bipartite",
      "Medium",
      "Two-colour the BFS levels."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    const dock = D.CodeDock("#code", CODE);
    player = new D.Player({ mount: "#player", render: render, delay: 700, code: dock });
    wireHost(q("gr-canvas"));

    D.$$("[data-tool]").forEach((b) =>
      b.addEventListener("click", () => {
        tool = b.dataset.tool;
        pendingEdge = -1;
        D.$$("[data-tool]").forEach((x) => x.classList.toggle("active", x === b));
        q("tool-hint").innerHTML =
          tool === "add" ? "Click empty space to <b>add a vertex</b>. Click one vertex, then another, to <b>toggle an edge</b>. <b>Drag</b> any vertex to move it."
            : "Click a vertex to <b>delete</b> it, along with every edge that touches it. Dragging still moves vertices.";
        renderStatic();
      })
    );
    q("directed").addEventListener("change", (e) => {
      G.directed = e.target.checked;
      if (!G.directed) {
        for (let u = 0; u < nCount(); u++) G.adj[u].forEach((v) => { if (G.adj[v].indexOf(u) < 0) G.adj[v].push(u); });
        G.adj.forEach((l) => l.sort((a, b) => a - b));
      }
      refresh(G.directed ? "Now <b>directed</b> — each edge points one way, so the adjacency matrix no longer has to be symmetric." : "Now <b>undirected</b> — every edge was mirrored, so the matrix is symmetric and each edge appears in two lists.");
    });
    q("preset").addEventListener("change", (e) => {
      if (!PRESETS[e.target.value]) return;
      PRESETS[e.target.value]();
      refresh("Loaded the <b>" + e.target.value + "</b> graph: " + nCount() + " vertices, " + edgeCount() + " edges.");
    });
    q("btn-clear").addEventListener("click", () => { G.pos = []; G.adj = []; refresh("Empty graph — click to start building."); });
    const go = (kind) => {
      if (!nCount()) return D.toast("Add some vertices first.", true);
      const st = +q("start").value || 0;
      const c = kind === "bfs" ? bfs(st) : dfs(st, kind === "forest");
      q("algo-explain").innerHTML = EXPL[kind];
      player.load(c.frames, true);
    };
    q("btn-bfs").addEventListener("click", () => go("bfs"));
    q("btn-dfs").addEventListener("click", () => go("dfs"));
    q("btn-forest").addEventListener("click", () => go("forest"));

    const example = (preset, directed, start, kind) => () => {
      q("directed").checked = directed;
      G.directed = directed;
      q("preset").value = preset;
      PRESETS[preset]();
      syncStart();
      q("start").value = start;
      go(kind);
    };
    D.practiceShow("graphs");
    D.Examples("#examples", [
      { label: "BFS on a grid: shortest paths", desc: "dist labels grow level by level", run: example("grid", false, 0, "bfs") },
      { label: "DFS finds a cycle (back edge)", run: example("cycle", false, 0, "dfs") },
      { label: "BFS vs DFS on a tree", desc: "Run BFS, then DFS, on the same tree", run: example("tree", false, 0, "bfs") },
      { label: "count components with a DFS forest", run: example("disconnected", false, 0, "forest") },
      { label: "directed DFS: tree / back / cross edges", run: example("sample", true, 0, "dfs") },
    ]);

    D.legend("#legend", [
      { color: "var(--c-idle)", label: "undiscovered (white)" },
      { color: "var(--c-cmp)", label: "discovered, in queue/stack (grey)" },
      { color: "var(--c-active)", label: "being processed now" },
      { color: "var(--c-done)", label: "finished (black)" },
      { color: "var(--c-done)", label: "green edge = tree edge" },
    ]);

    PRESETS.sample();
    refresh("A sample graph. Pick a start vertex and press <b>BFS</b> or <b>DFS</b> — or click the canvas to build your own.");
    q("algo-explain").innerHTML = EXPL.intro;
  });

  const EXPL = {
    intro:
      "<b>BFS</b> uses a queue and explores by distance: it finishes every vertex at distance k before touching " +
      "distance k+1, which is why it finds shortest paths in unweighted graphs. <b>DFS</b> uses a stack (usually the " +
      "call stack) and dives as deep as possible before backtracking, which is why it exposes cycles, components and " +
      "topological order. Both visit every vertex and every edge exactly once: <b>Θ(V + E)</b> with adjacency lists.",
    bfs:
      "<b>BFS invariant:</b> the queue always holds vertices from at most two consecutive levels. Each vertex is " +
      "enqueued once (it is marked discovered the moment it enters, not when it leaves), and each edge is examined once " +
      "from each endpoint — so the running time is Θ(V + E). The <span style='color:#4ade80'>green tree edges</span> " +
      "form a shortest-path tree: following parents from any vertex back to the source gives a path of exactly " +
      "<span class='mono'>dist</span> edges, and no shorter one exists.",
    dfs:
      "<b>DFS timestamps:</b> each vertex gets a discovery and a finish time, so it owns the interval [d, f]. The " +
      "<b>parenthesis theorem</b> says two such intervals are either nested or disjoint. A <b>back edge</b> (an edge to " +
      "a vertex still on the stack) exists if and only if the graph has a cycle — that is the standard cycle test. " +
      "Sorting vertices by <em>decreasing finish time</em> gives a topological order of a DAG.",
    forest:
      "<b>DFS forest:</b> restarting the search from every still-white vertex covers the whole graph, and each restart " +
      "begins a new tree. For an undirected graph the number of trees is exactly the number of <b>connected " +
      "components</b> — the standard linear-time way to count them. On a directed graph the same idea, run twice " +
      "(once on the reverse graph, in decreasing finish order), gives strongly connected components: Kosaraju's algorithm.",
  };
})();
