/* ============================================================
   sorting.js: eight sorting algorithms, frame by frame
   Each algorithm gets (a, R, done, api) and records frames:
     { arr, marks, line, note, cmp, mov, rows? }
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;

  /* ---------- listings ----------------------------------------
     Lines ending "@@name" are anchors. A frame names the anchor(s)
     of the line(s) it is executing, and every language lights its
     own equivalent lines.
     ------------------------------------------------------------ */
  const CODE = {
    bubble: {
      pseudo: [
        "bubbleSort(A):",
        "  for i ← n-1 down to 1 @@outer",
        "    swapped ← false @@reset",
        "    for j ← 0 to i-1 @@inner",
        "      if A[j] > A[j+1]              // compare neighbours @@cmp",
        "        swap A[j], A[j+1] @@swap",
        "        swapped ← true @@swap",
        "    if not swapped: break           // no swaps ⇒ already sorted @@exit",
      ],
      java: [
        "static void bubbleSort(double[] a) {",
        "  for (int i = a.length - 1; i >= 1; i--) { @@outer",
        "    boolean swapped = false; @@reset",
        "    for (int j = 0; j < i; j++) { @@inner",
        "      if (a[j] > a[j + 1]) { @@cmp",
        "        double t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; @@swap",
        "        swapped = true; @@swap",
        "      }",
        "    }",
        "    if (!swapped) break; @@exit",
        "  }",
        "}",
      ],
    },

    selection: {
      pseudo: [
        "selectionSort(A):",
        "  for i ← 0 to n-2 @@outer",
        "    min ← i @@init",
        "    for j ← i+1 to n-1 @@inner",
        "      if A[j] < A[min] @@cmp",
        "        min ← j @@upd",
        "    if min ≠ i: swap A[i], A[min] @@swap",
      ],
      java: [
        "static void selectionSort(double[] a) {",
        "  for (int i = 0; i < a.length - 1; i++) { @@outer",
        "    int min = i; @@init",
        "    for (int j = i + 1; j < a.length; j++) @@inner",
        "      if (a[j] < a[min]) @@cmp",
        "        min = j; @@upd",
        "    if (min != i) { double t = a[i]; a[i] = a[min]; a[min] = t; } @@swap",
        "  }",
        "}",
      ],
    },

    insertion: {
      pseudo: [
        "insertionSort(A):",
        "  for i ← 1 to n-1 @@outer",
        "    key ← A[i];  j ← i-1 @@key",
        "    while j ≥ 0 and A[j] > key @@cmp",
        "      A[j+1] ← A[j]        // shift right @@shift",
        "      j ← j-1 @@shift",
        "    A[j+1] ← key           // drop it in @@drop",
      ],
      java: [
        "static void insertionSort(double[] a) {",
        "  for (int i = 1; i < a.length; i++) { @@outer",
        "    double key = a[i];  int j = i - 1; @@key",
        "    while (j >= 0 && a[j] > key) { @@cmp",
        "      a[j + 1] = a[j];      // shift right @@shift",
        "      j--; @@shift",
        "    }",
        "    a[j + 1] = key;         // drop it in @@drop",
        "  }",
        "}",
      ],
    },

    heap: {
      pseudo: [
        "heapSort(A):",
        "  for i ← ⌊n/2⌋-1 down to 0         // phase 1: build a max-heap @@build",
        "    downHeap(A, i, n) @@bcall",
        "  for end ← n-1 down to 1            // phase 2: extract the max @@extract",
        "    swap A[0], A[end] @@eswap",
        "    downHeap(A, 0, end) @@ecall",
        "",
        "downHeap(A, i, size):",
        "  while 2i+1 < size                  // i still has a child @@dloop",
        "    c ← the larger child of i @@child",
        "    if A[i] ≥ A[c]: break            // heap order holds @@dcmp",
        "    swap A[i], A[c];  i ← c @@dswap",
      ],
      java: [
        "static void heapSort(double[] a) {",
        "  for (int i = a.length / 2 - 1; i >= 0; i--) @@build",
        "    downHeap(a, i, a.length); @@bcall",
        "  for (int end = a.length - 1; end >= 1; end--) { @@extract",
        "    double t = a[0]; a[0] = a[end]; a[end] = t; @@eswap",
        "    downHeap(a, 0, end); @@ecall",
        "  }",
        "}",
        "",
        "static void downHeap(double[] a, int i, int size) {",
        "  while (2 * i + 1 < size) { @@dloop",
        "    int c = 2 * i + 1; @@child",
        "    if (c + 1 < size && a[c + 1] > a[c]) c++; @@child",
        "    if (a[i] >= a[c]) break; @@dcmp",
        "    double t = a[i]; a[i] = a[c]; a[c] = t; @@dswap",
        "    i = c; @@dswap",
        "  }",
        "}",
      ],
    },

    merge: {
      pseudo: [
        "mergeSort(A, lo, hi): @@fn",
        "  if lo ≥ hi: return                 // 0 or 1 element @@base",
        "  mid ← ⌊(lo+hi)/2⌋ @@mid",
        "  mergeSort(A, lo, mid) @@rec1",
        "  mergeSort(A, mid+1, hi) @@rec2",
        "  merge(A, lo, mid, hi) @@mcall",
        "",
        "merge(A, lo, mid, hi):",
        "  L ← A[lo..mid];  R ← A[mid+1..hi] @@copy",
        "  i ← 0;  j ← 0;  k ← lo @@copy",
        "  while i < |L| and j < |R|: @@take",
        "    A[k++] ← (L[i] ≤ R[j]) ? L[i++] : R[j++] @@take",
        "  copy whatever is left of L or R into A @@rest",
      ],
      java: [
        "static void mergeSort(double[] a, int lo, int hi) { @@fn",
        "  if (lo >= hi) return; @@base",
        "  int mid = (lo + hi) / 2; @@mid",
        "  mergeSort(a, lo, mid); @@rec1",
        "  mergeSort(a, mid + 1, hi); @@rec2",
        "  merge(a, lo, mid, hi); @@mcall",
        "}",
        "",
        "static void merge(double[] a, int lo, int mid, int hi) {",
        "  double[] L = Arrays.copyOfRange(a, lo, mid + 1); @@copy",
        "  double[] R = Arrays.copyOfRange(a, mid + 1, hi + 1); @@copy",
        "  int i = 0, j = 0, k = lo; @@copy",
        "  while (i < L.length && j < R.length) @@take",
        "    a[k++] = (L[i] <= R[j]) ? L[i++] : R[j++]; @@take",
        "  while (i < L.length) a[k++] = L[i++]; @@rest",
        "  while (j < R.length) a[k++] = R[j++]; @@rest",
        "}",
      ],
    },

    quick: {
      pseudo: [
        "quickSort(A, low, high): @@fn",
        "  if low ≥ high: return @@base",
        "  s ← partition(A, low, high)      // s is a split position @@part",
        "  quickSort(A, low, s-1) @@rec1",
        "  quickSort(A, s+1, high) @@rec2",
        "",
        "partition(A, low, high):",
        "  pivot ← A[low]                   // first element is the pivot @@pivot",
        "  i ← low;  j ← high+1 @@pivot",
        "  while true: @@ploop",
        "    while A[++i] < pivot: @@pi",
        "      if i = high: break @@pi",
        "    while pivot < A[--j]: @@pj",
        "      if j = low: break @@pj",
        "    if i ≥ j: break @@pcross",
        "    swap A[i], A[j] @@pswap",
        "  swap A[low], A[j]                // pivot lands at j @@pfinal",
        "  return j @@pfinal",
      ],
      java: [
        "static void quickSort(double[] a, int low, int high) { @@fn",
        "  if (low >= high) return; @@base",
        "  int s = partition(a, low, high);   // s is a split position @@part",
        "  quickSort(a, low, s - 1); @@rec1",
        "  quickSort(a, s + 1, high); @@rec2",
        "}",
        "",
        "static int partition(double[] a, int low, int high) {",
        "  double pivot = a[low];             // first element is the pivot @@pivot",
        "  int i = low, j = high + 1; @@pivot",
        "  while (true) { @@ploop",
        "    while (a[++i] < pivot) @@pi",
        "      if (i == high) break; @@pi",
        "    while (pivot < a[--j]) @@pj",
        "      if (j == low) break; @@pj",
        "    if (i >= j) break; @@pcross",
        "    double t = a[i]; a[i] = a[j]; a[j] = t; @@pswap",
        "  }",
        "  double t = a[low]; a[low] = a[j]; a[j] = t;   // pivot lands at j @@pfinal",
        "  return j; @@pfinal",
        "}",
      ],
    },

    twothird: {
      pseudo: [
        "twoThirdSort(A, i, j): @@fn",
        "  if A[i] > A[j]: swap A[i], A[j] @@ends",
        "  if j - i + 1 > 2: @@size",
        "    t ← ⌊(j - i + 1) / 3⌋ @@t",
        "    twoThirdSort(A, i,   j-t)   // first 2/3 @@r1",
        "    twoThirdSort(A, i+t, j  )   // last  2/3 @@r2",
        "    twoThirdSort(A, i,   j-t)   // first 2/3 again @@r3",
      ],
      java: [
        "static void twoThirdSort(double[] a, int i, int j) { @@fn",
        "  if (a[i] > a[j]) { double tmp = a[i]; a[i] = a[j]; a[j] = tmp; } @@ends",
        "  if (j - i + 1 > 2) { @@size",
        "    int t = (j - i + 1) / 3; @@t",
        "    twoThirdSort(a, i,     j - t);   // first 2/3 @@r1",
        "    twoThirdSort(a, i + t, j    );   // last  2/3 @@r2",
        "    twoThirdSort(a, i,     j - t);   // first 2/3 again @@r3",
        "  }",
        "}",
      ],
    },

    counting: {
      pseudo: [
        "countingSort(A):                     // integer keys, any sign",
        "  if some key is not an integer: error @@check",
        "  lo ← min(A);  k ← max(A) − lo        // C needs k + 1 counters @@range",
        "  C ← array of k+1 zeros;  B ← array of n slots @@alloc",
        "  for each x in A:  C[x − lo] ← C[x − lo] + 1   // count @@count",
        "  for v ← 1 to k:   C[v] ← C[v] + C[v-1]       // prefix sums @@prefix",
        "  for idx ← n-1 down to 0            // right to left keeps it stable @@place",
        "    C[A[idx] − lo] ← C[A[idx] − lo] − 1 @@put",
        "    B[C[A[idx] − lo]] ← A[idx] @@put",
        "  copy B back into A @@back",
      ],
      java: [
        "static void countingSort(double[] a) {",
        "  for (double x : a) if (x != Math.rint(x)) throw new IllegalArgumentException(\"not an integer\"); @@check",
        "  int lo = (int) min(a), k = (int) max(a) - lo; @@range",
        "  int[] C = new int[k + 1]; @@alloc",
        "  double[] B = new double[a.length]; @@alloc",
        "  for (double x : a) C[(int) x - lo]++; @@count",
        "  for (int v = 1; v <= k; v++) C[v] += C[v - 1]; @@prefix",
        "  for (int idx = a.length - 1; idx >= 0; idx--) { @@place",
        "    int c = (int) a[idx] - lo;  C[c]--; @@put",
        "    B[C[c]] = a[idx]; @@put",
        "  }",
        "  System.arraycopy(B, 0, a, 0, a.length); @@back",
        "}",
      ],
    },
  };

  /* ---------- algorithms ---------- */
  const ALGO = {};
  /* the tree helpers are optional: a bare recorder (the growth-chart test) gets no-ops */
  const treeOps = (s) => { if (!s.node) { s.node = () => -1; s.pivot = () => {}; s.finish = () => {}; } return s; };

  ALGO.bubble = {
    label: "Bubble Sort",
    code: CODE.bubble,
    big: ["Θ(n²) time (worst)", "Θ(1) space", "best case Θ(n)", "stable"],
    blurb:
      "<p><b>Bubbles rising in a glass.</b> Swap out-of-order neighbours, pass after pass, and the largest values float to the end, so each pass gets shorter. A pass with no swaps means it's sorted: Θ(n) in the best case.</p>",
    run(a, s) {
      const n = a.length;
      for (let i = n - 1; i >= 1; i--) {
        s.snap({}, "outer", "i = " + i + ". This pass bubbles the largest value in A[0…" + i + "] up to index " + i + ".");
        let swapped = false;
        s.snap({}, "reset", "swapped ← false.");
        for (let j = 0; j < i; j++) {
          s.cmp++;
          const out = a[j] > a[j + 1];
          s.snap({ [j]: "cmp", [j + 1]: "cmp" }, ["inner", "cmp"], "j = " + j + ": is A[" + j + "] = " + a[j] + " &gt; A[" + (j + 1) + "] = " + a[j + 1] + "? " + (out ? "<b>Yes</b>." : "No, leave them."));
          if (out) {
            [a[j], a[j + 1]] = [a[j + 1], a[j]];
            s.mov += 2;
            swapped = true;
            s.snap({ [j]: "swap", [j + 1]: "swap" }, "swap", "Swap them and set swapped ← true. The bigger value keeps moving right.");
          }
        }
        s.done.add(i);
        if (!swapped) {
          for (let k = 0; k < i; k++) s.done.add(k);
          s.snap({}, "exit", "swapped is still false: no pair was out of order, so the array is sorted. <b>break</b>.");
          break;
        }
        s.snap({}, "exit^", "Inner loop done: A[" + i + "] = " + a[i] + " is in its final place. swapped is true, so keep going.");
      }
      for (let k = 0; k < n; k++) s.done.add(k);
      s.snap({}, null, "Sorted.");
    },
  };

  ALGO.selection = {
    label: "Selection Sort",
    code: CODE.selection,
    big: ["Θ(n²) time (worst)", "Θ(1) space", "every case Θ(n²)", "not stable"],
    blurb:
      "<p><b>Picking teams: always take the best one left.</b> Find the minimum of the unsorted part and swap it to the front. Always n(n−1)/2 comparisons, but at most n − 1 swaps.</p>",
    run(a, s) {
      const n = a.length;
      for (let i = 0; i < n - 1; i++) {
        s.snap({ [i]: "active" }, "outer", "i = " + i + ": find the smallest value in A[" + i + "…" + (n - 1) + "] and put it at index " + i + ".");
        let min = i;
        s.snap({ [i]: "active", [min]: "target" }, "init", "min ← " + i + ": assume A[" + i + "] = " + a[i] + " is the smallest.");
        for (let j = i + 1; j < n; j++) {
          s.cmp++;
          const less = a[j] < a[min];
          s.snap({ [j]: "cmp", [min]: "target", [i]: "active" }, ["inner", "cmp"], "j = " + j + ": is A[" + j + "] = " + a[j] + " &lt; A[min] = " + a[min] + "? " + (less ? "<b>Yes</b>." : "No."));
          if (less) {
            min = j;
            s.snap({ [min]: "target", [i]: "active" }, "upd", "min ← " + j + ". The smallest so far is " + a[min] + ".");
          }
        }
        if (min !== i) {
          [a[i], a[min]] = [a[min], a[i]];
          s.mov += 2;
          s.done.add(i);
          s.snap({ [i]: "swap", [min]: "swap" }, "swap", "min = " + min + " ≠ i = " + i + ": swap. A[" + i + "] = " + a[i] + " is now final.");
        } else {
          s.done.add(i);
          s.snap({ [i]: "done" }, "swap^", "min == i: the minimum is already at index " + i + ", so the swap is skipped.");
        }
      }
      for (let k = 0; k < n; k++) s.done.add(k);
      s.snap({}, null, "Positions 0…" + (n - 2) + " are final, so the last one is too. Sorted.");
    },
  };

  ALGO.insertion = {
    label: "Insertion Sort",
    code: CODE.insertion,
    big: ["Θ(n²) time (worst)", "Θ(1) space", "best case Θ(n)", "stable"],
    blurb:
      "<p><b>Sorting a hand of cards.</b> Take the next card and slide it left past the bigger ones into place. Nearly sorted input barely moves, so libraries use it for small pieces.</p>",
    run(a, s) {
      const n = a.length;
      s.done.add(0);
      for (let i = 1; i < n; i++) {
        s.snap({ [i]: "active" }, "outer", "i = " + i + ": A[0…" + (i - 1) + "] is sorted. Insert A[" + i + "] into it.");
        const key = a[i];
        let j = i - 1;
        s.snap({ [i]: "active" }, "key", "key ← A[" + i + "] = " + key + ", j ← " + j + ". Slot " + i + " is now a hole.", { key: key, hole: i });
        for (;;) {
          if (j < 0) { s.snap({}, "cmp", "j = −1: we reached the front, so the loop stops.", { key: key, hole: 0 }); break; }
          s.cmp++;
          if (a[j] > key) {
            s.snap({ [j]: "cmp" }, "cmp", "A[" + j + "] = " + a[j] + " &gt; key " + key + ": keep going.", { key: key, hole: j + 1 });
            a[j + 1] = a[j];
            s.mov++;
            s.snap({ [j + 1]: "swap" }, "shift", "A[" + (j + 1) + "] ← A[" + j + "] = " + a[j] + ", then j ← " + (j - 1) + ".", { key: key, hole: j });
            j--;
          } else {
            s.snap({ [j]: "cmp" }, "cmp", "A[" + j + "] = " + a[j] + " ≤ key " + key + ": the loop stops.", { key: key, hole: j + 1 });
            break;
          }
        }
        a[j + 1] = key;
        s.mov++;
        s.done.add(i);
        s.snap({ [j + 1]: "done" }, "drop", "A[" + (j + 1) + "] ← key " + key + ". A[0…" + i + "] is sorted.");
      }
      s.snap({}, null, "Sorted.");
    },
  };

  ALGO.heap = {
    label: "Heap Sort",
    code: CODE.heap,
    big: ["Θ(n log n) time (worst)", "Θ(1) space", "not stable"],
    blurb:
      "<p><b>A tournament.</b> Build a max-heap in Θ(n) so the champion is on top, swap it to the end, shrink the heap, and let the next champion rise. Θ(n log n), with no extra memory.</p>",
    run(a, s) {
      const n = a.length;
      const down = (i, size) => {
        for (;;) {
          const l = 2 * i + 1;
          if (l >= size) {
            s.snap({ [i]: "active" }, "dloop", "2·" + i + " + 1 = " + l + " ≥ size " + size + ": A[" + i + "] has no child in the heap, so the loop ends.", { heapSize: size });
            return;
          }
          let c = l;
          if (c + 1 < size) { s.cmp++; if (a[c + 1] > a[c]) c = c + 1; }
          s.snap({ [i]: "active", [c]: "cmp" }, "child", l + 1 < size
            ? "Children of " + i + ": A[" + l + "] = " + a[l] + " and A[" + (l + 1) + "] = " + a[l + 1] + ". The larger is <b>A[" + c + "] = " + a[c] + "</b>."
            : "A[" + i + "] has one child, A[" + c + "] = " + a[c] + ".", { heapSize: size });
          s.cmp++;
          if (a[i] >= a[c]) {
            s.snap({ [i]: "active", [c]: "cmp" }, "dcmp", "A[" + i + "] = " + a[i] + " ≥ A[" + c + "] = " + a[c] + ": heap order holds. <b>break</b>.", { heapSize: size });
            return;
          }
          [a[i], a[c]] = [a[c], a[i]];
          s.mov += 2;
          s.snap({ [i]: "swap", [c]: "swap" }, "dswap", "The parent was smaller than its child, so swap them and continue from i ← " + c + ".", { heapSize: size });
          i = c;
        }
      };
      s.snap({}, "build", "<b>Phase 1: build a max-heap.</b> Indices " + Math.floor(n / 2) + "…" + (n - 1) + " are leaves, so i starts at ⌊n/2⌋ − 1 = " + (Math.floor(n / 2) - 1) + ".", { heapSize: n });
      for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        s.snap({ [i]: "active" }, ["build", "bcall"], "i = " + i + ": downHeap(A, " + i + ", " + n + "): sift A[" + i + "] = " + a[i] + " down.", { heapSize: n });
        down(i, n);
      }
      s.snap({ 0: "target" }, "extract", "<b>Phase 2.</b> A is a max-heap, so A[0] = " + a[0] + " is the largest value.", { heapSize: n });
      for (let end = n - 1; end >= 1; end--) {
        [a[0], a[end]] = [a[end], a[0]];
        s.mov += 2;
        s.done.add(end);
        s.snap({ 0: "swap", [end]: "swap" }, ["extract", "eswap"], "end = " + end + ": swap the max into A[" + end + "]. That slot is final; the heap is now A[0…" + (end - 1) + "].", { heapSize: end });
        s.snap({ 0: "active" }, "ecall", "downHeap(A, 0, " + end + "): repair the heap from the root.", { heapSize: end });
        down(0, end);
      }
      s.done.add(0);
      s.snap({}, null, "Sorted.", { heapSize: 0 });
    },
  };

  ALGO.merge = {
    label: "Merge Sort",
    tree: true,
    code: CODE.merge,
    big: ["Θ(n log n) time (worst)", "Θ(n) space", "stable"],
    blurb:
      "<p><b>Merging two sorted stacks of exams</b> by always taking the smaller top sheet. Split in half, sort each half, merge. Θ(n log n) on every input and stable, but the merge needs an Θ(n) scratch buffer.</p>",
    run(a, s) {
      treeOps(s);
      const rangeMarks = (lo, hi, cls) => { const m = {}; for (let t = lo; t <= hi; t++) m[t] = cls || "range"; return m; };
      const merge = (lo, mid, hi) => {
        const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);
        let i = 0, j = 0, k = lo;
        const rows = () => [
          { label: "L (A[" + lo + ".." + mid + "])", arr: L, marks: { [i]: "active" } },
          { label: "R (A[" + (mid + 1) + ".." + hi + "])", arr: R, marks: { [j]: "cmp" } },
        ];
        s.snap(rangeMarks(lo, hi), "copy", "merge: copy the halves into <b>L</b> and <b>R</b>; i = j = 0, k = " + lo + ".", { rows: rows() });
        while (i < L.length && j < R.length) {
          s.cmp++;
          const takeL = L[i] <= R[j];
          a[k++] = takeL ? L[i++] : R[j++];
          s.mov++;
          s.snap(Object.assign(rangeMarks(lo, hi), { [k - 1]: "swap" }), "take", "L[i] = " + (takeL ? a[k - 1] : L[i]) + " vs R[j] = " + (takeL ? R[j] : a[k - 1]) + " → take " + (takeL ? "L" : "R") + "'s " + a[k - 1] + " and write it to A[" + (k - 1) + "].", { rows: rows() });
        }
        while (i < L.length || j < R.length) {
          const fromL = i < L.length;
          a[k++] = fromL ? L[i++] : R[j++];
          s.mov++;
          s.snap(Object.assign(rangeMarks(lo, hi), { [k - 1]: "swap" }), "rest", (fromL ? "R" : "L") + " is used up: copy " + a[k - 1] + " from " + (fromL ? "L" : "R") + " to A[" + (k - 1) + "].", { rows: rows() });
        }
      };
      const ms = (lo, hi, depth, parent) => {
        if (s.stop()) return;
        const id = lo <= hi ? s.node(lo, hi, parent, depth) : parent;
        s.snap(rangeMarks(lo, hi), "fn", "mergeSort(A, " + lo + ", " + hi + ") at depth " + depth + ".");
        if (lo >= hi) {
          if (lo === hi) s.finish(id);
          s.snap(lo === hi ? { [lo]: "done" } : {}, "base", lo === hi ? "One element is already sorted: return." : "Empty range: return.");
          return;
        }
        const mid = Math.floor((lo + hi) / 2);
        s.snap(rangeMarks(lo, hi), "mid", "mid = ⌊(" + lo + " + " + hi + ")/2⌋ = " + mid + ".");
        s.snap(rangeMarks(lo, mid), "rec1", "<b>Divide:</b> sort the left half A[" + lo + "…" + mid + "].");
        ms(lo, mid, depth + 1, id);
        s.cur = id;
        s.snap(rangeMarks(mid + 1, hi), "rec2", "Back in mergeSort(A, " + lo + ", " + hi + "). Now sort the right half A[" + (mid + 1) + "…" + hi + "].");
        ms(mid + 1, hi, depth + 1, id);
        s.cur = id;
        s.snap(rangeMarks(lo, hi), "mcall", "<b>Combine:</b> both halves are sorted. Merge them.");
        merge(lo, mid, hi);
        s.finish(id);
        s.snap(rangeMarks(lo, hi, "done"), "mcall", "merge returned: A[" + lo + "…" + hi + "] is sorted.");
      };
      ms(0, a.length - 1, 0, -1);
      for (let k = 0; k < a.length; k++) s.done.add(k);
      s.snap({}, null, "Sorted.");
    },
  };

  ALGO.quick = {
    label: "Quick Sort",
    tree: true,
    code: CODE.quick,
    big: ["Θ(n²) time (worst)", "Θ(n) stack space (worst)", "average Θ(n log n)", "not stable"],
    blurb:
      "<p><b>Lining up around one person's height:</b> shorter to the left, taller to the right, then repeat on each side. The pivot is the first element; i scans right for a key ≥ pivot, j scans left for a key ≤ pivot, and each such pair swaps until the two scans cross. Sorted input makes every split lopsided: Θ(n²).</p>",
    run(a, s) {
      treeOps(s);
      const rangeMarks = (lo, hi, cls) => { const m = {}; for (let t = lo; t <= hi; t++) m[t] = cls || "range"; return m; };
      const part = (low, high) => {
        const pivot = a[low];
        let i = low, j = high + 1;
        const marks = (extra) => Object.assign(rangeMarks(low, high), { [low]: "pivot" }, extra || {});
        const at = () => { const m = {}; if (i > low && i <= high) m[i] = "active"; if (j >= low && j <= high && j !== low) m[j] = "cmp"; return m; };
        /* where the scans are, for the numbers view: blue ≤ pivot behind i, pink ≥ pivot behind j */
        const P = (k) => ({ pt: { lo: low, hi: high, i: i, j: j, k: k } });
        s.snap(marks(), "pivot", "partition: pivot ← A[" + low + "] = " + pivot + " (the first element), i ← " + low + ", j ← " + (high + 1) + ".", P("start"));
        while (true) {
          if (s.stop()) return low;
          s.snap(marks(at()), "ploop", "Scan for an out-of-place pair.", P("scan"));
          while (true) {
            i++;
            s.cmp++;
            const less = a[i] < pivot;
            const edge = less && i === high;
            s.snap(marks(at()), "pi", "i = " + i + ": is A[" + i + "] = " + a[i] + " &lt; pivot " + pivot + "? " + (less ? "<b>Yes</b>" + (edge ? ", but i = high, so stop." : ", keep going.") : "No, so i stops here."), P("scan"));
            if (!less || i === high) break;
          }
          while (true) {
            j--;
            s.cmp++;
            const more = pivot < a[j];
            const edge = more && j === low;
            s.snap(marks(at()), "pj", "j = " + j + ": is pivot " + pivot + " &lt; A[" + j + "] = " + a[j] + "? " + (more ? "<b>Yes</b>" + (edge ? ", but j = low, so stop." : ", keep going.") : "No, so j stops here."), P("scan"));
            if (!more || j === low) break;
          }
          if (i >= j) {
            s.snap(marks(at()), "pcross", "i = " + i + " ≥ j = " + j + ": the scans crossed, so stop.", P("cross"));
            break;
          }
          [a[i], a[j]] = [a[j], a[i]];
          s.mov += 2;
          s.snap(marks({ [i]: "swap", [j]: "swap" }), "pswap", "Swap A[" + i + "] and A[" + j + "]: now " + a[i] + " ≤ pivot sits left and " + a[j] + " ≥ pivot sits right.", P("swap"));
        }
        [a[low], a[j]] = [a[j], a[low]];
        s.mov += 2;
        s.done.add(j);
        s.pivot(s.cur, j);
        s.snap(Object.assign(rangeMarks(low, high), { [j]: "done" }), "pfinal", "Swap the pivot into A[" + j + "]: keys ≤ " + pivot + " are left of it and keys ≥ " + pivot + " are right, so it is final. Return " + j + ".", P("final"));
        return j;
      };
      const qs = (low, high, depth, parent) => {
        if (s.stop()) return;
        const id = low <= high ? s.node(low, high, parent, depth) : (s.cur = parent);
        s.snap(low <= high ? rangeMarks(low, high) : {}, "fn", "quickSort(A, " + low + ", " + high + ").");
        if (low >= high) {
          if (low === high) { s.done.add(low); s.finish(id); }
          s.snap(low === high ? { [low]: "done" } : {}, "base", low === high ? "A[" + low + "] is a single element: return." : "Empty range: return.");
          return;
        }
        s.snap(rangeMarks(low, high), "part", "<b>Divide:</b> partition A[" + low + "…" + high + "] around its first element A[" + low + "] = " + a[low] + ".");
        const p = part(low, high);
        s.snap(p - 1 >= low ? rangeMarks(low, p - 1) : {}, "rec1", "partition returned s = " + p + ". Sort the left part A[" + low + "…" + (p - 1) + "].");
        qs(low, p - 1, depth + 1, id);
        s.cur = id;
        s.snap(p + 1 <= high ? rangeMarks(p + 1, high) : {}, "rec2", "Back in quickSort(A, " + low + ", " + high + "). Sort the right part A[" + (p + 1) + "…" + high + "].");
        qs(p + 1, high, depth + 1, id);
        s.cur = id;
        s.finish(id);
        s.snap(rangeMarks(low, high, "done"), "rec2", "<b>Combine:</b> both sides are sorted and the pivot " + a[p] + " sits between them, so A[" + low + "…" + high + "] is sorted. Nothing to merge: quick sort did its work in the partition, before recursing.");
      };
      qs(0, a.length - 1, 0, -1);
      for (let k = 0; k < a.length; k++) s.done.add(k);
      s.snap({}, null, "Sorted.");
    },
  };

  ALGO.twothird = {
    label: "Two-Third Sort",
    code: CODE.twothird,
    big: ["Θ(n<sup>log<sub>3/2</sub> 3</sup>) time", "Θ(log n) stack space", "not stable"],
    blurb:
      "<p><b>A deliberately bad sort, good for practising recurrences.</b> Fix the ends, then sort the first two-thirds, the last two-thirds, and the first two-thirds again; the repeat is what makes it correct. T(n) = 3T(2n/3) + Θ(1) = Θ(n<sup>log<sub>3/2</sub> 3</sup>). The exponent log<sub>3/2</sub> 3 = log 3 / log 1.5 ≈ 2.7095… is irrational, so it is written exactly, not rounded.</p>",
    maxN: 14,
    run(a, s) {
      const rangeMarks = (lo, hi) => { const m = {}; for (let t = lo; t <= hi; t++) m[t] = "range"; return m; };
      const rec = (i, j, depth) => {
        if (s.stop()) return;
        s.snap(rangeMarks(i, j), "fn", "twoThirdSort(A, " + i + ", " + j + "): " + (j - i + 1) + " elements, depth " + depth + ".");
        s.cmp++;
        if (a[i] > a[j]) {
          [a[i], a[j]] = [a[j], a[i]];
          s.mov += 2;
          s.snap(Object.assign(rangeMarks(i, j), { [i]: "swap", [j]: "swap" }), "ends", "A[" + i + "] &gt; A[" + j + "]: the ends are out of order, so swap them.");
        } else {
          s.snap(Object.assign(rangeMarks(i, j), { [i]: "cmp", [j]: "cmp" }), "ends^", "A[" + i + "] = " + a[i] + " ≤ A[" + j + "] = " + a[j] + ": the ends are in order.");
        }
        if (j - i + 1 > 2) {
          const t = Math.floor((j - i + 1) / 3);
          s.snap(rangeMarks(i, j), "t", (j - i + 1) + " &gt; 2 elements, so t = ⌊" + (j - i + 1) + "/3⌋ = " + t + ".");
          s.snap(rangeMarks(i, j - t), "r1", "Sort the <b>first two-thirds</b> A[" + i + "…" + (j - t) + "].");
          rec(i, j - t, depth + 1);
          s.snap(rangeMarks(i + t, j), "r2", "Sort the <b>last two-thirds</b> A[" + (i + t) + "…" + j + "]. This pulls the big values to the back.");
          rec(i + t, j, depth + 1);
          s.snap(rangeMarks(i, j - t), "r3", "Sort the <b>first two-thirds again</b>: the previous call may have disturbed it.");
          rec(i, j - t, depth + 1);
        } else {
          s.snap(rangeMarks(i, j), "size", "Only " + (j - i + 1) + " element(s), and the ends are in order: return.");
        }
      };
      rec(0, a.length - 1, 0);
      for (let k = 0; k < a.length; k++) s.done.add(k);
      s.snap({}, null, "Sorted, in a spectacularly inefficient number of steps.");
    },
  };

  ALGO.counting = {
    label: "Counting Sort",
    code: CODE.counting,
    big: ["Θ(n + k) time", "Θ(n + k) space", "stable", "not comparison-based", "k = max − min"],
    blurb:
      "<p><b>Sorting mail into pigeonholes.</b> Count each key, turn the counts into running totals (where each key's block ends), then place items from the right to keep them stable. No comparisons: Θ(n + k), best when the key range is small.</p>",
    kRange: true,
    run(a, s) {
      const n = a.length;
      const bad = a.findIndex((x) => !Number.isInteger(x));
      if (bad >= 0) {
        s.snap({ [bad]: "swap" }, "check", "<b style='color:var(--c-swap)'>✗ Error:</b> A[" + bad + "] = " + a[bad] + " is not an integer. Counting sort uses each key as an array index, so it only works for integer keys. The method throws and A is unchanged.");
        return;
      }
      const lo = Math.min.apply(null, a), k = Math.max.apply(null, a) - lo;
      s.snap({}, "check^", "Every key is an integer, so each one can be used as an index.");
      s.snap({}, "range", "lo = min = " + lo + ", max = " + (k + lo) + ", so k = " + k + ". Key x is counted in C[x − lo]" + (lo ? ", so the smallest key lands at index 0" : "") + ".");
      const C = new Array(k + 1).fill(0);
      const B = new Array(n).fill(null);
      const rows = (cm, bm) => [
        { label: "C (counts; index i counts the key i + lo = " + (lo < 0 ? "i − " + -lo : "i + " + lo) + ")", arr: C, marks: cm || {}, showIndex: true, noMotion: true },
        { label: "B (output)", arr: B, marks: bm || {} },
      ];
      s.snap({}, "alloc", "C gets k + 1 = " + (k + 1) + " zeros and B gets " + n + " empty slots.", { rows: rows() });
      for (let i = 0; i < n; i++) {
        C[a[i] - lo]++;
        s.mov++;
        s.snap({ [i]: "active" }, "count", "x = A[" + i + "] = " + a[i] + ": C[" + a[i] + " − " + lo + "] = C[" + (a[i] - lo) + "] becomes " + C[a[i] - lo] + ".", { rows: rows({ [a[i] - lo]: "swap" }) });
      }
      for (let v = 1; v <= k; v++) {
        C[v] += C[v - 1];
        s.snap({}, "prefix", "v = " + v + ": C[" + v + "] += C[" + (v - 1) + "] → " + C[v] + ". That many keys are ≤ " + (v + lo) + ".", { rows: rows({ [v]: "swap", [v - 1]: "cmp" }) });
      }
      if (k < 1) s.snap({}, "prefix", "k = 0, so the prefix-sum loop does not run.", { rows: rows() });
      for (let i = n - 1; i >= 0; i--) {
        const key = a[i], c = key - lo;
        C[c]--;
        B[C[c]] = key;
        s.mov++;
        s.snap({ [i]: "active" }, ["place", "put"], "idx = " + i + ": A[" + i + "] = " + key + ". C[" + c + "] drops to " + C[c] + ", so B[" + C[c] + "] ← " + key + ".", { rows: rows({ [c]: "cmp" }, { [C[c]]: "swap" }) });
      }
      for (let i = 0; i < n; i++) { a[i] = B[i]; s.done.add(i); }
      s.snap({}, "back", "Copy B back into A.", { rows: rows({}, allMarks(n, "done")) });
      s.snap({}, null, "Sorted with zero comparisons: Θ(n + k) = Θ(" + n + " + " + k + ") time and extra space.", { rows: rows() });
      function allMarks(m, cls) { const o = {}; for (let t = 0; t < m; t++) o[t] = cls; return o; }
    },
  };

  /* ---------- page wiring ---------- */
  const ORDER = ["bubble", "selection", "insertion", "heap", "merge", "quick", "twothird", "counting"];
  let arr = [], barsEl = null, cur = "bubble";

  const q = (id) => D.$("#" + id);

  function buildBars(len) {
    barsEl.innerHTML = "";
    for (let i = 0; i < len; i++) {
      const b = D.el("div", { class: "bar" }, [D.el("span", { class: "lbl" })]);
      barsEl.appendChild(b);
    }
    barsEl.appendChild(D.el("div", { class: "zero-line", title: "0" }));
    barsEl.classList.toggle("labeled", len <= 32);
  }

  function cellsRow(row, max) {
    const wrap = D.el("div", { style: "margin-top:1rem" });
    if (row.noMotion) wrap.dataset.motion = "off";   /* counters change in place; a value does not travel between them */
    wrap.appendChild(D.el("div", { class: "small muted", text: row.label, style: "margin-bottom:.15rem" }));
    const cells = D.el("div", { class: "cells" + (row.showIndex !== false ? " indexed" : "") });
    row.arr.forEach((v, i) => {
      const c = D.el("div", { class: "cell " + (row.marks[i] || "") + (v == null ? " empty" : " filled"), text: v == null ? "·" : v });
      if (row.showIndex !== false) c.appendChild(D.el("span", { class: "idx", text: i }));
      cells.appendChild(c);
    });
    wrap.appendChild(cells);
    return wrap;
  }

  /* ---------- the divide-and-conquer tree ------------------------
     Drawn like the lecture slides: each call is a blue box holding its
     sub-array as the call starts, a solid arrow per recursive call, the
     pivot in yellow with a dotted line straight down, and a pink box with
     the sorted result once the call returns, arrows joining upward.
     Merge sort's boxes sit under the array slots they cover; quick sort's
     pivot sits under the middle of its call, as in the slides. Each pink box sits one row below everything
     its own call did, so a lopsided quick sort stays tidy, and every line
     into a pink box drops straight down its own column first: no line
     crosses a box. The layout uses the whole run's tree, so the picture
     keeps one size while it grows. */
  const TREE_MAX = 24;
  const TC = { blue: "#d4f0fc", pink: "#ffdde1", yellow: "#fff6c2", ink: "#3f4652", on: "#1d4ed8" };
  function drawTree(f) {
    const wrap = q("dc-wrap");
    if (!wrap) return;
    if (!f.arr) return;
    const host = q("dc-tree");
    host.innerHTML = "";
    const n = f.arr.length;
    if (n > TREE_MAX) {
      host.appendChild(D.el("p", { class: "small muted", style: "margin:.3rem 0", text: "The tree is drawn for up to " + TREE_MAX + " values, so it stays readable. Make the array smaller (Size) to see it." }));
      return;
    }
    const nodes = (f.tree || []);
    const t = f.t == null ? -1 : f.t;
    const kids = {};
    nodes.forEach((nd) => { if (nd.parent >= 0) (kids[nd.parent] = kids[nd.parent] || []).push(nd); });
    /* the row of the box that stands for a call's result: a one-element call is its own blue box;
       a bigger call's pink box goes one row below its children's results and its pivot */
    const pinkAt = {};
    const resultRow = (nd) => {
      if (nd.hi <= nd.lo) return nd.depth;
      if (pinkAt[nd.id] == null) {
        let r = nd.depth + (nd.piv >= 0 ? 1 : 0);
        (kids[nd.id] || []).forEach((ch) => { r = Math.max(r, resultRow(ch)); });
        pinkAt[nd.id] = r + 1;
      }
      return pinkAt[nd.id];
    };
    let rows = 1;
    nodes.forEach((nd) => { rows = Math.max(rows, resultRow(nd) + 1); });
    const fmt = (v) => String(v);
    const longest = Math.max(1, ...f.arr.map((v) => fmt(v).length));
    /* spread the columns over the width the panel has, up to a comfortable size */
    const need = Math.max(26, (longest + 1) * 7.6 + 10), room = ((host.clientWidth || 700) - 24) / n;
    const cw = Math.max(need, Math.min(room, need * 2.6)), pad = 10, g = Math.min(8, cw * 0.12), bh = 28, rowH = 56;
    const X = (lo, hi) => ({ x: pad + lo * cw + g, w: (hi - lo + 1) * cw - 2 * g });
    /* where each call's box goes ({x, w}), and each pivot's.
       Merge sort: under the array slots the call covers.
       Quick sort, like the slides: the pivot right under the middle of its call, the part left of the
       pivot (and everything it calls) to its left, the part right of it to its right, each box as wide
       as its numbers. ext = how far a call's whole subtree reaches left and right of its centre. */
    const at = {}, pat = {};
    const quick = nodes.some((nd) => nd.piv >= 0);
    let W;
    if (quick) {
      const GAP = 12, textW = (vals) => Math.max(30, ("[" + vals.map(fmt).join(" ") + "]").length * 8.15 + 16);
      const sideOf = (nd, left) => (kids[nd.id] || []).find((ch) => (left ? ch.hi < nd.piv : ch.lo > nd.piv));
      const extOf = {};
      const ext = (nd) => {
        if (extOf[nd.id]) return extOf[nd.id];
        const w = textW(nd.vals);
        let l = w / 2, r = w / 2;
        if (nd.piv >= 0) {
          const wp = textW([nd.pivVal]), L = sideOf(nd, true), R = sideOf(nd, false);
          l = Math.max(l, wp / 2); r = Math.max(r, wp / 2);
          if (L) l = Math.max(l, wp / 2 + GAP + ext(L).r + ext(L).l);
          if (R) r = Math.max(r, wp / 2 + GAP + ext(R).l + ext(R).r);
        }
        return (extOf[nd.id] = { l: l, r: r });
      };
      const place = (nd, cx) => {
        const w = textW(nd.vals);
        at[nd.id] = { x: cx - w / 2, w: w };
        if (nd.piv < 0) return;
        const wp = textW([nd.pivVal]), L = sideOf(nd, true), R = sideOf(nd, false);
        pat[nd.id] = { x: cx - wp / 2, w: wp };
        if (L) place(L, cx - wp / 2 - GAP - ext(L).r);
        if (R) place(R, cx + wp / 2 + GAP + ext(R).l);
      };
      let x0 = pad;
      nodes.filter((nd) => nd.parent < 0).forEach((r) => { place(r, x0 + ext(r).l); x0 += ext(r).l + ext(r).r + GAP; });
      W = Math.max(x0 - GAP + pad, 200);
    } else {
      nodes.forEach((nd) => { at[nd.id] = X(nd.lo, nd.hi); });
      W = pad * 2 + n * cw;
    }
    const H = rows * rowH - (rowH - bh) + 16;
    /* a tree wider than the panel shrinks to fit, down to 75% so the numbers stay readable, then scrolls */
    const svg = D.svg("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, style: "display:block;margin:0 auto;max-width:100%;min-width:" + Math.round(W * 0.75) + "px;height:auto", role: "img", "aria-label": "Divide and conquer recursion tree" });
    const mk = (id) => D.svg("marker", { id: id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, [D.svg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: TC.ink })]);
    svg.appendChild(D.svg("defs", {}, [mk("dcArw")]));
    const Y = (row) => 8 + row * rowH;
    const box = (b, row, vals, fill, on) => {
      const y = Y(row);
      svg.appendChild(D.svg("rect", { x: b.x, y: y, width: b.w, height: bh, rx: 7, fill: fill, stroke: on ? TC.on : TC.ink, "stroke-width": on ? 2.6 : 1.2 }));
      const txt = "[" + vals.map(fmt).join(" ") + "]";
      svg.appendChild(D.sText(b.x + b.w / 2, y + bh / 2, txt, { "font-family": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", "font-size": 13.5, fill: "#172030" }));
      return { cx: b.x + b.w / 2, l: b.x, r: b.x + b.w, top: y, bot: y + bh };
    };
    const line = (d, dotted) => svg.appendChild(D.svg("path", { d: d, fill: "none", stroke: TC.ink, "stroke-width": 1.2, "stroke-dasharray": dotted ? "2 3" : null, "marker-end": "url(#dcArw)" }));
    const arrow = (x1, y1, x2, y2, dotted) => line("M" + x1 + " " + y1 + "L" + x2 + " " + (y2 - 1), dotted);
    /* into a pink box: straight down its own column to the gap above the box, then a short slant in,
       landing on the box (its nearest part, when the box is off to one side) */
    const join = (from, to, dotted) => {
      const x2 = Math.min(to.r - 8, Math.max(to.l + 8, from.cx + (to.cx - from.cx) * 0.35)), yGap = to.top - (rowH - bh);
      line("M" + from.cx + " " + from.bot + (yGap > from.bot + 1 ? "V" + yGap : "") + "L" + x2 + " " + (to.top - 1), dotted);
    };
    const vis = nodes.filter((nd) => nd.born <= t);
    const blue = {};
    /* split half: blue boxes and the arrows into them */
    vis.forEach((nd) => {
      const on = nd.id === f.tn && !(nd.doneAt <= t && nd.hi > nd.lo);
      blue[nd.id] = box(at[nd.id], nd.depth, nd.vals, TC.blue, on);
      const p = nd.parent >= 0 ? blue[nd.parent] : null;
      if (p) arrow(p.cx, p.bot, blue[nd.id].cx, blue[nd.id].top);
    });
    /* pivots: yellow, one row below their call, dotted straight down */
    const piv = {};
    vis.forEach((nd) => {
      if (nd.pivAt > t) return;
      piv[nd.id] = box(pat[nd.id] || X(nd.piv, nd.piv), nd.depth + 1, [nd.pivVal], TC.yellow, false);
      arrow(piv[nd.id].cx, blue[nd.id].bot, piv[nd.id].cx, piv[nd.id].top, true);
    });
    /* combine half: pink results, joined from each child's result and the pivot */
    const last = {};
    vis.forEach((nd) => { last[nd.id] = blue[nd.id]; });
    vis.slice().sort((x, y) => resultRow(x) - resultRow(y)).forEach((nd) => {
      if (nd.hi <= nd.lo || nd.doneAt > t) return;
      const on = nd.id === f.tn;
      const pk = box(at[nd.id], pinkAt[nd.id], nd.out, TC.pink, on);
      (kids[nd.id] || []).forEach((ch) => { if (last[ch.id]) join(last[ch.id], pk); });
      if (piv[nd.id]) join(piv[nd.id], pk, true);
      last[nd.id] = pk;
    });
    if (!vis.length) svg.appendChild(D.sText(W / 2, 20, "the tree grows here as the calls happen", { class: "lbl-s", "font-size": 13 }));
    host.appendChild(svg);
  }

  /* ---------- the numbers view, like the partition slides --------------
     The array as a row of numbered boxes, one row per step for the last
     few steps (newest at the bottom), each with its caption. In quick
     sort's partition: the pivot is yellow, keys already known ≤ pivot are
     blue, keys known ≥ pivot are pink, and i and j have red boxes. */
  const NV_ROWS = 6;
  function nvColors(fr) {
    const n = fr.arr.length, col = new Array(n).fill(""), ring = new Array(n).fill(false);
    const m = fr.marks || {};
    for (let k = 0; k < n; k++) {
      const c = m[k];
      if (c === "done") col[k] = "g";
      else if (c === "pivot") col[k] = "y";
      else if (c === "range") col[k] = "r";
      else if (c === "cmp" || c === "active") { col[k] = "r"; ring[k] = true; }
      else if (c === "swap") { col[k] = "s"; ring[k] = true; }
    }
    const pt = fr.pt;
    if (pt) {
      const paint = (a, b, c) => { for (let k = Math.max(a, pt.lo); k <= Math.min(b, pt.hi); k++) col[k] = c; };
      for (let k = pt.lo; k <= pt.hi; k++) ring[k] = false;
      if (pt.k === "final") { paint(pt.lo, pt.j - 1, "b"); paint(pt.j, pt.j, "y"); paint(pt.j + 1, pt.hi, "p"); }
      else {
        const sw = pt.k === "swap";
        paint(pt.lo, pt.hi, "");
        paint(pt.lo, pt.lo, "y");
        paint(pt.lo + 1, sw ? pt.i : Math.min(pt.i - 1, pt.j), "b");
        paint(sw ? pt.j : Math.max(pt.j + 1, pt.i), pt.hi, "p");
        if (pt.k !== "start") [pt.i, pt.j].forEach((k) => { if (k > pt.lo && k <= pt.hi) ring[k] = true; });
      }
    }
    return { col: col, ring: ring };
  }
  function nvRow(fr, now) {
    const c = nvColors(fr);
    const row = D.el("div", { class: "nv-row" + (now ? " now" : "") });
    const left = D.el("div", { class: "nv-left" });
    const cells = D.el("div", { class: "nv-cells" });
    fr.arr.forEach((v, k) => cells.appendChild(D.el("span", { class: "nv-c" + (c.col[k] ? " " + c.col[k] : "") + (c.ring[k] ? " ring" : ""), text: String(v) })));
    left.appendChild(cells);
    const ptr = D.el("div", { class: "nv-ptr", "aria-hidden": "true" });
    const pt = fr.pt;
    for (let k = 0; k <= fr.arr.length; k++) ptr.appendChild(D.el("span", { text: pt ? [pt.i === k ? "i" : "", pt.j === k ? "j" : ""].filter(Boolean).join(" ") : "" }));
    left.appendChild(ptr);
    row.appendChild(left);
    row.appendChild(D.el("div", { class: "nv-cap", html: fr.note || "" }));
    return row;
  }
  const sw = (bg, t) => "<span class='nv-key' style='background:" + bg + "'>" + t + "</span>";
  function drawNumbers(f, i, frames) {
    const host = q("nums");
    host.innerHTML = "";
    if (!f.arr) return;
    const n = f.arr.length;
    host.style.setProperty("--w", (n > 30 ? 30 : n > 16 ? 34 : 40) + "px");
    for (let k = i - NV_ROWS + 1; k <= i; k++) {
      const r = nvRow(frames[Math.max(0, k)], k === i);
      if (k < 0) r.classList.add("pad");     /* keeps the height the same from the first step */
      host.appendChild(r);
    }
    /* quick sort's colours mean something specific (the pivot, ≤ / ≥ pivot), so only it gets a key */
    const legend = q("nums-legend");
    legend.innerHTML = cur === "quick"
      ? sw("#fff176", "yellow") + " the pivot · " + sw("#b3e0f2", "blue") + " ≤ pivot · " + sw("#ffc9d3", "pink") + " ≥ pivot · <b style='color:#e11d48'>red box</b> i and j · " + sw("#c9efd3", "green") + " in its final place · the newest step is at the bottom"
      : "";
    legend.style.display = cur === "quick" ? "" : "none";
    const rows = q("nums-rows");
    rows.innerHTML = "";
    (f.rows || []).forEach((r) => rows.appendChild(cellsRow(r)));
  }

  /* ---------- which view: bars, numbers, or (merge and quick sort) the tree; one at a time ---------- */
  let viewPref = "bars";
  function syncViewMenu() {
    const sel = q("view");
    if (!sel) return "bars";
    const A = ALGO[cur];
    const opt = sel.querySelector('option[value="tree"]');
    if (A.tree && !opt) sel.appendChild(D.el("option", { value: "tree", text: "divide & conquer tree" }));
    if (!A.tree && opt) opt.remove();
    const v = viewPref === "tree" && !A.tree ? "bars" : viewPref;
    sel.value = v;
    return v;
  }
  function drawViews(f, i, frames) {
    const v = syncViewMenu();
    q("bars-wrap").style.display = v === "bars" ? "" : "none";
    q("nums-wrap").style.display = v === "numbers" ? "" : "none";
    q("dc-wrap").style.display = v === "tree" ? "" : "none";
    if (v === "numbers") drawNumbers(f, i || 0, frames || [f]);
    if (v === "tree") drawTree(f);
  }

  const LISTINGS = {};
  Object.keys(ALGO).forEach((id) => (LISTINGS[id] = Object.assign({ title: ALGO[id].label }, ALGO[id].code)));
  const M = (t) => "<span class='mono'>" + t + "</span>";
  const HI = { pseudo: "n − 1", java: "a.length - 1" };
  const sortSpec = (does, time, space, extra) => Object.assign({ does: does, params: M("A") + ": the array to sort (changed in place; negatives and decimals are fine)", returns: "nothing: A ends up in ascending order", errors: "none", time: time, space: space }, extra || {});
  D.specs(LISTINGS, {
    bubble: sortSpec("Repeatedly swaps neighbours that are out of order; stops early after a pass with no swaps. Stable.", "Θ(n²): reversed input; Θ(n) when already sorted", "Θ(1)"),
    selection: sortSpec("Repeatedly selects the minimum of the unsorted part and swaps it into place. Not stable.", "Θ(n²): on every input, though at most n − 1 swaps", "Θ(1)"),
    insertion: sortSpec("Grows a sorted prefix, shifting larger values right to drop each new key into place. Stable.", "Θ(n²): reversed input; Θ(n) when nearly sorted", "Θ(1)"),
    heap: sortSpec("Builds a max-heap in the array, then repeatedly swaps the maximum to the end and repairs the heap. Not stable.", "Θ(n log n)", "Θ(1): the heap lives inside A"),
    merge: sortSpec("Splits the range in half, sorts each half recursively, then merges the two sorted halves. Stable.", "Θ(n log n)", "Θ(n): the copies L and R, plus Θ(log n) stack", { params: M("A") + ": the array · " + M("lo") + ", " + M("hi") + ": the range to sort (call with 0 and n − 1)", callVals: { lo: "0", hi: HI } }),
    quick: sortSpec("Partitions around a pivot (the first element): i scans right, j scans left, and out-of-place pairs swap until they cross; then sorts both sides recursively. Not stable.", "Θ(n²): sorted input with this pivot; Θ(n log n) on average", "Θ(n): stack depth on sorted input; Θ(log n) on average", { params: M("A") + ": the array · " + M("low") + ", " + M("high") + ": the range to sort (call with 0 and n − 1)", callVals: { low: "0", high: HI } }),
    twothird: sortSpec("Sorts the first two-thirds, the last two-thirds, then the first two-thirds again, correct, but famously slow.", "Θ(n^(log 3 / log 1.5)): T(n) = 3T(2n/3) + Θ(1), and log 3 / log 1.5 = log₃⁄₂ 3 ≈ 2.7095", "Θ(log n): the recursion depth", { params: M("A") + ": the array · " + M("i") + ", " + M("j") + ": the range (call with 0 and n − 1)", callVals: { i: "0", j: HI } }),
    counting: sortSpec("Counts how many times each key occurs, turns the counts into positions, then places every key directly, no comparisons. Stable.", "Θ(n + k): k = max − min", "Θ(n + k): C and B", { params: M("A") + ": integer keys (negative is fine; a decimal makes it throw)", errors: "IllegalArgumentException if a key is not an integer" }),
  });
  D.sortAlgos = ALGO;   /* the growth-chart test checks its operation counts against these */
  const dock = D.CodeDock("#code", LISTINGS, { full: [{ name: "Sorts", title: "All the sorts", keys: Object.keys(LISTINGS), helpers: [{
    pseudo: ["min(A):                       // used by counting sort", "  return the smallest value in A", "", "max(A):                       // used by counting sort", "  return the largest value in A"],
    java: [
      "static double min(double[] a) { // used by countingSort",
      "  double m = a[0];",
      "  for (double x : a) if (x < m) m = x;",
      "  return m;",
      "}",
      "",
      "static double max(double[] a) { // used by countingSort",
      "  double m = a[0];",
      "  for (double x : a) if (x > m) m = x;",
      "  return m;",
      "}",
    ],
  }] }] });
  const player = new D.Player({
    mount: "#player",
    code: dock,
    render(f, i, frames) {
      if (!f.arr) return;
      if (barsEl.children.length !== f.arr.length + 1) buildBars(f.arr.length);
      /* bars grow up from 0 for positive values and down from 0 for negative ones */
      const hi = Math.max(0, Math.max.apply(null, f.arr)), lo = Math.min(0, Math.min.apply(null, f.arr));
      const span = hi - lo || 1;
      const zero = barsEl.lastChild;
      zero.style.display = lo < 0 ? "" : "none";
      zero.style.bottom = (-lo / span) * 100 + "%";
      for (let i = 0; i < f.arr.length; i++) {
        const b = barsEl.children[i], v = f.arr[i];
        b.className = "bar " + (v < 0 ? "neg " : "") + (f.marks && f.marks[i] ? f.marks[i] : "");
        b.style.height = Math.max(0.7, (Math.abs(v) / span) * 100) + "%";
        b.style.bottom = ((Math.min(v, 0) - lo) / span) * 100 + "%";
        b.firstChild.textContent = f.arr.length <= 32 ? v : "";
        b.dataset.v = v;
      }
      /* heap-sort boundary */
      const hb = q("heapline");
      if (f.heapSize != null && f.arr.length) {
        hb.style.display = "block";
        hb.textContent = "heap region: A[0…" + Math.max(0, f.heapSize - 1) + "]   sorted suffix: A[" + f.heapSize + "…" + (f.arr.length - 1) + "]";
      } else hb.style.display = "none";

      q("rows").innerHTML = "";
      (f.rows || []).forEach((r) => q("rows").appendChild(cellsRow(r)));
      drawViews(f, i, frames);

    },
  });

  /* the whole sort is recorded as soon as the array or the algorithm changes, so Play always has it */
  function drawStatic() {
    const fr = trace();
    fr[0] = Object.assign({}, fr[0], { note: "Ready: <b>press ▶ Play</b> (or space) to watch " + ALGO[cur].label + " sort these " + arr.length + " values, or drag the slider." });
    player.load(fr, false);
    if (!player.ctlShown) { fr[0] = Object.assign({}, fr[0], { note: "Pick an algorithm above, or press <b>▶ Run sort</b>, to load its steps." }); player.goto(0); }
  }

  function selectAlgo(id) {
    cur = id;
    const A = ALGO[id];
    q("algo-name").textContent = A.label;
    q("algo-blurb").innerHTML = A.blurb;
    q("algo-big").innerHTML = A.big.map((b) => "<span>" + b + "</span>").join("");
    dock.show(id);
    D.practiceShow(id);
    D.notesFor(id);
    D.$$("#algo-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
    if (A.maxN && arr.length > A.maxN) {
      newArray(A.maxN, "random");
      D.toast(A.label + " explodes combinatorially: trimmed to " + A.maxN + " elements.");
      return;
    }
    if (A.kRange) { regenForCounting(); return; }
    drawStatic();
  }

  /* counting sort draws one counter per key in min…max, so keep that range small enough to see */
  const MAX_K = 60;
  const kOf = (a) => Math.max.apply(null, a) - Math.min.apply(null, a);
  function regenForCounting() {
    if (kOf(arr) > MAX_K) {
      arr = arr.map(() => D.randInt(0, 9));
      q("custom").value = arr.join(", ");
      D.toast("Counting sort draws one counter per key between min and max, regenerated with keys 0–9.");
    }
    drawStatic();
  }

  function newArray(n, kind) {
    n = D.clamp(n, 3, 60);
    const A = ALGO[cur];
    if (A.maxN) n = Math.min(n, A.maxN);
    const hi = A.kRange ? 9 : 99, lo = A.kRange ? (kind === "mixed" ? -9 : 0) : kind === "mixed" ? -60 : 5;
    if (kind === "sorted") arr = Array.from({ length: n }, (_, i) => lo + Math.round((i * (hi - lo)) / (n - 1)));
    else if (kind === "reverse") arr = Array.from({ length: n }, (_, i) => hi - Math.round((i * (hi - lo)) / (n - 1)));
    else if (kind === "nearly") {
      arr = Array.from({ length: n }, (_, i) => lo + Math.round((i * (hi - lo)) / (n - 1)));
      for (let s = 0; s < Math.max(1, Math.round(n / 8)); s++) {
        const i = D.randInt(0, n - 2);
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      }
    } else if (kind === "few") arr = Array.from({ length: n }, () => [lo, Math.round((lo + hi) / 2), hi][D.randInt(0, 2)]);
    else if (kind === "mixed") {
      /* negative and decimal values; counting sort keeps integer keys, since it uses them as array indices */
      arr = Array.from({ length: n }, () => {
        if (A.kRange) return D.randInt(lo, hi);
        const v = lo + Math.random() * (hi - lo);
        return Math.random() < 0.5 ? Math.round(v) : Math.round(v * 10) / 10;
      });
    }
    else arr = D.randArray(n, lo, hi);
    q("size").value = n;
    q("size-out").textContent = n;
    q("custom").value = arr.join(", ");
    drawStatic();
  }

  function trace() {
    const A = ALGO[cur];
    const a = arr.slice();
    const R = new D.Recorder(9000);
    const s = {
      cmp: 0, mov: 0, done: new Set(),
      /* the divide-and-conquer tree (merge and quick sort): one node per call, stamped with
         the frame where it appears, gets its pivot, and finishes; frames share the one array */
      tree: [], cur: -1,
      stop: () => R.overflow,
      node(lo, hi, parent, depth) {
        const id = this.tree.length;
        this.tree.push({ id: id, lo: lo, hi: hi, parent: parent, depth: depth, vals: a.slice(lo, hi + 1), born: R.frames.length, piv: -1, pivAt: Infinity, out: null, doneAt: Infinity });
        this.cur = id;
        return id;
      },
      pivot(id, p) { const n = this.tree[id]; if (n) { n.piv = p; n.pivVal = a[p]; n.pivAt = R.frames.length; } },
      finish(id) { const n = this.tree[id]; if (n) { n.out = a.slice(n.lo, n.hi + 1); n.doneAt = R.frames.length; } },
      snap(marks, line, note, extra) {
        const m = {};
        this.done.forEach((i) => (m[i] = "done"));
        Object.assign(m, marks || {});
        const f = { arr: a.slice(), marks: m, code: cur, line: line, note: note, cmp: this.cmp, mov: this.mov };
        if (A.tree) { f.tree = this.tree; f.tn = this.cur; f.t = R.frames.length; }
        R.push(Object.assign(f, extra || {}));
      },
    };
    s.snap({}, null, "Start <b>" + A.label + "</b> on " + a.length + " elements.");
    A.run(a, s);
    if (R.overflow) D.toast("Step limit reached: try a smaller array.", true);
    const last = R.frames[R.frames.length - 1];
    if (last && last.line == null) last.note += " Total: <b>" + s.cmp + "</b> comparison(s) and <b>" + s.mov + "</b> write(s).";
    return R.frames;
  }
  function run() {
    if (!arr.length) { D.toast("Nothing to sort.", true); return; }
    player.load(trace(), true);
  }

  /* ---------- init ---------- */
  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "bubble": {
    "label": "Bubble sort",
    "items": [
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Try bubble sort: it times out, which is the lesson."
     ],
     [
      283,
      "Move Zeroes",
      "move-zeroes",
      "Easy",
      "Stable in-place movement of elements."
     ],
     [
      905,
      "Sort Array By Parity",
      "sort-array-by-parity",
      "Easy",
      "Swap out-of-place pairs until every even number comes first."
     ]
    ]
   },
   "selection": {
    "label": "Selection sort",
    "items": [
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Selection sort is always Θ(n²): see where it fails."
     ],
     [
      1051,
      "Height Checker",
      "height-checker",
      "Easy",
      "Compare an array with its sorted version."
     ],
     [
      414,
      "Third Maximum Number",
      "third-maximum-number",
      "Easy",
      "Three rounds of 'find the next largest', the core of selection sort."
     ]
    ]
   },
   "insertion": {
    "label": "Insertion sort",
    "items": [
     [
      147,
      "Insertion Sort List",
      "insertion-sort-list",
      "Medium",
      "Insertion sort on a linked list."
     ],
     [
      35,
      "Search Insert Position",
      "search-insert-position",
      "Easy",
      "Find where one key belongs in a sorted prefix."
     ],
     [
      1365,
      "How Many Numbers Are Smaller Than the Current Number",
      "how-many-numbers-are-smaller-than-the-current-number",
      "Easy",
      "Each element's final index in sorted order."
     ]
    ]
   },
   "heap": {
    "label": "Heap sort",
    "items": [
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Heap sort passes in Θ(n log n) with Θ(1) space."
     ],
     [
      215,
      "Kth Largest Element in an Array",
      "kth-largest-element-in-an-array",
      "Medium",
      "Stop heap sort after k extractions."
     ],
     [
      506,
      "Relative Ranks",
      "relative-ranks",
      "Easy",
      "Pull scores from a max-heap to assign ranks in order."
     ]
    ]
   },
   "merge": {
    "label": "Merge sort",
    "items": [
     [
      88,
      "Merge Sorted Array",
      "merge-sorted-array",
      "Easy",
      "The merge step on its own."
     ],
     [
      21,
      "Merge Two Sorted Lists",
      "merge-two-sorted-lists",
      "Easy",
      "The merge step on linked lists."
     ],
     [
      148,
      "Sort List",
      "sort-list",
      "Medium",
      "Merge sort a linked list in Θ(n log n)."
     ],
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Full merge sort."
     ],
     [
      23,
      "Merge k Sorted Lists",
      "merge-k-sorted-lists",
      "Hard",
      "The merge step, generalised from two lists to k."
     ],
     [
      493,
      "Reverse Pairs",
      "reverse-pairs",
      "Hard",
      "Count during the merge step, when both halves are sorted."
     ]
    ]
   },
   "quick": {
    "label": "Quick sort",
    "items": [
     [
      75,
      "Sort Colors",
      "sort-colors",
      "Medium",
      "A three-way partition."
     ],
     [
      215,
      "Kth Largest Element in an Array",
      "kth-largest-element-in-an-array",
      "Medium",
      "Quickselect: partition, then recurse into one side only."
     ],
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Randomise the pivot, or sorted input will time out."
     ],
     [
      973,
      "K Closest Points to Origin",
      "k-closest-points-to-origin",
      "Medium",
      "Quickselect: partition once, recurse into one side only."
     ]
    ]
   },
   "twothird": {
    "label": "Two-third sort",
    "note": "Two-third sort (stooge sort) is a recurrence exercise, not something LeetCode asks for. Practise the recursion and the analysis instead.",
    "items": [
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Watch it time out: Θ(n<sup>log<sub>3/2</sub> 3</sup>) is slower than bubble sort."
     ],
     [
      509,
      "Fibonacci Number",
      "fibonacci-number",
      "Easy",
      "Another recursion whose running time comes from a recurrence."
     ]
    ]
   },
   "counting": {
    "label": "Counting sort",
    "items": [
     [
      75,
      "Sort Colors",
      "sort-colors",
      "Medium",
      "Keys 0, 1, 2: count them."
     ],
     [
      1122,
      "Relative Sort Array",
      "relative-sort-array",
      "Easy",
      "Counting with a custom order."
     ],
     [
      1051,
      "Height Checker",
      "height-checker",
      "Easy",
      "Small key range, so counting sort is Θ(n + k)."
     ],
     [
      389,
      "Find the Difference",
      "find-the-difference",
      "Easy",
      "Count 26 letters: a counting array instead of a sort."
     ],
     [
      274,
      "H-Index",
      "h-index",
      "Medium",
      "Bucket the citation counts, then scan from the top."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    barsEl = q("bars");
    const tabs = q("algo-tabs");
    ORDER.forEach((id) => {
      tabs.appendChild(D.el("button", { text: ALGO[id].label, "data-id": id, onclick: () => selectAlgo(id) }));
    });
    q("size").addEventListener("input", (e) => { q("size-out").textContent = e.target.value; });
    q("size").addEventListener("change", (e) => newArray(+e.target.value, q("kind").value));
    q("kind").addEventListener("change", () => newArray(+q("size").value, q("kind").value));
    if (q("view")) q("view").addEventListener("change", (e) => { viewPref = e.target.value; drawViews(player.frames[player.index] || {}, player.index, player.frames); });
    q("btn-new").addEventListener("click", () => newArray(+q("size").value, q("kind").value));
    q("btn-run").addEventListener("click", run);
    q("btn-load").addEventListener("click", () => {
      const v = D.parseNums(q("custom").value).slice(0, 60);
      if (v.length < 2) { D.toast("Enter at least two numbers (negative and decimal values are fine).", true); return; }
      if (ALGO[cur].kRange && kOf(v) > MAX_K) { D.toast("Counting sort would need " + (kOf(v) + 1) + " counters (one per key from min to max), too many to draw. Keep max − min ≤ " + MAX_K + ".", true); return; }
      arr = v;
      q("size").value = Math.min(60, v.length);
      q("size-out").textContent = v.length;
      drawStatic();
      D.toast("Loaded " + v.length + " values.");
    });
    arr = D.randArray(20, 5, 99);
    selectAlgo("bubble");
    newArray(20, "random");
  });
})();
