/* ============================================================
   growth.js: "how does it scale?" on the Sorting page.
   Runs the sorts at n = 10 … 10,000 in a Web Worker and plots total
   operations against n, so O(n²) visibly pulls away from O(n log n).
   Drawn with the same small SVG helpers as the rest of the site, so it
   adds no library and no build step.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  /* colour belongs to the algorithm: it never changes when others are hidden */
  const SERIES = [
    { id: "bubble", label: "Bubble", color: "#2a78d6", on: true },
    { id: "merge", label: "Merge", color: "#eb6834", on: true },
    { id: "insertion", label: "Insertion", color: "#1baf7a", on: false },
    { id: "quick", label: "Quick", color: "#eda100", on: true },
    { id: "selection", label: "Selection", color: "#e87ba4", on: false },
    { id: "counting", label: "Counting", color: "#008300", on: true },
    { id: "heap", label: "Heap", color: "#6250d6", on: false },
    { id: "twothird", label: "Two-third", color: "#e34948", on: false },
  ];
  const W = 760, H = 380, M = { l: 66, r: 92, t: 14, b: 44 };
  const fmt = (v) => Math.round(v).toLocaleString("en-US");
  const compact = (v) => (v >= 1e9 ? v / 1e9 + "B" : v >= 1e6 ? v / 1e6 + "M" : v >= 1e4 ? v / 1e3 + "K" : v.toLocaleString("en-US"));

  function init() {
    const root = D.$("#growth");
    if (!root) return;
    let data = {}, stopped = {}, scale = "log", worker = null, running = false;
    const state = {};
    SERIES.forEach((s) => (state[s.id] = s.on));
    const steps = (p) => p.cmp + p.mov;

    /* ---------- controls ---------- */
    const bar = D.el("div", { class: "toolbar growth-bar" });
    const shapeSel = D.el("select", { id: "growth-shape" });
    [["random", "random"], ["sorted", "already sorted"], ["reverse", "reversed"], ["nearly", "nearly sorted"], ["few", "few unique"]].forEach(([v, t]) => shapeSel.appendChild(D.el("option", { value: v, text: t })));
    bar.appendChild(D.el("div", { class: "field" }, [D.el("label", { for: "growth-shape", text: "Input shape" }), shapeSel]));
    const segMount = D.el("div");
    bar.appendChild(D.el("div", { class: "field" }, [D.el("span", { class: "field-label", text: "Scale" }), segMount]));
    const status = D.el("span", { class: "growth-status", role: "status", "aria-live": "polite" });
    bar.appendChild(status);
    root.appendChild(bar);
    D.Segmented(segMount, [
      { id: "log", label: "Log", desc: "Each gridline is 10× the last. Slopes show the growth rate." },
      { id: "linear", label: "Linear", desc: "Plain numbers. The fast sorts hug the floor." },
    ], (id) => { scale = id; draw(); }, "log");

    const legend = D.el("div", { class: "growth-legend", role: "group", "aria-label": "Algorithms to show" });
    SERIES.forEach((s) => {
      const box = D.el("input", { type: "checkbox" });
      box.checked = state[s.id];
      box.addEventListener("change", () => { state[s.id] = box.checked; draw(); });
      legend.appendChild(D.el("label", {}, [box, D.el("i", { style: "background:" + s.color }), s.label]));
    });
    root.appendChild(legend);

    const plot = D.el("div", { class: "growth-plot" });
    const tip = D.el("div", { class: "growth-tip", hidden: "" });
    plot.appendChild(tip);
    root.appendChild(plot);
    const insight = D.el("p", { class: "growth-insight" });
    root.appendChild(insight);
    const details = D.el("details", { class: "growth-table" }, [D.el("summary", { text: "Show the numbers as a table" })]);
    const tableWrap = D.el("div", { style: "overflow-x:auto" });
    details.appendChild(tableWrap);
    root.appendChild(details);

    /* ---------- scales ---------- */
    const visible = () => SERIES.filter((s) => state[s.id] && (data[s.id] || []).length);
    function scales() {
      const pts = visible().flatMap((s) => data[s.id]);
      const xMax = Math.max(100, ...pts.map((p) => p.n));
      const yMax = Math.max(100, ...pts.map(steps));
      const iw = W - M.l - M.r, ih = H - M.t - M.b;
      if (scale === "log") {
        const lx0 = 1, lx1 = Math.log10(xMax), ly0 = 0, ly1 = Math.ceil(Math.log10(yMax));
        return {
          x: (n) => M.l + ((Math.log10(n) - lx0) / (lx1 - lx0)) * iw,
          y: (v) => M.t + ih - ((Math.log10(Math.max(1, v)) - ly0) / (ly1 - ly0)) * ih,
          xTicks: range(1, Math.ceil(lx1)).map((e) => Math.pow(10, e)).filter((t) => t <= xMax),
          yTicks: range(ly0, ly1).filter((e) => (ly1 > 6 ? e % 2 === ly1 % 2 : true)).map((e) => Math.pow(10, e)),
        };
      }
      const yTop = niceCeil(yMax);
      return {
        x: (n) => M.l + (n / xMax) * iw,
        y: (v) => M.t + ih - (v / yTop) * ih,
        xTicks: linearTicks(xMax),
        yTicks: [0, 1, 2, 3, 4].map((k) => (yTop * k) / 4),
      };
    }
    const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
    function niceCeil(v) {
      const p = Math.pow(10, Math.floor(Math.log10(v)));
      for (const m of [1, 2, 4, 5, 8, 10]) if (v <= m * p) return m * p;
      return 10 * p;
    }
    function linearTicks(max) {
      const step = niceCeil(max) / 5;
      const o = [];
      for (let t = step; t <= max; t += step) o.push(t);
      return o;
    }

    /* ---------- drawing ---------- */
    let sc = null, svg = null, hair = null;
    function draw() {
      if (svg) svg.remove();
      svg = D.svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Operations against input size for the selected sorting algorithms. The same numbers are in the table below." });
      plot.insertBefore(svg, tip);
      const series = visible();
      sc = scales();
      const x0 = M.l, x1 = W - M.r, yB = H - M.b;
      sc.yTicks.forEach((t) => {
        const y = sc.y(t);
        svg.appendChild(D.svg("line", { x1: x0, x2: x1, y1: y, y2: y, class: "gw-grid" }));
        svg.appendChild(D.sText(x0 - 8, y, compact(t), { class: "gw-tick", "text-anchor": "end" }));
      });
      sc.xTicks.forEach((t) => {
        svg.appendChild(D.svg("line", { x1: sc.x(t), x2: sc.x(t), y1: yB, y2: yB + 4, class: "gw-axis" }));
        svg.appendChild(D.sText(sc.x(t), yB + 15, compact(t), { class: "gw-tick" }));
      });
      svg.appendChild(D.svg("line", { x1: x0, x2: x1, y1: yB, y2: yB, class: "gw-axis" }));
      svg.appendChild(D.sText((x0 + x1) / 2, H - 6, "input size n", { class: "gw-title" }));
      svg.appendChild(D.sText(14, (M.t + yB) / 2, "operations (comparisons + writes)", { class: "gw-title", transform: "rotate(-90 14 " + (M.t + yB) / 2 + ")" }));

      series.forEach((s) => {
        const pts = data[s.id].filter((p) => steps(p) > 0);
        if (!pts.length) return;
        const d = pts.map((p, i) => (i ? "L" : "M") + sc.x(p.n).toFixed(1) + " " + sc.y(steps(p)).toFixed(1)).join(" ");
        svg.appendChild(D.svg("path", { d: d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
        const last = pts[pts.length - 1];
        svg.appendChild(D.svg("circle", { cx: sc.x(last.n), cy: sc.y(steps(last)), r: 4, fill: s.color, stroke: "#fff", "stroke-width": 2 }));
      });
      labelEnds(series);
      hair = D.svg("line", { y1: M.t, y2: yB, class: "gw-hair", visibility: "hidden" });
      svg.appendChild(hair);
      table();
      explain();
    }
    /* up to four series are named at the end of their line, nudged apart where they would collide */
    function labelEnds(series) {
      if (series.length > 4) return;
      const items = series.map((s) => {
        const pts = data[s.id].filter((p) => steps(p) > 0);
        const last = pts[pts.length - 1];
        return last ? { s: s, x: sc.x(last.n) + 9, y: sc.y(steps(last)) } : null;
      }).filter(Boolean).sort((a, b) => a.y - b.y);
      for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 14) items[i].y = items[i - 1].y + 14;
      items.forEach((it) => svg.appendChild(D.sText(it.x, it.y, it.s.label, { class: "gw-label", "text-anchor": "start" })));
    }

    /* hover or touch: one readout for every series at the nearest size */
    function nearestN(clientX) {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      const ns = Array.from(new Set(visible().flatMap((s) => data[s.id].map((p) => p.n)))).sort((a, b) => a - b);
      let best = null, bd = Infinity;
      ns.forEach((n) => { const d = Math.abs(sc.x(n) - px); if (d < bd) { bd = d; best = n; } });
      return best;
    }
    plot.addEventListener("pointermove", (e) => {
      if (!svg || !visible().length) return;
      const n = nearestN(e.clientX);
      if (n == null) return;
      hair.setAttribute("x1", sc.x(n)); hair.setAttribute("x2", sc.x(n)); hair.setAttribute("visibility", "visible");
      tip.innerHTML = "";
      tip.appendChild(D.el("div", { class: "tip-head", text: "n = " + fmt(n) }));
      visible().map((s) => ({ s: s, p: data[s.id].find((q) => q.n === n) })).filter((r) => r.p)
        .sort((a, b) => steps(b.p) - steps(a.p))
        .forEach((r) => tip.appendChild(D.el("div", { class: "tip-row" }, [
          D.el("b", { text: fmt(steps(r.p)) }), D.el("i", { style: "background:" + r.s.color }), D.el("span", { text: r.s.label }),
        ])));
      tip.hidden = false;
      const pr = plot.getBoundingClientRect(), sr = svg.getBoundingClientRect();
      const px = sr.left - pr.left + (sc.x(n) / W) * sr.width;
      const left = px + tip.offsetWidth + 16 > pr.width ? px - tip.offsetWidth - 10 : px + 10;
      tip.style.left = Math.max(0, left) + "px";
    });
    plot.addEventListener("pointerleave", () => { tip.hidden = true; if (hair) hair.setAttribute("visibility", "hidden"); });

    function table() {
      const series = SERIES.filter((s) => (data[s.id] || []).length);
      tableWrap.innerHTML = "";
      if (!series.length) return;
      const ns = Array.from(new Set(series.flatMap((s) => data[s.id].map((p) => p.n)))).sort((a, b) => a - b);
      const t = D.el("table", { class: "tbl" });
      const head = D.el("tr", {}, [D.el("th", { text: "n" })]);
      series.forEach((s) => head.appendChild(D.el("th", { text: s.label })));
      t.appendChild(head);
      ns.forEach((n) => {
        const row = D.el("tr", {}, [D.el("th", { text: fmt(n) })]);
        series.forEach((s) => { const p = data[s.id].find((q) => q.n === n); row.appendChild(D.el("td", { class: "num", text: p ? fmt(steps(p)) : "–" })); });
        t.appendChild(row);
      });
      tableWrap.appendChild(t);
    }

    /* the one sentence the chart exists to say: ten times the input costs how many times the work? */
    function factor(s) {
      const pts = data[s.id] || [];
      for (let i = pts.length - 1; i >= 0; i--) {
        const hi = pts[i], lo = pts.find((p) => p.n * 10 === hi.n);
        if (lo && steps(lo) > 0) return { n0: lo.n, n1: hi.n, f: steps(hi) / steps(lo) };
      }
      return null;
    }
    function explain() {
      const parts = visible().map((s) => ({ s: s, r: factor(s) })).filter((x) => x.r).sort((a, b) => b.r.f - a.r.f);
      insight.innerHTML = "";
      if (!parts.length) { insight.textContent = running ? "Measuring…" : ""; return; }
      insight.appendChild(document.createTextNode("Ten times the input costs: "));
      parts.forEach((x, i) => {
        if (i) insight.appendChild(document.createTextNode(", "));
        insight.appendChild(D.el("b", { text: x.s.label + " ×" + (x.r.f < 100 ? x.r.f.toFixed(1) : Math.round(x.r.f)) }));
      });
      insight.appendChild(document.createTextNode(". O(n) would be about ×10, O(n log n) about ×13, and O(n²) about ×100."));
    }

    /* ---------- running ---------- */
    function run() {
      if (worker) worker.terminate();
      data = {}; stopped = {};
      SERIES.forEach((s) => (data[s.id] = []));
      running = true;
      status.textContent = "Measuring…";
      draw();
      try {
        worker = new Worker(D.asset("assets/js/growth-worker.js"));
      } catch (e) {
        status.textContent = "This browser blocked the measuring script. Open the site over http instead of from a file.";
        return;
      }
      worker.onerror = () => { status.textContent = "The measurement stopped because of an error. Try a different input shape."; running = false; };
      let pending = 0;
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "point") data[m.id].push(m);
        else if (m.type === "stopped") stopped[m.id] = m;
        else if (m.type === "done") {
          running = false;
          const cut = SERIES.filter((s) => stopped[s.id]).map((s) => s.label + " at " + fmt(stopped[s.id].n));
          status.textContent = cut.length ? "Stopped early, because the next size would take too long: " + cut.join(", ") + "." : "Measured every size.";
          worker.terminate(); worker = null;
          draw();
          return;
        }
        if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(); });
      };
      worker.postMessage({ algos: SERIES.map((s) => s.id), shape: shapeSel.value });
    }
    shapeSel.addEventListener("change", run);

    /* wait until the chart is on screen: no one should pay for a chart they never scroll to. Watch the toolbar,
       not the box: a hidden box (DSA.collapsible) still shows its heading, but its toolbar is not displayed,
       so measuring waits until the student opens it. */
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); run(); } }, { rootMargin: "200px" });
      io.observe(bar);
    } else run();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
