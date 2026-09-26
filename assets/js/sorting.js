/* ============================================================
   sorting.js — eight sorting algorithms, frame by frame
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
        "static void bubbleSort(int[] a) {",
        "  for (int i = a.length - 1; i >= 1; i--) { @@outer",
        "    boolean swapped = false; @@reset",
        "    for (int j = 0; j < i; j++) { @@inner",
        "      if (a[j] > a[j + 1]) { @@cmp",
        "        int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; @@swap",
        "        swapped = true; @@swap",
        "      }",
        "    }",
        "    if (!swapped) break; @@exit",
        "  }",
        "}",
      ],
      cpp: [
        "void bubbleSort(vector<int>& a) {",
        "  for (int i = (int)a.size() - 1; i >= 1; i--) { @@outer",
        "    bool swapped = false; @@reset",
        "    for (int j = 0; j < i; j++) { @@inner",
        "      if (a[j] > a[j + 1]) { @@cmp",
        "        swap(a[j], a[j + 1]); @@swap",
        "        swapped = true; @@swap",
        "      }",
        "    }",
        "    if (!swapped) break; @@exit",
        "  }",
        "}",
      ],
      python: [
        "def bubble_sort(a):",
        "  for i in range(len(a) - 1, 0, -1): @@outer",
        "    swapped = False @@reset",
        "    for j in range(i): @@inner",
        "      if a[j] > a[j + 1]: @@cmp",
        "        a[j], a[j + 1] = a[j + 1], a[j] @@swap",
        "        swapped = True @@swap",
        "    if not swapped: @@exit",
        "      break @@exit",
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
        "static void selectionSort(int[] a) {",
        "  for (int i = 0; i < a.length - 1; i++) { @@outer",
        "    int min = i; @@init",
        "    for (int j = i + 1; j < a.length; j++) @@inner",
        "      if (a[j] < a[min]) @@cmp",
        "        min = j; @@upd",
        "    if (min != i) { int t = a[i]; a[i] = a[min]; a[min] = t; } @@swap",
        "  }",
        "}",
      ],
      cpp: [
        "void selectionSort(vector<int>& a) {",
        "  for (int i = 0; i + 1 < (int)a.size(); i++) { @@outer",
        "    int min = i; @@init",
        "    for (int j = i + 1; j < (int)a.size(); j++) @@inner",
        "      if (a[j] < a[min]) @@cmp",
        "        min = j; @@upd",
        "    if (min != i) swap(a[i], a[min]); @@swap",
        "  }",
        "}",
      ],
      python: [
        "def selection_sort(a):",
        "  for i in range(len(a) - 1): @@outer",
        "    m = i @@init",
        "    for j in range(i + 1, len(a)): @@inner",
        "      if a[j] < a[m]: @@cmp",
        "        m = j @@upd",
        "    if m != i: @@swap",
        "      a[i], a[m] = a[m], a[i] @@swap",
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
        "static void insertionSort(int[] a) {",
        "  for (int i = 1; i < a.length; i++) { @@outer",
        "    int key = a[i], j = i - 1; @@key",
        "    while (j >= 0 && a[j] > key) { @@cmp",
        "      a[j + 1] = a[j];      // shift right @@shift",
        "      j--; @@shift",
        "    }",
        "    a[j + 1] = key;         // drop it in @@drop",
        "  }",
        "}",
      ],
      cpp: [
        "void insertionSort(vector<int>& a) {",
        "  for (int i = 1; i < (int)a.size(); i++) { @@outer",
        "    int key = a[i], j = i - 1; @@key",
        "    while (j >= 0 && a[j] > key) { @@cmp",
        "      a[j + 1] = a[j];      // shift right @@shift",
        "      j--; @@shift",
        "    }",
        "    a[j + 1] = key;         // drop it in @@drop",
        "  }",
        "}",
      ],
      python: [
        "def insertion_sort(a):",
        "  for i in range(1, len(a)): @@outer",
        "    key, j = a[i], i - 1 @@key",
        "    while j >= 0 and a[j] > key: @@cmp",
        "      a[j + 1] = a[j]       # shift right @@shift",
        "      j -= 1 @@shift",
        "    a[j + 1] = key          # drop it in @@drop",
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
        "static void heapSort(int[] a) {",
        "  for (int i = a.length / 2 - 1; i >= 0; i--) @@build",
        "    downHeap(a, i, a.length); @@bcall",
        "  for (int end = a.length - 1; end >= 1; end--) { @@extract",
        "    int t = a[0]; a[0] = a[end]; a[end] = t; @@eswap",
        "    downHeap(a, 0, end); @@ecall",
        "  }",
        "}",
        "",
        "static void downHeap(int[] a, int i, int size) {",
        "  while (2 * i + 1 < size) { @@dloop",
        "    int c = 2 * i + 1; @@child",
        "    if (c + 1 < size && a[c + 1] > a[c]) c++; @@child",
        "    if (a[i] >= a[c]) break; @@dcmp",
        "    int t = a[i]; a[i] = a[c]; a[c] = t; @@dswap",
        "    i = c; @@dswap",
        "  }",
        "}",
      ],
      cpp: [
        "void heapSort(vector<int>& a) {",
        "  for (int i = (int)a.size() / 2 - 1; i >= 0; i--) @@build",
        "    downHeap(a, i, a.size()); @@bcall",
        "  for (int end = (int)a.size() - 1; end >= 1; end--) { @@extract",
        "    swap(a[0], a[end]); @@eswap",
        "    downHeap(a, 0, end); @@ecall",
        "  }",
        "}",
        "",
        "void downHeap(vector<int>& a, int i, int size) {",
        "  while (2 * i + 1 < size) { @@dloop",
        "    int c = 2 * i + 1; @@child",
        "    if (c + 1 < size && a[c + 1] > a[c]) c++; @@child",
        "    if (a[i] >= a[c]) break; @@dcmp",
        "    swap(a[i], a[c]); @@dswap",
        "    i = c; @@dswap",
        "  }",
        "}",
      ],
      python: [
        "def heap_sort(a):",
        "  for i in range(len(a) // 2 - 1, -1, -1): @@build",
        "    down_heap(a, i, len(a)) @@bcall",
        "  for end in range(len(a) - 1, 0, -1): @@extract",
        "    a[0], a[end] = a[end], a[0] @@eswap",
        "    down_heap(a, 0, end) @@ecall",
        "",
        "def down_heap(a, i, size):",
        "  while 2 * i + 1 < size: @@dloop",
        "    c = 2 * i + 1 @@child",
        "    if c + 1 < size and a[c + 1] > a[c]: @@child",
        "      c += 1 @@child",
        "    if a[i] >= a[c]: @@dcmp",
        "      break @@dcmp",
        "    a[i], a[c] = a[c], a[i] @@dswap",
        "    i = c @@dswap",
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
        "static void mergeSort(int[] a, int lo, int hi) { @@fn",
        "  if (lo >= hi) return; @@base",
        "  int mid = (lo + hi) / 2; @@mid",
        "  mergeSort(a, lo, mid); @@rec1",
        "  mergeSort(a, mid + 1, hi); @@rec2",
        "  merge(a, lo, mid, hi); @@mcall",
        "}",
        "",
        "static void merge(int[] a, int lo, int mid, int hi) {",
        "  int[] L = Arrays.copyOfRange(a, lo, mid + 1); @@copy",
        "  int[] R = Arrays.copyOfRange(a, mid + 1, hi + 1); @@copy",
        "  int i = 0, j = 0, k = lo; @@copy",
        "  while (i < L.length && j < R.length) @@take",
        "    a[k++] = (L[i] <= R[j]) ? L[i++] : R[j++]; @@take",
        "  while (i < L.length) a[k++] = L[i++]; @@rest",
        "  while (j < R.length) a[k++] = R[j++]; @@rest",
        "}",
      ],
      cpp: [
        "void mergeSort(vector<int>& a, int lo, int hi) { @@fn",
        "  if (lo >= hi) return; @@base",
        "  int mid = (lo + hi) / 2; @@mid",
        "  mergeSort(a, lo, mid); @@rec1",
        "  mergeSort(a, mid + 1, hi); @@rec2",
        "  merge(a, lo, mid, hi); @@mcall",
        "}",
        "",
        "void merge(vector<int>& a, int lo, int mid, int hi) {",
        "  vector<int> L(a.begin() + lo, a.begin() + mid + 1); @@copy",
        "  vector<int> R(a.begin() + mid + 1, a.begin() + hi + 1); @@copy",
        "  int i = 0, j = 0, k = lo; @@copy",
        "  while (i < (int)L.size() && j < (int)R.size()) @@take",
        "    a[k++] = (L[i] <= R[j]) ? L[i++] : R[j++]; @@take",
        "  while (i < (int)L.size()) a[k++] = L[i++]; @@rest",
        "  while (j < (int)R.size()) a[k++] = R[j++]; @@rest",
        "}",
      ],
      python: [
        "def merge_sort(a, lo, hi): @@fn",
        "  if lo >= hi: @@base",
        "    return @@base",
        "  mid = (lo + hi) // 2 @@mid",
        "  merge_sort(a, lo, mid) @@rec1",
        "  merge_sort(a, mid + 1, hi) @@rec2",
        "  merge(a, lo, mid, hi) @@mcall",
        "",
        "def merge(a, lo, mid, hi):",
        "  L, R = a[lo:mid + 1], a[mid + 1:hi + 1] @@copy",
        "  i, j, k = 0, 0, lo @@copy",
        "  while i < len(L) and j < len(R): @@take",
        "    if L[i] <= R[j]: @@take",
        "      a[k], i = L[i], i + 1 @@take",
        "    else: @@take",
        "      a[k], j = R[j], j + 1 @@take",
        "    k += 1 @@take",
        "  a[k:hi + 1] = L[i:] + R[j:]        # whichever side is left @@rest",
      ],
    },

    quick: {
      pseudo: [
        "quickSort(A, lo, hi): @@fn",
        "  if lo ≥ hi: return @@base",
        "  p ← partition(A, lo, hi) @@part",
        "  quickSort(A, lo, p-1) @@rec1",
        "  quickSort(A, p+1, hi) @@rec2",
        "",
        "partition(A, lo, hi):                // Lomuto, pivot = A[hi]",
        "  pivot ← A[hi];  i ← lo @@pivot",
        "  for j ← lo to hi-1 @@ploop",
        "    if A[j] < pivot @@pcmp",
        "      swap A[i], A[j];  i ← i+1 @@pswap",
        "  swap A[i], A[hi]                   // pivot lands at i @@pfinal",
        "  return i @@pfinal",
      ],
      java: [
        "static void quickSort(int[] a, int lo, int hi) { @@fn",
        "  if (lo >= hi) return; @@base",
        "  int p = partition(a, lo, hi); @@part",
        "  quickSort(a, lo, p - 1); @@rec1",
        "  quickSort(a, p + 1, hi); @@rec2",
        "}",
        "",
        "static int partition(int[] a, int lo, int hi) {   // Lomuto",
        "  int pivot = a[hi], i = lo; @@pivot",
        "  for (int j = lo; j < hi; j++) @@ploop",
        "    if (a[j] < pivot) { @@pcmp",
        "      int t = a[i]; a[i] = a[j]; a[j] = t;  i++; @@pswap",
        "    }",
        "  int t = a[i]; a[i] = a[hi]; a[hi] = t;   // pivot to i @@pfinal",
        "  return i; @@pfinal",
        "}",
      ],
      cpp: [
        "void quickSort(vector<int>& a, int lo, int hi) { @@fn",
        "  if (lo >= hi) return; @@base",
        "  int p = partition(a, lo, hi); @@part",
        "  quickSort(a, lo, p - 1); @@rec1",
        "  quickSort(a, p + 1, hi); @@rec2",
        "}",
        "",
        "int partition(vector<int>& a, int lo, int hi) {   // Lomuto",
        "  int pivot = a[hi], i = lo; @@pivot",
        "  for (int j = lo; j < hi; j++) @@ploop",
        "    if (a[j] < pivot) { @@pcmp",
        "      swap(a[i], a[j]);  i++; @@pswap",
        "    }",
        "  swap(a[i], a[hi]);                // pivot lands at i @@pfinal",
        "  return i; @@pfinal",
        "}",
      ],
      python: [
        "def quick_sort(a, lo, hi): @@fn",
        "  if lo >= hi: @@base",
        "    return @@base",
        "  p = partition(a, lo, hi) @@part",
        "  quick_sort(a, lo, p - 1) @@rec1",
        "  quick_sort(a, p + 1, hi) @@rec2",
        "",
        "def partition(a, lo, hi):           # Lomuto, pivot = a[hi]",
        "  pivot, i = a[hi], lo @@pivot",
        "  for j in range(lo, hi): @@ploop",
        "    if a[j] < pivot: @@pcmp",
        "      a[i], a[j] = a[j], a[i] @@pswap",
        "      i += 1 @@pswap",
        "  a[i], a[hi] = a[hi], a[i]         # pivot lands at i @@pfinal",
        "  return i @@pfinal",
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
        "static void twoThirdSort(int[] a, int i, int j) { @@fn",
        "  if (a[i] > a[j]) { int tmp = a[i]; a[i] = a[j]; a[j] = tmp; } @@ends",
        "  if (j - i + 1 > 2) { @@size",
        "    int t = (j - i + 1) / 3; @@t",
        "    twoThirdSort(a, i,     j - t);   // first 2/3 @@r1",
        "    twoThirdSort(a, i + t, j    );   // last  2/3 @@r2",
        "    twoThirdSort(a, i,     j - t);   // first 2/3 again @@r3",
        "  }",
        "}",
      ],
      cpp: [
        "void twoThirdSort(vector<int>& a, int i, int j) { @@fn",
        "  if (a[i] > a[j]) swap(a[i], a[j]); @@ends",
        "  if (j - i + 1 > 2) { @@size",
        "    int t = (j - i + 1) / 3; @@t",
        "    twoThirdSort(a, i,     j - t);   // first 2/3 @@r1",
        "    twoThirdSort(a, i + t, j    );   // last  2/3 @@r2",
        "    twoThirdSort(a, i,     j - t);   // first 2/3 again @@r3",
        "  }",
        "}",
      ],
      python: [
        "def two_third_sort(a, i, j): @@fn",
        "  if a[i] > a[j]: @@ends",
        "    a[i], a[j] = a[j], a[i] @@ends",
        "  if j - i + 1 > 2: @@size",
        "    t = (j - i + 1) // 3 @@t",
        "    two_third_sort(a, i,     j - t)   # first 2/3 @@r1",
        "    two_third_sort(a, i + t, j    )   # last  2/3 @@r2",
        "    two_third_sort(a, i,     j - t)   # first 2/3 again @@r3",
      ],
    },

    counting: {
      pseudo: [
        "countingSort(A, k):                  // keys in 0..k",
        "  C ← array of k+1 zeros;  B ← array of n slots @@alloc",
        "  for each x in A:  C[x] ← C[x] + 1   // count @@count",
        "  for v ← 1 to k:   C[v] ← C[v] + C[v-1]   // prefix sums @@prefix",
        "  for idx ← n-1 down to 0            // right to left keeps it stable @@place",
        "    C[A[idx]] ← C[A[idx]] - 1 @@put",
        "    B[C[A[idx]]] ← A[idx] @@put",
        "  copy B back into A @@back",
      ],
      java: [
        "static void countingSort(int[] a, int k) {",
        "  int[] C = new int[k + 1]; @@alloc",
        "  int[] B = new int[a.length]; @@alloc",
        "  for (int x : a) C[x]++; @@count",
        "  for (int v = 1; v <= k; v++) C[v] += C[v - 1]; @@prefix",
        "  for (int idx = a.length - 1; idx >= 0; idx--) { @@place",
        "    C[a[idx]]--; @@put",
        "    B[C[a[idx]]] = a[idx]; @@put",
        "  }",
        "  System.arraycopy(B, 0, a, 0, a.length); @@back",
        "}",
      ],
      cpp: [
        "void countingSort(vector<int>& a, int k) {",
        "  vector<int> C(k + 1, 0); @@alloc",
        "  vector<int> B(a.size()); @@alloc",
        "  for (int x : a) C[x]++; @@count",
        "  for (int v = 1; v <= k; v++) C[v] += C[v - 1]; @@prefix",
        "  for (int idx = (int)a.size() - 1; idx >= 0; idx--) { @@place",
        "    C[a[idx]]--; @@put",
        "    B[C[a[idx]]] = a[idx]; @@put",
        "  }",
        "  a = B; @@back",
        "}",
      ],
      python: [
        "def counting_sort(a, k):",
        "  C = [0] * (k + 1) @@alloc",
        "  B = [0] * len(a) @@alloc",
        "  for x in a: @@count",
        "    C[x] += 1 @@count",
        "  for v in range(1, k + 1): @@prefix",
        "    C[v] += C[v - 1] @@prefix",
        "  for idx in range(len(a) - 1, -1, -1): @@place",
        "    C[a[idx]] -= 1 @@put",
        "    B[C[a[idx]]] = a[idx] @@put",
        "  a[:] = B @@back",
      ],
    },
  };

  /* ---------- algorithms ---------- */
  const ALGO = {};

  ALGO.bubble = {
    label: "Bubble Sort",
    code: CODE.bubble,
    big: ["best Ω(n)", "avg Θ(n²)", "worst O(n²)", "space O(1)", "stable"],
    blurb:
      "Repeatedly walk the array swapping out-of-order neighbours. After pass <em>i</em> the largest <em>i</em> " +
      "values have bubbled to the back, so the pass gets shorter each time. If a whole pass makes no swap the array " +
      "is already sorted and we stop early — that is the best case Ω(n).",
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
          s.snap({}, "exit", "The inner loop is done and swapped is still false: no pair was out of order, so the array is sorted. <b>break</b>.");
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
    big: ["best Ω(n²)", "avg Θ(n²)", "worst O(n²)", "space O(1)", "not stable"],
    blurb:
      "Scan the unsorted tail for its minimum, then swap that minimum into the front of the tail. " +
      "It always does exactly n(n-1)/2 comparisons, but at most n-1 swaps — the fewest of any of the quadratic " +
      "sorts, which is why it is a decent choice when moving records is expensive.",
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
    big: ["best Ω(n)", "avg Θ(n²)", "worst O(n²)", "space O(1)", "stable"],
    blurb:
      "Grow a sorted prefix one element at a time: lift out A[i] as the <em>key</em>, shift every larger value in the " +
      "prefix one slot right, then drop the key into the gap. Nearly-sorted input barely shifts anything, so this is " +
      "the fastest of the simple sorts in practice and is what real libraries use for small subarrays.",
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
    big: ["best Ω(n log n)", "avg Θ(n log n)", "worst O(n log n)", "space O(1)", "not stable"],
    blurb:
      "Two phases. First turn the whole array into a max-heap from the bottom up in O(n). Then repeatedly swap the " +
      "root (the maximum) with the last heap slot, shrink the heap by one, and sift the new root down. The array " +
      "splits into a heap at the front and a growing sorted suffix at the back — no extra memory at all.",
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
    code: CODE.merge,
    big: ["best Ω(n log n)", "avg Θ(n log n)", "worst O(n log n)", "space O(n)", "stable"],
    blurb:
      "Split in half, sort each half recursively, then merge the two sorted halves by repeatedly taking the smaller " +
      "front element. The merge needs a scratch buffer, which is the O(n) extra space. Because ties take from the " +
      "left buffer first, merge sort is stable — and its O(n log n) bound holds on every input.",
    run(a, s) {
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
      const ms = (lo, hi, depth) => {
        if (s.stop()) return;
        s.snap(rangeMarks(lo, hi), "fn", "mergeSort(A, " + lo + ", " + hi + ") at depth " + depth + ".");
        if (lo >= hi) {
          s.snap(lo === hi ? { [lo]: "done" } : {}, "base", lo === hi ? "One element is already sorted: return." : "Empty range: return.");
          return;
        }
        const mid = Math.floor((lo + hi) / 2);
        s.snap(rangeMarks(lo, hi), "mid", "mid = ⌊(" + lo + " + " + hi + ")/2⌋ = " + mid + ".");
        s.snap(rangeMarks(lo, mid), "rec1", "Sort the left half A[" + lo + "…" + mid + "].");
        ms(lo, mid, depth + 1);
        s.snap(rangeMarks(mid + 1, hi), "rec2", "Back in mergeSort(A, " + lo + ", " + hi + "). Now sort the right half A[" + (mid + 1) + "…" + hi + "].");
        ms(mid + 1, hi, depth + 1);
        s.snap(rangeMarks(lo, hi), "mcall", "Both halves are sorted. Merge them.");
        merge(lo, mid, hi);
        s.snap(rangeMarks(lo, hi, "done"), "mcall", "merge returned: A[" + lo + "…" + hi + "] is sorted.");
      };
      ms(0, a.length - 1, 0);
      for (let k = 0; k < a.length; k++) s.done.add(k);
      s.snap({}, null, "Sorted.");
    },
  };

  ALGO.quick = {
    label: "Quick Sort",
    code: CODE.quick,
    big: ["best Ω(n log n)", "avg Θ(n log n)", "worst O(n²)", "space O(log n)", "not stable"],
    blurb:
      "Pick a pivot, partition the range so everything smaller sits left of it and everything larger sits right, " +
      "then recurse on the two sides. This version uses Lomuto partitioning with the last element as pivot: " +
      "<span class='mono'>i</span> marks the boundary of the &lt;-pivot region and <span class='mono'>j</span> " +
      "scans. Already-sorted input makes every partition maximally lopsided — that is the O(n²) worst case.",
    run(a, s) {
      const rangeMarks = (lo, hi) => { const m = {}; for (let t = lo; t <= hi; t++) m[t] = "range"; return m; };
      const part = (lo, hi) => {
        const pivot = a[hi];
        let i = lo;
        s.snap(Object.assign(rangeMarks(lo, hi), { [hi]: "pivot" }), "pivot", "partition: pivot ← A[" + hi + "] = " + pivot + ", i ← " + lo + ".");
        for (let j = lo; j < hi; j++) {
          s.cmp++;
          const less = a[j] < pivot;
          s.snap(Object.assign(rangeMarks(lo, hi), { [hi]: "pivot", [j]: "cmp", [i]: "active" }), ["ploop", "pcmp"], "j = " + j + ": is A[" + j + "] = " + a[j] + " &lt; pivot " + pivot + "? " + (less ? "<b>Yes</b>." : "No."));
          if (less) {
            if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; s.mov += 2; }
            s.snap(Object.assign(rangeMarks(lo, hi), { [hi]: "pivot", [i]: "swap", [j]: "swap" }), "pswap", i !== j
              ? "Swap A[" + i + "] and A[" + j + "] to grow the &lt;-pivot region, then i ← " + (i + 1) + "."
              : "i = j, so the swap changes nothing. i ← " + (i + 1) + ".");
            i++;
          }
        }
        [a[i], a[hi]] = [a[hi], a[i]];
        s.mov += 2;
        s.done.add(i);
        s.snap(Object.assign(rangeMarks(lo, hi), { [i]: "done" }), "pfinal", "Swap the pivot into A[" + i + "]. Everything left of it is smaller and everything right is ≥, so " + pivot + " is final. Return " + i + ".");
        return i;
      };
      const qs = (lo, hi) => {
        if (s.stop()) return;
        s.snap(lo <= hi ? rangeMarks(lo, hi) : {}, "fn", "quickSort(A, " + lo + ", " + hi + ").");
        if (lo >= hi) {
          if (lo === hi) s.done.add(lo);
          s.snap(lo === hi ? { [lo]: "done" } : {}, "base", lo === hi ? "A[" + lo + "] is a single element: return." : "Empty range: return.");
          return;
        }
        s.snap(rangeMarks(lo, hi), "part", "Partition A[" + lo + "…" + hi + "] around the pivot A[" + hi + "].");
        const p = part(lo, hi);
        s.snap(p - 1 >= lo ? rangeMarks(lo, p - 1) : {}, "rec1", "partition returned p = " + p + ". Sort the left part A[" + lo + "…" + (p - 1) + "].");
        qs(lo, p - 1);
        s.snap(p + 1 <= hi ? rangeMarks(p + 1, hi) : {}, "rec2", "Back in quickSort(A, " + lo + ", " + hi + "). Sort the right part A[" + (p + 1) + "…" + hi + "].");
        qs(p + 1, hi);
      };
      qs(0, a.length - 1);
      for (let k = 0; k < a.length; k++) s.done.add(k);
      s.snap({}, null, "Sorted.");
    },
  };

  ALGO.twothird = {
    label: "Two-Third Sort",
    code: CODE.twothird,
    big: ["Θ(n^2.71)", "space O(log n)", "not stable"],
    blurb:
      "A deliberately terrible sort that is great for practising recurrences. Swap the two ends if needed, then sort " +
      "the first two-thirds, the last two-thirds, and the first two-thirds <em>again</em>. The final repeat is what " +
      "makes it correct: the second call may push large values into the last third, so the first two-thirds must be " +
      "re-sorted. Three calls on 2n/3 elements gives T(n) = 3T(2n/3) + O(1) = " +
      "Θ(n<sup>log<sub>1.5</sub>3</sup>) ≈ Θ(n<sup>2.71</sup>).",
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
    big: ["Θ(n + k)", "space O(n + k)", "stable", "not comparison-based"],
    blurb:
      "No comparisons at all. Count how many times each key 0..k occurs, turn those counts into running totals " +
      "(so C[v] is where the block of v's ends), then walk the input from the right placing each element at " +
      "C[key]-1. Linear in n + k — brilliant for small key ranges, useless when k is huge. Walking right-to-left " +
      "is what makes it stable.",
    kRange: true,
    run(a, s) {
      const n = a.length, k = Math.max.apply(null, a);
      const C = new Array(k + 1).fill(0);
      const B = new Array(n).fill(null);
      const rows = (cm, bm) => [
        { label: "C (counts, index = key)", arr: C, marks: cm || {}, showIndex: true },
        { label: "B (output)", arr: B, marks: bm || {} },
      ];
      s.snap({}, "alloc", "Keys range over 0…" + k + ", so C gets " + (k + 1) + " zeros and B gets " + n + " empty slots.", { rows: rows() });
      for (let i = 0; i < n; i++) {
        C[a[i]]++;
        s.mov++;
        s.snap({ [i]: "active" }, "count", "x = A[" + i + "] = " + a[i] + ": C[" + a[i] + "] becomes " + C[a[i]] + ".", { rows: rows({ [a[i]]: "swap" }) });
      }
      for (let v = 1; v <= k; v++) {
        C[v] += C[v - 1];
        s.snap({}, "prefix", "v = " + v + ": C[" + v + "] += C[" + (v - 1) + "] → " + C[v] + ". That many keys are ≤ " + v + ".", { rows: rows({ [v]: "swap", [v - 1]: "cmp" }) });
      }
      for (let i = n - 1; i >= 0; i--) {
        const key = a[i];
        C[key]--;
        B[C[key]] = key;
        s.mov++;
        s.snap({ [i]: "active" }, ["place", "put"], "idx = " + i + ": A[" + i + "] = " + key + ". C[" + key + "] drops to " + C[key] + ", so B[" + C[key] + "] ← " + key + ".", { rows: rows({ [key]: "cmp" }, { [C[key]]: "swap" }) });
      }
      for (let i = 0; i < n; i++) { a[i] = B[i]; s.done.add(i); }
      s.snap({}, "back", "Copy B back into A.", { rows: rows({}, allMarks(n, "done")) });
      s.snap({}, null, "Sorted with zero comparisons, in Θ(n + k) = Θ(" + n + " + " + k + ").", { rows: rows() });
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
    barsEl.classList.toggle("labeled", len <= 32);
  }

  function cellsRow(row, max) {
    const wrap = D.el("div", { style: "margin-top:1rem" });
    wrap.appendChild(D.el("div", { class: "small muted", text: row.label, style: "margin-bottom:.15rem" }));
    const cells = D.el("div", { class: "cells" });
    row.arr.forEach((v, i) => {
      const c = D.el("div", { class: "cell " + (row.marks[i] || "") + (v == null ? " empty" : " filled"), text: v == null ? "·" : v });
      if (row.showIndex !== false) c.appendChild(D.el("span", { class: "idx", text: i }));
      cells.appendChild(c);
    });
    wrap.appendChild(cells);
    return wrap;
  }

  const LISTINGS = {};
  Object.keys(ALGO).forEach((id) => (LISTINGS[id] = Object.assign({ title: ALGO[id].label }, ALGO[id].code)));
  const M = (t) => "<span class='mono'>" + t + "</span>";
  const HI = { pseudo: "n − 1", java: "a.length - 1", cpp: "(int)a.size() - 1", python: "len(a) - 1" };
  const sortSpec = (does, cost, extra) => Object.assign({ does: does, params: M("A") + " — the array to sort (changed in place)", returns: "nothing — A ends up in ascending order", errors: "none", cost: cost }, extra || {});
  D.specs(LISTINGS, {
    bubble: sortSpec("Repeatedly swaps neighbours that are out of order; stops early after a pass with no swaps.", "O(n²) worst/average, O(n) on sorted input · O(1) space · stable"),
    selection: sortSpec("Repeatedly selects the minimum of the unsorted part and swaps it into place.", "Θ(n²) always, but at most n − 1 swaps · O(1) space · not stable"),
    insertion: sortSpec("Grows a sorted prefix, shifting larger values right to drop each new key into place.", "O(n²) worst, O(n) on nearly sorted input · O(1) space · stable"),
    heap: sortSpec("Builds a max-heap in the array, then repeatedly swaps the maximum to the end and repairs the heap.", "O(n log n) always · O(1) space · not stable"),
    merge: sortSpec("Splits the range in half, sorts each half recursively, then merges the two sorted halves.", "Θ(n log n) always · O(n) extra space · stable", { params: M("A") + " — the array · " + M("lo") + ", " + M("hi") + " — the range to sort (call with 0 and n − 1)", callVals: { lo: "0", hi: HI } }),
    quick: sortSpec("Partitions around a pivot (Lomuto: the last element), then sorts both sides recursively.", "O(n log n) average, O(n²) worst (sorted input with this pivot) · O(log n) stack · not stable", { params: M("A") + " — the array · " + M("lo") + ", " + M("hi") + " — the range to sort (call with 0 and n − 1)", callVals: { lo: "0", hi: HI } }),
    twothird: sortSpec("Sorts the first two-thirds, the last two-thirds, then the first two-thirds again — correct, but famously slow.", "Θ(n^2.71) — a recurrence exercise, not a practical sort", { params: M("A") + " — the array · " + M("i") + ", " + M("j") + " — the range (call with 0 and n − 1)", callVals: { i: "0", j: HI } }),
    counting: sortSpec("Counts how many times each key occurs, turns the counts into positions, then places every key directly — no comparisons.", "Θ(n + k) time and space · stable", { params: M("A") + " — keys in 0…k · " + M("k") + " — the largest key", callVals: { k: "9" } }),
  });
  const dock = D.CodeDock("#code", LISTINGS);
  const player = new D.Player({
    mount: "#player",
    code: dock,
    render(f) {
      if (!f.arr) return;
      if (barsEl.children.length !== f.arr.length) buildBars(f.arr.length);
      const max = Math.max(1, Math.max.apply(null, f.arr));
      for (let i = 0; i < f.arr.length; i++) {
        const b = barsEl.children[i];
        b.className = "bar " + (f.marks && f.marks[i] ? f.marks[i] : "");
        b.style.height = Math.max(2, (f.arr[i] / max) * 100) + "%";
        b.firstChild.textContent = f.arr.length <= 32 ? f.arr[i] : "";
      }
      /* heap-sort boundary */
      const hb = q("heapline");
      if (f.heapSize != null && f.arr.length) {
        hb.style.display = "block";
        hb.textContent = "heap region: A[0…" + Math.max(0, f.heapSize - 1) + "]   sorted suffix: A[" + f.heapSize + "…" + (f.arr.length - 1) + "]";
      } else hb.style.display = "none";

      q("rows").innerHTML = "";
      (f.rows || []).forEach((r) => q("rows").appendChild(cellsRow(r)));

      q("s-cmp").textContent = f.cmp == null ? "–" : f.cmp;
      q("s-mov").textContent = f.mov == null ? "–" : f.mov;
    },
  });

  function drawStatic() {
    player.load([{ arr: arr.slice(), marks: {}, cmp: 0, mov: 0, code: cur, note: "Array loaded — press <b>Run</b> (or Play) to sort it." }], false);
  }

  function selectAlgo(id) {
    cur = id;
    const A = ALGO[id];
    q("algo-name").textContent = A.label;
    q("algo-blurb").innerHTML = A.blurb;
    q("algo-big").innerHTML = A.big.map((b) => "<span>" + b + "</span>").join("");
    dock.show(id);
    D.practiceShow(id);
    D.$$("#algo-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
    if (A.maxN && arr.length > A.maxN) {
      newArray(A.maxN, "random");
      D.toast(A.label + " explodes combinatorially — trimmed to " + A.maxN + " elements.");
      return;
    }
    if (A.kRange) { regenForCounting(); return; }
    drawStatic();
  }

  function regenForCounting() {
    const maxV = 9;
    if (Math.max.apply(null, arr) > 20) {
      arr = arr.map(() => D.randInt(0, maxV));
      q("custom").value = arr.join(", ");
      D.toast("Counting sort needs a small key range — regenerated with keys 0–9.");
    }
    drawStatic();
  }

  function newArray(n, kind) {
    n = D.clamp(n, 3, 60);
    const A = ALGO[cur];
    if (A.maxN) n = Math.min(n, A.maxN);
    const hi = A.kRange ? 9 : 99, lo = A.kRange ? 0 : 5;
    if (kind === "sorted") arr = Array.from({ length: n }, (_, i) => lo + Math.round((i * (hi - lo)) / (n - 1)));
    else if (kind === "reverse") arr = Array.from({ length: n }, (_, i) => hi - Math.round((i * (hi - lo)) / (n - 1)));
    else if (kind === "nearly") {
      arr = Array.from({ length: n }, (_, i) => lo + Math.round((i * (hi - lo)) / (n - 1)));
      for (let s = 0; s < Math.max(1, Math.round(n / 8)); s++) {
        const i = D.randInt(0, n - 2);
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      }
    } else if (kind === "few") arr = Array.from({ length: n }, () => [lo, Math.round((lo + hi) / 2), hi][D.randInt(0, 2)]);
    else arr = D.randArray(n, lo, hi);
    q("size").value = n;
    q("size-out").textContent = n;
    q("custom").value = arr.join(", ");
    drawStatic();
  }

  function run() {
    const A = ALGO[cur];
    const a = arr.slice();
    if (!a.length) { D.toast("Nothing to sort.", true); return; }
    const R = new D.Recorder(9000);
    const s = {
      cmp: 0, mov: 0, done: new Set(),
      stop: () => R.overflow,
      snap(marks, line, note, extra) {
        const m = {};
        this.done.forEach((i) => (m[i] = "done"));
        Object.assign(m, marks || {});
        R.push(Object.assign({ arr: a.slice(), marks: m, code: cur, line: line, note: note, cmp: this.cmp, mov: this.mov }, extra || {}));
      },
    };
    s.snap({}, null, "Start <b>" + A.label + "</b> on " + a.length + " elements.");
    A.run(a, s);
    if (R.overflow) D.toast("Step limit reached — try a smaller array.", true);
    q("s-frames").textContent = R.frames.length;
    arr = a.slice();
    q("custom").value = arr.join(", ");
    player.load(R.frames, true);
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
      "Try bubble sort — it times out, which is the lesson."
     ],
     [
      283,
      "Move Zeroes",
      "move-zeroes",
      "Easy",
      "Stable in-place movement of elements."
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
      "Heap sort passes in O(n log n) with O(1) space."
     ],
     [
      215,
      "Kth Largest Element in an Array",
      "kth-largest-element-in-an-array",
      "Medium",
      "Stop heap sort after k extractions."
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
      "Merge sort a linked list in O(n log n)."
     ],
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Full merge sort."
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
      "Watch it time out — Θ(n^2.71) is slower than bubble sort."
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
    q("btn-new").addEventListener("click", () => newArray(+q("size").value, q("kind").value));
    q("btn-run").addEventListener("click", run);
    q("btn-load").addEventListener("click", () => {
      const v = D.parseNums(q("custom").value).filter((x) => x >= 0).slice(0, 60);
      if (v.length < 2) { D.toast("Enter at least two non-negative numbers.", true); return; }
      arr = v;
      q("size").value = Math.min(60, v.length);
      q("size-out").textContent = v.length;
      drawStatic();
      D.toast("Loaded " + v.length + " values.");
    });
    D.legend("#legend", [
      { color: "var(--c-idle)", label: "unsorted" },
      { color: "#5d6ea3", label: "active subarray" },
      { color: "var(--c-cmp)", label: "comparing" },
      { color: "var(--c-swap)", label: "moving / writing" },
      { color: "var(--c-active)", label: "cursor" },
      { color: "var(--c-pivot)", label: "pivot" },
      { color: "var(--c-target)", label: "current min" },
      { color: "var(--c-done)", label: "final position" },
    ]);
    const ex = (algo, n, kind, why) => () => {
      selectAlgo(algo);
      q("kind").value = kind;
      newArray(n, kind);
      run();
      if (why) D.toast(why);
    };
    D.Examples("#examples", [
      { label: "bubble sort exits early on sorted input", run: ex("bubble", 8, "sorted", "One pass, no swaps, done: Ω(n).") },
      { label: "insertion sort on nearly sorted", run: ex("insertion", 12, "nearly", "Only a few shifts: close to linear.") },
      { label: "quick sort's worst case: sorted input", run: ex("quick", 10, "sorted", "Last-element pivot on sorted input gives Θ(n²).") },
      { label: "merge sort on 8 elements", run: ex("merge", 8, "random") },
      { label: "heap sort on reversed input", run: ex("heap", 10, "reverse") },
      { label: "counting sort with few distinct keys", run: ex("counting", 12, "few") },
    ]);
    arr = D.randArray(20, 5, 99);
    selectAlgo("bubble");
    newArray(20, "random");
  });
})();
