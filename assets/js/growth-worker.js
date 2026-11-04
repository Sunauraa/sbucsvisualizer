/* ============================================================
   growth-worker.js: counts operations at sizes far too big to animate.
   Runs off the main thread so the page never freezes.

   These are the same eight sorts as sorting.js, stripped of frame recording
   (a caption per step would make n = 10,000 take minutes). They count
   comparisons and writes exactly as the visualizer does, and the test suite
   checks that the two agree on every algorithm and input shape.
   ============================================================ */
"use strict";

const SORTS = {
  bubble(a) {
    let cmp = 0, mov = 0;
    for (let i = a.length - 1; i >= 1; i--) {
      let swapped = false;
      for (let j = 0; j < i; j++) {
        cmp++;
        if (a[j] > a[j + 1]) { const t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; mov += 2; swapped = true; }
      }
      if (!swapped) break;
    }
    return { cmp, mov };
  },
  selection(a) {
    let cmp = 0, mov = 0;
    for (let i = 0; i < a.length - 1; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) { cmp++; if (a[j] < a[min]) min = j; }
      if (min !== i) { const t = a[i]; a[i] = a[min]; a[min] = t; mov += 2; }
    }
    return { cmp, mov };
  },
  insertion(a) {
    let cmp = 0, mov = 0;
    for (let i = 1; i < a.length; i++) {
      const key = a[i];
      let j = i - 1;
      while (j >= 0) {
        cmp++;
        if (a[j] > key) { a[j + 1] = a[j]; mov++; j--; } else break;
      }
      a[j + 1] = key;
      mov++;
    }
    return { cmp, mov };
  },
  heap(a) {
    let cmp = 0, mov = 0;
    const down = (i, size) => {
      for (;;) {
        const l = 2 * i + 1;
        if (l >= size) return;
        let c = l;
        if (c + 1 < size) { cmp++; if (a[c + 1] > a[c]) c = c + 1; }
        cmp++;
        if (a[i] >= a[c]) return;
        const t = a[i]; a[i] = a[c]; a[c] = t;
        mov += 2;
        i = c;
      }
    };
    const n = a.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) down(i, n);
    for (let end = n - 1; end >= 1; end--) {
      const t = a[0]; a[0] = a[end]; a[end] = t;
      mov += 2;
      down(0, end);
    }
    return { cmp, mov };
  },
  merge(a) {
    let cmp = 0, mov = 0;
    const ms = (lo, hi) => {
      if (lo >= hi) return;
      const mid = Math.floor((lo + hi) / 2);
      ms(lo, mid);
      ms(mid + 1, hi);
      const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);
      let i = 0, j = 0, k = lo;
      while (i < L.length && j < R.length) { cmp++; a[k++] = L[i] <= R[j] ? L[i++] : R[j++]; mov++; }
      while (i < L.length) { a[k++] = L[i++]; mov++; }
      while (j < R.length) { a[k++] = R[j++]; mov++; }
    };
    ms(0, a.length - 1);
    return { cmp, mov };
  },
  quick(a) {
    let cmp = 0, mov = 0;
    /* an explicit stack: sorted input makes this recursion n levels deep, which would overflow the call stack */
    const todo = [[0, a.length - 1]];
    while (todo.length) {
      const [lo, hi] = todo.pop();
      if (lo >= hi) continue;
      const pivot = a[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) {
        cmp++;
        if (a[j] < pivot) {
          if (i !== j) { const t = a[i]; a[i] = a[j]; a[j] = t; mov += 2; }
          i++;
        }
      }
      const t = a[i]; a[i] = a[hi]; a[hi] = t;
      mov += 2;
      todo.push([i + 1, hi], [lo, i - 1]);
    }
    return { cmp, mov };
  },
  twothird(a) {
    let cmp = 0, mov = 0;
    const rec = (i, j) => {
      cmp++;
      if (a[i] > a[j]) { const t = a[i]; a[i] = a[j]; a[j] = t; mov += 2; }
      if (j - i + 1 > 2) {
        const t = Math.floor((j - i + 1) / 3);
        rec(i, j - t);
        rec(i + t, j);
        rec(i, j - t);
      }
    };
    rec(0, a.length - 1);
    return { cmp, mov };
  },
  counting(a) {
    let mov = 0;
    const lo = a.reduce((m, x) => Math.min(m, x), Infinity), hi = a.reduce((m, x) => Math.max(m, x), -Infinity);
    const k = hi - lo;
    const C = new Int32Array(k + 1);
    const B = new Array(a.length);
    for (let i = 0; i < a.length; i++) { C[a[i] - lo]++; mov++; }
    for (let v = 1; v <= k; v++) C[v] += C[v - 1];
    for (let i = a.length - 1; i >= 0; i--) { const c = a[i] - lo; C[c]--; B[C[c]] = a[i]; mov++; }
    for (let i = 0; i < a.length; i++) a[i] = B[i];
    return { cmp: 0, mov };
  },
};

function makeInput(n, shape, rand) {
  const a = new Array(n);
  if (shape === "sorted") for (let i = 0; i < n; i++) a[i] = i;
  else if (shape === "reverse") for (let i = 0; i < n; i++) a[i] = n - i;
  else if (shape === "nearly") {
    for (let i = 0; i < n; i++) a[i] = i;
    const swaps = Math.max(1, Math.round(n / 20));
    for (let s = 0; s < swaps; s++) { const i = Math.floor(rand() * (n - 1)); const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; }
  } else if (shape === "few") for (let i = 0; i < n; i++) a[i] = Math.floor(rand() * 5);
  else for (let i = 0; i < n; i++) a[i] = Math.floor(rand() * n);
  return a;
}

const SIZES = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const TRIALS = { random: 3, nearly: 3, few: 3, sorted: 1, reverse: 1 };
const BUDGET_MS = 700;            /* a series stops once its next size would take longer than about this */

/* tiny seeded generator, so one shape gives every algorithm the same inputs */
const prng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function measure(algos, shape) {
  const stopped = {};
  for (let s = 0; s < SIZES.length; s++) {
    const n = SIZES[s];
    for (const id of algos) {
      if (stopped[id]) continue;
      const trials = TRIALS[shape] || 1;
      let cmp = 0, mov = 0;
      const t0 = Date.now();
      for (let tr = 0; tr < trials; tr++) {
        const r = SORTS[id](makeInput(n, shape, prng(n * 31 + tr)));
        cmp += r.cmp; mov += r.mov;
      }
      const ms = Date.now() - t0;
      self.postMessage({ type: "point", id: id, n: n, cmp: Math.round(cmp / trials), mov: Math.round(mov / trials), ms: ms });
      /* the step to the next size is at most 2.5×; a quadratic sort then takes about 6× as long, two-third sort about 12× */
      const growth = id === "twothird" ? 12 : 6;
      if (s + 1 < SIZES.length && ms * growth > BUDGET_MS) {
        stopped[id] = n;
        self.postMessage({ type: "stopped", id: id, n: n, next: SIZES[s + 1] });
      }
    }
  }
  self.postMessage({ type: "done" });
}

if (typeof self !== "undefined" && typeof self.importScripts === "function") {
  self.onmessage = (e) => measure(e.data.algos, e.data.shape);
}
