/* ============================================================
   motion.js: values travel between frames instead of jumping.

   Renderers repaint a whole frame, so there is nothing to tween.
   Around each repaint this file notes where every value was, finds
   the same value in the new picture, and slides it from the old
   place to the new one (the FLIP technique: First, Last, Invert,
   Play). Modules need no changes, and stepping backwards works
   because it only compares two pictures.

     identity   a value is its text, so two equal values are matched
                to whichever pair moved the least. They look the same,
                so nobody can tell which is which.
     copies     a value that exists once more than before flies in from
                the nearest original (a write, an array copy).
     edges      a line touching a moving tree node follows that node.
     opt out    data-motion="off" on anything whose text is not a value
                that travels (row labels, counters).

   Scrubbing and jumps repaint without motion. With prefers-reduced-motion
   nothing moves through space: values fade in where they land instead.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const LS = "dsa.motion";
  const MAX_UNITS = 400;                    /* past this, repainting is clearer than a swarm */
  const SKIP = ".code-dock, .player, .about, #practice, .toolbar, .growth, [data-motion='off']";
  const ease = (t) => 1 - Math.pow(1 - t, 4);

  let on = true;
  try { on = localStorage.getItem(LS) !== "0"; } catch (e) {}
  const reducedQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  /* ---------- what counts as a value on screen ---------- */
  const ownText = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim();
  const svgTextOf = (els) => {
    const out = [];
    els.forEach((el) => {
      const ts = el.tagName.toLowerCase() === "text" ? [el] : Array.from(el.querySelectorAll ? el.querySelectorAll("text") : []);
      ts.forEach((t) => { if (!t.classList.contains("lbl-s")) out.push(t.textContent); });
    });
    return out.join(" ").trim();
  };
  /* An svg node is a shape plus its labels: either a <g>, or loose siblings up to the next node or edge. */
  function svgNodeEls(shape) {
    const parent = shape.parentNode;
    if (parent && parent.tagName && parent.tagName.toLowerCase() === "g") return [parent];
    const els = [shape];
    for (let n = shape.nextElementSibling; n; n = n.nextElementSibling) {
      const tag = n.tagName.toLowerCase();
      if (n.classList.contains("node-c")) break;
      if (tag === "path" || (tag === "line" && !n.classList.contains("dim"))) break;
      if (tag === "text" || tag === "line" || tag === "rect") els.push(n);
      else break;
    }
    return els;
  }
  function collect(scope) {
    const units = [];
    D.$$(".cell.filled, .bar, .frame-card, svg .node-c", scope).forEach((el) => {
      if (el.closest(SKIP)) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const stage = el.closest("[id$='-stage']");
      const group = stage ? stage.id : "main";
      let key, els = [el], svg = null;
      if (el.classList.contains("cell")) key = ownText(el);
      else if (el.classList.contains("bar")) key = el.dataset.v;
      else if (el.classList.contains("frame-card")) { const h = el.querySelector(".fc-head .mono"); key = h ? h.textContent : ""; }
      else { els = svgNodeEls(el); key = svgTextOf(els); svg = el.ownerSVGElement; }
      if (!key) return;
      units.push({ key: key, group: group, el: el, els: els, svg: svg, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
    return units;
  }
  const edgesOf = (scope) => D.$$("svg line.edge, svg path.edge", scope).filter((l) => !l.closest(SKIP));
  const edgeSig = (l) => (l.tagName.toLowerCase() === "path" ? l.getAttribute("d") : ["x1", "y1", "x2", "y2"].map((a) => l.getAttribute(a)).join(","));

  /* ---------- pair each new value with where it was ---------- */
  function match(prev, next) {
    const oldBy = new Map();
    prev.forEach((u) => { const k = u.group + "\0" + u.key; if (!oldBy.has(k)) oldBy.set(k, []); oldBy.get(k).push(u); });
    const newBy = new Map();
    next.forEach((u) => { const k = u.group + "\0" + u.key; if (!newBy.has(k)) newBy.set(k, []); newBy.get(k).push(u); });
    const entering = [];
    newBy.forEach((list, k) => {
      const olds = oldBy.get(k);
      if (!olds) { list.forEach((u) => entering.push(u)); return; }
      const pairs = [];
      list.forEach((u, a) => olds.forEach((o, b) => pairs.push({ a: a, b: b, d: Math.hypot(u.x - o.x, u.y - o.y) })));
      pairs.sort((p, q) => p.d - q.d);
      const usedA = new Set(), usedB = new Set();
      pairs.forEach((p) => {
        if (usedA.has(p.a) || usedB.has(p.b)) return;
        usedA.add(p.a); usedB.add(p.b);
        list[p.a].from = olds[p.b];
      });
      /* more copies than before: each extra one came from the nearest original */
      list.forEach((u, a) => {
        if (usedA.has(a)) return;
        let best = null, bd = Infinity;
        olds.forEach((o) => { const d = Math.hypot(u.x - o.x, u.y - o.y); if (d < bd) { bd = d; best = o; } });
        u.from = best;
      });
    });
    return entering;
  }

  /* ---------- one running animation per player ---------- */
  const running = new WeakMap();
  function stop(player) {
    const r = running.get(player);
    if (r) { running.delete(player); r(); }
  }

  function animate(player, scope, prev, prevEdges) {
    const dur = Math.min(300, (player.baseDelay / player.speed) * 0.72);
    const next = collect(scope);
    if (dur < 70 || next.length > MAX_UNITS || prev.length > MAX_UNITS) return;
    const entering = match(prev, next);
    const reduced = reducedQ.matches;
    const movers = [], faders = [], lines = [], resets = [];

    next.forEach((u) => {
      if (!u.from) return;
      const dx = u.from.x - u.x, dy = u.from.y - u.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      if (reduced) { faders.push({ els: u.els, from: 0.35 }); return; }
      if (u.svg) {
        const ctm = u.svg.getScreenCTM();
        const scale = ctm && ctm.a ? ctm.a : 1;
        const ux = dx / scale, uy = dy / scale;
        u.els.forEach((el) => {
          /* a moving node sits above the others until it lands */
          movers.push((k) => el.setAttribute("transform", "translate(" + ux * k + " " + uy * k + ")"));
          resets.push(() => el.removeAttribute("transform"));
        });
        u.offset = { x: ux, y: uy };
      } else {
        const el = u.el;
        const kids = D.$$(".idx, .ptr", el);       /* an index label belongs to the slot, not to the value */
        el.classList.add("in-flight");
        movers.push((k) => {
          el.style.transform = "translate(" + dx * k + "px," + dy * k + "px)";
          kids.forEach((c) => { c.style.transform = "translateX(-50%) translate(" + -dx * k + "px," + -dy * k + "px)"; });
        });
        resets.push(() => {
          el.classList.remove("in-flight");
          el.style.transform = "";
          kids.forEach((c) => { c.style.transform = ""; });
        });
      }
    });
    entering.forEach((u) => faders.push({ els: u.els, from: 0 }));

    /* edges: an end touching a moving node follows it; a brand-new edge with nothing to follow fades in */
    const nodes = next.filter((u) => u.svg);
    const boxOf = (u) => {
      if (!u.box) { const b = u.el.getBBox(); u.box = { x0: b.x - 4, y0: b.y - 4, x1: b.x + b.width + 4, y1: b.y + b.height + 4 }; }
      return u.box;
    };
    const touching = (x, y, svg) => nodes.find((u) => {
      if (u.svg !== svg) return false;
      const b = boxOf(u);
      return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    });
    edgesOf(scope).forEach((l) => {
      const known = prevEdges.has(edgeSig(l));
      if (l.tagName.toLowerCase() === "line") {
        const x1 = +l.getAttribute("x1"), y1 = +l.getAttribute("y1"), x2 = +l.getAttribute("x2"), y2 = +l.getAttribute("y2");
        const a = touching(x1, y1, l.ownerSVGElement), b = touching(x2, y2, l.ownerSVGElement);
        const oa = a && a.offset, ob = b && b.offset;
        if (oa || ob) {
          lines.push((k) => {
            if (oa) { l.setAttribute("x1", x1 + oa.x * k); l.setAttribute("y1", y1 + oa.y * k); }
            if (ob) { l.setAttribute("x2", x2 + ob.x * k); l.setAttribute("y2", y2 + ob.y * k); }
          });
          resets.push(() => { l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); });
          return;
        }
      }
      if (!known) faders.push({ els: [l], from: 0 });
    });

    if (!movers.length && !faders.length && !lines.length) return;
    faders.forEach((f) => f.els.forEach((el) => {
      el.style.opacity = f.from;
      resets.push(() => { el.style.opacity = ""; });
    }));

    let raf = 0, timer = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      resets.forEach((fn) => fn());
    };
    running.set(player, finish);
    const start = performance.now();
    const paint = (k) => {
      movers.forEach((fn) => fn(k));
      lines.forEach((fn) => fn(k));
      faders.forEach((f) => f.els.forEach((el) => { el.style.opacity = f.from + (1 - f.from) * (1 - k); }));
    };
    paint(1);
    const tick = (now) => {
      if (done) return;
      const t = Math.min(1, (now - start) / dur);
      paint(1 - ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else { running.delete(player); finish(); }
    };
    raf = requestAnimationFrame(tick);
    /* a tab in the background gets no animation frames: still land */
    timer = setTimeout(() => { if (!done) { running.delete(player); finish(); } }, dur + 80);
  }

  D.motion = {
    get enabled() { return on; },
    set enabled(v) { on = !!v; try { localStorage.setItem(LS, on ? "1" : "0"); } catch (e) {} },
    /** Called just before a repaint. `step` says whether this repaint is one step of the same run. */
    begin(player, step) {
      stop(player);
      if (!on || !step) return null;
      const scope = player.scope;
      if (!scope || !scope.isConnected) return null;
      const prev = collect(scope);
      const prevEdges = new Set(edgesOf(scope).map(edgeSig));
      scope.classList.add("motion-frame");    /* a bar's own height transition would fight the slide */
      return {
        play() {
          try { animate(player, scope, prev, prevEdges); } catch (err) { console.error(err); }
          /* this read makes the browser apply the new heights while the transition is switched off */
          void scope.offsetHeight;
          scope.classList.remove("motion-frame");
        },
      };
    },
  };

  /* the on/off switch next to Speed */
  D.playerAddons.push(function (player) {
    const box = D.el("input", { type: "checkbox", "aria-label": "Animate each step" });
    box.checked = on;
    box.addEventListener("change", () => { D.motion.enabled = box.checked; });
    player.tools.appendChild(D.el("label", { class: "tool-check", title: "Slide values to their new places on each step" }, [box, "Animate"]));
  });
})();
