/* ============================================================
   recursion.js — call stack + recursion tree for eight
   recursive functions. Each function is written normally and
   just reports what it is doing to a tracer `t`.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const q = (id) => D.$("#" + id);

  /* =======================================================
     tracer
     ======================================================= */
  function Tracer(limit) {
    this.nodes = [];        /* {id, parent, label, depth, children, ret} */
    this.frames = [];
    this.stack = [];        /* ids, innermost last */
    this.limit = limit || 1200;
    this.calls = 0;
    this.maxDepth = 0;
    this.returns = 0;
    this.view = null;       /* optional side view carried into frames */
    this.line = null;       /* pseudocode line the trace is sitting on */
  }
  /** Point the code panel at pseudocode line n for the frames that follow. */
  Tracer.prototype.at = function (n) { this.line = n; return this; };
  Tracer.prototype._states = function () {
    const s = {};
    this.nodes.forEach((n) => (s[n.id] = n.ret === undefined ? "open" : "done"));
    this.stack.forEach((id) => (s[id] = "open"));
    if (this.stack.length) s[this.stack[this.stack.length - 1]] = "active";
    return s;
  };
  Tracer.prototype.frame = function (note, extra) {
    if (this.frames.length >= this.limit) { this.over = true; return; }
    this.frames.push(
      Object.assign(
        {
          created: this.nodes.length,
          states: this._states(),
          stack: this.stack.slice(),
          cur: this.stack.length ? this.stack[this.stack.length - 1] : null,
          calls: this.calls,
          depth: this.stack.length,
          maxDepth: this.maxDepth,
          returns: this.returns,
          note: note,
          line: this.line,
          view: this.view ? JSON.parse(JSON.stringify(this.view)) : null,
        },
        extra || {}
      )
    );
  };
  Tracer.prototype.enter = function (label, note) {
    const parent = this.stack.length ? this.stack[this.stack.length - 1] : null;
    const n = { id: this.nodes.length, parent: parent, label: label, depth: this.stack.length, children: [], ret: undefined };
    this.nodes.push(n);
    if (parent !== null) this.nodes[parent].children.push(n);
    this.stack.push(n.id);
    this.calls++;
    this.maxDepth = Math.max(this.maxDepth, this.stack.length);
    this.frame(
      note ||
        "<b>Call " + label + "</b> — a new frame is pushed onto the call stack (depth " + this.stack.length + ")."
    );
    return n.id;
  };
  Tracer.prototype.step = function (note, extra) { this.frame(note, extra); };
  Tracer.prototype.exit = function (id, val, note) {
    this.nodes[id].ret = val;
    this.returns++;
    this.frame(note || "<b>" + this.nodes[id].label + " returns " + fmt(val) + "</b> — its frame is popped and control goes back to the caller.");
    this.stack.pop();
    return val;
  };
  const fmt = (v) => (Array.isArray(v) ? "[" + v.join(", ") + "]" : String(v));

  /* =======================================================
     the recursive functions
     ======================================================= */
  const FN = {};

  FN.factorial = {
    label: "factorial(n)",
    inputs: [{ id: "n", label: "n", value: 5, min: 0, max: 9 }],
    big: ["T(n) = T(n−1) + O(1)", "Θ(n) time", "Θ(n) stack"],
    blurb:
      "The simplest shape of recursion: one call per level, so the tree is a straight chain and the stack grows to " +
      "depth n. Notice that nothing is computed on the way <em>down</em> — every multiplication happens as the " +
      "frames pop back up.",
    code: {
      pseudo: ["factorial(n): @@fn", "  if n ≤ 1: return 1           // base case @@base", "  return n · factorial(n-1)    // recursive case @@rec"],
      java: ["static int factorial(int n) { @@fn", "  if (n <= 1) return 1;          // base case @@base", "  return n * factorial(n - 1);   // recursive case @@rec", "}"],
      cpp: ["int factorial(int n) { @@fn", "  if (n <= 1) return 1;          // base case @@base", "  return n * factorial(n - 1);   // recursive case @@rec", "}"],
      python: ["def factorial(n): @@fn", "  if n <= 1: @@base", "    return 1                     # base case @@base", "  return n * factorial(n - 1)    # recursive case @@rec"],
    },
    run(t, args) {
      (function f(n) {
        const id = t.at("fn").enter("factorial(" + n + ")");
        if (n <= 1) return t.at("base").exit(id, 1, "n = " + n + " ≤ 1: <b>base case</b>. Return 1 without recursing. Without this the recursion would never stop.");
        t.at("base^").step("n = " + n + " &gt; 1: not the base case.");
        t.at("rec").step("Evaluate n · factorial(" + (n - 1) + "). This frame has to <em>wait</em> for factorial(" + (n - 1) + ") to return first.");
        const sub = f(n - 1);
        return t.at("rec").exit(id, n * sub, "Back in factorial(" + n + "): factorial(" + (n - 1) + ") returned " + sub + ", so return " + n + " · " + sub + " = <b>" + n * sub + "</b>.");
      })(args.n);
    },
  };

  FN.fib = {
    label: "fib(n) — naive",
    inputs: [{ id: "n", label: "n", value: 5, min: 0, max: 8 }],
    big: ["T(n) = T(n−1) + T(n−2) + O(1)", "Θ(φⁿ) ≈ Θ(1.618ⁿ)", "Θ(n) stack"],
    blurb:
      "Two recursive calls per level make the tree branch, and the same subproblems get solved over and over — " +
      "count how many times <span class='mono'>fib(2)</span> appears. That duplication is what makes naive Fibonacci " +
      "exponential, and it is exactly what memoisation kills.",
    code: {
      pseudo: ["fib(n): @@fn", "  if n ≤ 1: return n @@base", "  return fib(n-1) + fib(n-2) @@rec"],
      java: ["static int fib(int n) { @@fn", "  if (n <= 1) return n; @@base", "  return fib(n - 1) + fib(n - 2); @@rec", "}"],
      cpp: ["int fib(int n) { @@fn", "  if (n <= 1) return n; @@base", "  return fib(n - 1) + fib(n - 2); @@rec", "}"],
      python: ["def fib(n): @@fn", "  if n <= 1: @@base", "    return n @@base", "  return fib(n - 1) + fib(n - 2) @@rec"],
    },
    run(t, args) {
      (function f(n) {
        const id = t.at("fn").enter("fib(" + n + ")");
        if (n <= 1) return t.at("base").exit(id, n, "n = " + n + " ≤ 1: <b>base case</b>, return " + n + ".");
        t.at("base^").step("n = " + n + " &gt; 1: not the base case.");
        t.at("rec").step("Evaluate fib(" + (n - 1) + ") + fib(" + (n - 2) + "). The left call runs <em>completely</em> first (depth-first).");
        const a = f(n - 1);
        t.at("rec").step("Back in fib(" + n + "): fib(" + (n - 1) + ") = " + a + ". Now the right call, fib(" + (n - 2) + ").");
        const b = f(n - 2);
        return t.at("rec").exit(id, a + b, "Back in fib(" + n + "): return " + a + " + " + b + " = <b>" + (a + b) + "</b>.");
      })(args.n);
    },
  };

  FN.fibmemo = {
    label: "fib(n) — memoised",
    inputs: [{ id: "n", label: "n", value: 8, min: 0, max: 14 }],
    big: ["Θ(n) time", "Θ(n) space", "top-down DP"],
    blurb:
      "Same code, plus a table of answers already computed. Each value of n is genuinely computed once; every later " +
      "request is a table lookup that returns without recursing. The exponential tree collapses into a path with " +
      "stubs — n distinct subproblems, O(1) work each, so Θ(n).",
    code: {
      pseudo: [
        "fib(n, memo): @@fn",
        "  if n in memo: return memo[n]          // hit @@hit",
        "  if n ≤ 1: memo[n] ← n;  return n @@base",
        "  v ← fib(n-1, memo) + fib(n-2, memo) @@rec",
        "  memo[n] ← v @@store",
        "  return v @@ret",
      ],
      java: [
        "static long fib(int n, Map<Integer, Long> memo) { @@fn",
        "  if (memo.containsKey(n)) return memo.get(n);   // hit @@hit",
        "  if (n <= 1) { memo.put(n, (long) n);  return n; } @@base",
        "  long v = fib(n - 1, memo) + fib(n - 2, memo); @@rec",
        "  memo.put(n, v); @@store",
        "  return v; @@ret",
        "}",
      ],
      cpp: [
        "long long fib(int n, unordered_map<int, long long>& memo) { @@fn",
        "  if (memo.count(n)) return memo[n];             // hit @@hit",
        "  if (n <= 1) return memo[n] = n; @@base",
        "  long long v = fib(n - 1, memo) + fib(n - 2, memo); @@rec",
        "  memo[n] = v; @@store",
        "  return v; @@ret",
        "}",
      ],
      python: [
        "def fib(n, memo): @@fn",
        "  if n in memo: @@hit",
        "    return memo[n]              # hit @@hit",
        "  if n <= 1: @@base",
        "    memo[n] = n @@base",
        "    return n @@base",
        "  v = fib(n - 1, memo) + fib(n - 2, memo) @@rec",
        "  memo[n] = v @@store",
        "  return v @@ret",
      ],
    },
    run(t, args) {
      const memo = {};
      t.view = { type: "memo", memo: memo, n: args.n };
      (function f(n) {
        const id = t.at("fn").enter("fib(" + n + ")");
        if (memo[n] !== undefined) return t.at("hit").exit(id, memo[n], "<b>Memo hit!</b> fib(" + n + ") = " + memo[n] + " was already computed. Return it without recursing: this subtree is pruned.");
        t.at("hit^").step("fib(" + n + ") is not in the memo yet.");
        if (n <= 1) { memo[n] = n; return t.at("base").exit(id, n, "n ≤ 1: base case. Store memo[" + n + "] = " + n + " and return it."); }
        t.at("base^").step("n = " + n + " &gt; 1: not the base case.");
        t.at("rec").step("Compute fib(" + (n - 1) + ") first, then fib(" + (n - 2) + ").");
        const a = f(n - 1);
        t.at("rec").step("Back in fib(" + n + "): fib(" + (n - 1) + ") = " + a + ". Now fib(" + (n - 2) + ")" + (memo[n - 2] !== undefined ? ", which is already in the memo." : "."));
        const b = f(n - 2);
        memo[n] = a + b;
        t.at("store").step("v = " + a + " + " + b + " = " + (a + b) + ". Store <b>memo[" + n + "] = " + (a + b) + "</b> so nobody recomputes it.");
        return t.at("ret").exit(id, memo[n], "Return " + memo[n] + ".");
      })(args.n);
    },
  };

  FN.gcd = {
    label: "gcd(a, b) — Euclid",
    inputs: [
      { id: "a", label: "a", value: 84, min: 1, max: 999 },
      { id: "b", label: "b", value: 30, min: 0, max: 999 },
    ],
    big: ["O(log min(a,b))", "tail recursive"],
    blurb:
      "Euclid's insight: any common divisor of a and b also divides a mod b, so gcd(a, b) = gcd(b, a mod b). The " +
      "numbers shrink fast — each two steps at least halve the smaller one — so the depth is logarithmic. It is also " +
      "<em>tail recursive</em>: the recursive call is the whole return expression, so a compiler can turn it into a loop " +
      "with no stack growth at all.",
    code: {
      pseudo: ["gcd(a, b): @@fn", "  if b == 0: return a          // base case @@base", "  return gcd(b, a mod b)       // tail call @@rec"],
      java: ["static int gcd(int a, int b) { @@fn", "  if (b == 0) return a;        // base case @@base", "  return gcd(b, a % b);        // tail call @@rec", "}"],
      cpp: ["int gcd(int a, int b) { @@fn", "  if (b == 0) return a;        // base case @@base", "  return gcd(b, a % b);        // tail call @@rec", "}"],
      python: ["def gcd(a, b): @@fn", "  if b == 0: @@base", "    return a                   # base case @@base", "  return gcd(b, a % b)         # tail call @@rec"],
    },
    run(t, args) {
      (function g(a, b) {
        const id = t.at("fn").enter("gcd(" + a + ", " + b + ")");
        if (b === 0) return t.at("base").exit(id, a, "b = 0: <b>base case</b>, return a = " + a + ". Every caller above just passes this value straight back up.");
        t.at("base^").step("b = " + b + " ≠ 0: not the base case.");
        t.at("rec").step("a mod b = " + a + " mod " + b + " = " + (a % b) + ", so call gcd(" + b + ", " + (a % b) + ").");
        const r = g(b, a % b);
        return t.at("rec").exit(id, r, "gcd(" + b + ", " + (a % b) + ") returned " + r + ". Nothing else to do here, so return it unchanged.");
      })(args.a, args.b);
    },
  };

  FN.power = {
    label: "power(x, n) — fast",
    inputs: [
      { id: "x", label: "x", value: 3, min: 2, max: 9 },
      { id: "n", label: "n", value: 13, min: 0, max: 40 },
    ],
    big: ["T(n) = T(n/2) + O(1)", "Θ(log n)"],
    blurb:
      "Exponentiation by squaring. Instead of n multiplications, halve the exponent each step: x<sup>n</sup> = " +
      "(x<sup>n/2</sup>)² for even n, and x·(x<sup>⌊n/2⌋</sup>)² for odd n. Halving gives depth log₂n — the same " +
      "recurrence as binary search.",
    code: {
      pseudo: ["power(x, n): @@fn", "  if n == 0: return 1 @@base", "  half ← power(x, ⌊n/2⌋) @@half", "  r ← half · half @@sq", "  if n is odd: r ← r · x @@odd", "  return r @@ret"],
      java: ["static long power(long x, int n) { @@fn", "  if (n == 0) return 1; @@base", "  long half = power(x, n / 2); @@half", "  long r = half * half; @@sq", "  if (n % 2 == 1) r *= x; @@odd", "  return r; @@ret", "}"],
      cpp: ["long long power(long long x, int n) { @@fn", "  if (n == 0) return 1; @@base", "  long long half = power(x, n / 2); @@half", "  long long r = half * half; @@sq", "  if (n % 2 == 1) r *= x; @@odd", "  return r; @@ret", "}"],
      python: ["def power(x, n): @@fn", "  if n == 0: @@base", "    return 1 @@base", "  half = power(x, n // 2) @@half", "  r = half * half @@sq", "  if n % 2 == 1: @@odd", "    r *= x @@odd", "  return r @@ret"],
    },
    run(t, args) {
      (function p(x, n) {
        const id = t.at("fn").enter("power(" + x + ", " + n + ")");
        if (n === 0) return t.at("base").exit(id, 1, "n = 0: x⁰ = 1. Base case.");
        t.at("base^").step("n = " + n + " ≠ 0: not the base case.");
        t.at("half").step("Call power(" + x + ", ⌊" + n + "/2⌋) = power(" + x + ", " + Math.floor(n / 2) + ").");
        const h = p(x, Math.floor(n / 2));
        let r = h * h;
        t.at("sq").step("half = " + h + ", so r = half · half = " + r + ".");
        if (n % 2) { r *= x; t.at("odd").step("n = " + n + " is odd, so one more factor of x: r = " + r + "."); }
        else t.at("odd^").step("n = " + n + " is even: no extra factor.");
        return t.at("ret").exit(id, r, "Return " + r + ".");
      })(args.x, args.n);
    },
  };

  FN.hanoi = {
    label: "Towers of Hanoi",
    inputs: [{ id: "n", label: "disks", value: 3, min: 1, max: 5 }],
    big: ["T(n) = 2T(n−1) + 1", "Θ(2ⁿ) moves", "exactly 2ⁿ − 1"],
    blurb:
      "The classic \"trust the recursion\" problem. To move n disks from A to C: move the top n−1 out of the way onto B, " +
      "move the single biggest disk to C, then move those n−1 from B onto C. You never have to think about how the " +
      "n−1 sub-tower gets moved — that is the recursive call's job. Two calls per level gives exactly 2ⁿ−1 moves.",
    code: {
      pseudo: ["hanoi(n, from, to, via): @@fn", "  if n == 0: return @@base", "  hanoi(n-1, from, via, to)     // clear the way @@r1", "  move disk n: from → to @@move", "  hanoi(n-1, via, to, from)     // pile back on @@r2"],
      java: [
        "static void hanoi(int n, char from, char to, char via) { @@fn",
        "  if (n == 0) return; @@base",
        "  hanoi(n - 1, from, via, to);   // clear the way @@r1",
        "  System.out.println(from + \" -> \" + to); @@move",
        "  hanoi(n - 1, via, to, from);   // pile back on @@r2",
        "}",
      ],
      cpp: [
        "void hanoi(int n, char from, char to, char via) { @@fn",
        "  if (n == 0) return; @@base",
        "  hanoi(n - 1, from, via, to);   // clear the way @@r1",
        "  cout << from << \" -> \" << to << endl; @@move",
        "  hanoi(n - 1, via, to, from);   // pile back on @@r2",
        "}",
      ],
      python: [
        "def hanoi(n, src, dst, via): @@fn",
        "  if n == 0: @@base",
        "    return @@base",
        "  hanoi(n - 1, src, via, dst)    # clear the way @@r1",
        "  print(src, '->', dst) @@move",
        "  hanoi(n - 1, via, dst, src)    # pile back on @@r2",
      ],
    },
    run(t, args) {
      const n = args.n;
      const pegs = { A: [], B: [], C: [] };
      for (let d = n; d >= 1; d--) pegs.A.push(d);
      t.view = { type: "pegs", pegs: pegs, n: n, moves: 0 };
      let moves = 0;
      (function h(k, from, to, via) {
        const id = t.at("fn").enter("hanoi(" + k + ", " + from + "→" + to + ")");
        if (k === 0) return t.at("base").exit(id, "—", "Zero disks to move: nothing to do. Base case.");
        t.at("r1").step("To move " + k + " disk(s) " + from + "→" + to + ", first move the top " + (k - 1) + " onto the spare peg " + via + ".");
        h(k - 1, from, via, to);
        const d = pegs[from].pop();
        pegs[to].push(d);
        moves++;
        t.view.moves = moves;
        t.at("move").step("<b>Move disk " + d + ": " + from + " → " + to + "</b> (move #" + moves + ").");
        t.at("r2").step("Now move the " + (k - 1) + " disk(s) from " + via + " onto " + to + ", on top of disk " + d + ".");
        h(k - 1, via, to, from);
        return t.at("r2").exit(id, "done", "All " + k + " disk(s) are on " + to + ": hanoi(" + k + ", " + from + "→" + to + ") returns.");
      })(n, "A", "C", "B");
      t.at(null).step("Finished in <b>" + moves + " moves</b> = 2<sup>" + n + "</sup> − 1. That is provably optimal.");
    },
  };

  FN.bsearch = {
    label: "binarySearch(A, target)",
    inputs: [{ id: "target", label: "target", value: 47, min: -999, max: 999 }],
    big: ["T(n) = T(n/2) + O(1)", "Θ(log n)"],
    blurb:
      "Halving recursion on a <em>sorted</em> array. Compare the target with the middle element: if it is smaller the " +
      "answer can only be in the left half, if larger only in the right half. Each call throws away half of what is " +
      "left, so 2<sup>k</sup> ≥ n gives at most ⌈log₂n⌉ + 1 comparisons.",
    code: {
      pseudo: [
        "binarySearch(A, target, lo, hi): @@fn",
        "  if lo > hi: return -1             // empty range @@empty",
        "  mid ← ⌊(lo + hi) / 2⌋ @@mid",
        "  if A[mid] == target: return mid @@found",
        "  if target < A[mid]: @@left",
        "    return binarySearch(A, target, lo, mid-1) @@left",
        "  else: @@right",
        "    return binarySearch(A, target, mid+1, hi) @@right",
      ],
      java: [
        "static int binarySearch(int[] a, int target, int lo, int hi) { @@fn",
        "  if (lo > hi) return -1;              // empty range @@empty",
        "  int mid = (lo + hi) / 2; @@mid",
        "  if (a[mid] == target) return mid; @@found",
        "  if (target < a[mid]) @@left",
        "    return binarySearch(a, target, lo, mid - 1); @@left",
        "  else @@right",
        "    return binarySearch(a, target, mid + 1, hi); @@right",
        "}",
      ],
      cpp: [
        "int binarySearch(const vector<int>& a, int target, int lo, int hi) { @@fn",
        "  if (lo > hi) return -1;              // empty range @@empty",
        "  int mid = (lo + hi) / 2; @@mid",
        "  if (a[mid] == target) return mid; @@found",
        "  if (target < a[mid]) @@left",
        "    return binarySearch(a, target, lo, mid - 1); @@left",
        "  else @@right",
        "    return binarySearch(a, target, mid + 1, hi); @@right",
        "}",
      ],
      python: [
        "def binary_search(a, target, lo, hi): @@fn",
        "  if lo > hi: @@empty",
        "    return -1                      # empty range @@empty",
        "  mid = (lo + hi) // 2 @@mid",
        "  if a[mid] == target: @@found",
        "    return mid @@found",
        "  if target < a[mid]: @@left",
        "    return binary_search(a, target, lo, mid - 1) @@left",
        "  else: @@right",
        "    return binary_search(a, target, mid + 1, hi) @@right",
      ],
    },
    arrayInput: true,
    run(t, args) {
      const A = args.arr, target = args.target;
      t.view = { type: "array", arr: A, lo: 0, hi: A.length - 1, mid: null, target: target };
      (function bs(lo, hi) {
        const id = t.at("fn").enter("bSearch(" + lo + ", " + hi + ")");
        t.view.lo = lo; t.view.hi = hi; t.view.mid = null;
        if (lo > hi) return t.at("empty").exit(id, -1, "lo = " + lo + " &gt; hi = " + hi + ": the range is empty, so return <b>−1</b>. " + target + " is not in the array.");
        t.at("empty^").step("lo = " + lo + " ≤ hi = " + hi + ": " + (hi - lo + 1) + " candidate(s) left.");
        const mid = Math.floor((lo + hi) / 2);
        t.view.mid = mid;
        t.at("mid").step("mid = ⌊(" + lo + " + " + hi + ")/2⌋ = " + mid + ", and A[mid] = " + A[mid] + ".");
        if (A[mid] === target) return t.at("found").exit(id, mid, "A[" + mid + "] == " + target + ": <b>found at index " + mid + "</b>.");
        t.at("found^").step("A[" + mid + "] = " + A[mid] + " ≠ " + target + ".");
        if (target < A[mid]) {
          t.at("left").step(target + " &lt; " + A[mid] + ". The array is sorted, so everything from mid rightwards is too big. Search A[" + lo + "…" + (mid - 1) + "].");
          const r = bs(lo, mid - 1);
          return t.at("left").exit(id, r, "The recursive call returned " + r + "; pass it straight back up.");
        }
        t.at("right").step(target + " &gt; " + A[mid] + ", so everything from mid leftwards is too small. Search A[" + (mid + 1) + "…" + hi + "].");
        const r = bs(mid + 1, hi);
        return t.at("right").exit(id, r, "The recursive call returned " + r + "; pass it straight back up.");
      })(0, A.length - 1);
    },
  };

  FN.perms = {
    label: "permutations(s)",
    inputs: [],
    stringInput: { id: "str", label: "string", value: "ABC", max: 4 },
    big: ["n! leaves", "Θ(n · n!)"],
    blurb:
      "Backtracking: at each level choose one of the remaining characters, recurse on what is left, then undo the " +
      "choice and try the next one. The tree has n choices at the root, n−1 below that, and so on — n! leaves, each " +
      "one a complete permutation.",
    code: {
      pseudo: [
        "permute(chosen, rest): @@fn",
        "  if rest is empty: @@leaf",
        "    output chosen                    // a leaf @@leaf",
        "    return @@leaf",
        "  for each character c in rest: @@loop",
        "    permute(chosen + c, rest minus c) @@call",
      ],
      java: [
        "static void permute(String chosen, String rest) { @@fn",
        "  if (rest.isEmpty()) { @@leaf",
        "    System.out.println(chosen);          // a leaf @@leaf",
        "    return; @@leaf",
        "  }",
        "  for (int i = 0; i < rest.length(); i++) @@loop",
        "    permute(chosen + rest.charAt(i), @@call",
        "            rest.substring(0, i) + rest.substring(i + 1)); @@call",
        "}",
      ],
      cpp: [
        "void permute(string chosen, string rest) { @@fn",
        "  if (rest.empty()) { @@leaf",
        "    cout << chosen << endl;              // a leaf @@leaf",
        "    return; @@leaf",
        "  }",
        "  for (int i = 0; i < (int)rest.size(); i++) @@loop",
        "    permute(chosen + rest[i], @@call",
        "            rest.substr(0, i) + rest.substr(i + 1)); @@call",
        "}",
      ],
      python: [
        "def permute(chosen, rest): @@fn",
        "  if not rest: @@leaf",
        "    print(chosen)                        # a leaf @@leaf",
        "    return @@leaf",
        "  for i, c in enumerate(rest): @@loop",
        "    permute(chosen + c, rest[:i] + rest[i + 1:]) @@call",
      ],
    },
    run(t, args) {
      const out = [];
      t.view = { type: "list", label: "permutations found", items: out };
      (function p(chosen, rest) {
        const id = t.at("fn").enter("permute(\"" + chosen + "\", \"" + rest + "\")");
        if (!rest.length) {
          out.push(chosen);
          return t.at("leaf").exit(id, chosen, "rest is empty: this is a <b>leaf</b>. Output \"" + chosen + "\" (#" + out.length + ") and return.");
        }
        for (let i = 0; i < rest.length; i++) {
          t.at("loop").step("c = " + rest[i] + (i ? " (next option)" : " (first of " + rest.length + " options)") + ".");
          t.at("call").step("Recurse with chosen = \"" + chosen + rest[i] + "\", rest = \"" + (rest.slice(0, i) + rest.slice(i + 1)) + "\".");
          p(chosen + rest[i], rest.slice(0, i) + rest.slice(i + 1));
        }
        return t.at("loop").exit(id, out.length + " found", "The loop has tried every character, so permute(\"" + chosen + "\", \"" + rest + "\") returns. Its caller moves on to its next choice, which is the “undo” step of backtracking.");
      })("", args.str);
    },
  };

  /* =======================================================
     ITERATIVE VERSIONS — the same answers without recursion.
     Each records frames through an iteration tracer `it`.
     ======================================================= */
  function It(limit) {
    this.frames = [];
    this.vars = {};
    this.last = {};
    this.iters = 0;
    this.mem = 0;
    this.peak = 0;
    this.rows = [];
    this.view = null;
    this.line = null;
    this.limit = limit || 1600;
  }
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  It.prototype.at = function (l) { this.line = l; return this; };
  It.prototype.set = function (o) { Object.assign(this.vars, o); return this; };
  It.prototype.useMem = function (m) { this.mem = m; this.peak = Math.max(this.peak, m); return this; };
  It.prototype.row = function () { this.iters++; this.rows.push(Object.assign({ "#": this.iters }, clone(this.vars))); return this; };
  It.prototype.step = function (note) {
    if (this.frames.length >= this.limit) { this.over = true; return; }
    const changed = Object.keys(this.vars).filter((k) => JSON.stringify(this.vars[k]) !== JSON.stringify(this.last[k]));
    this.frames.push({
      kind: "iter", vars: clone(this.vars), changed: changed, iters: this.iters, mem: this.mem, peak: this.peak,
      rows: this.rows.slice(-8), rowCount: this.rows.length, view: clone(this.view), line: this.line, note: note,
    });
    this.last = clone(this.vars);
  };
  const big = (v) => (Math.abs(v) >= 1e15 ? v.toExponential(3) : String(v));

  const ITER = {
    factorial: {
      code: {
        title: "factorialIter(n) — a loop",
        pseudo: ["factorialIter(n):", "  result ← 1 @@init", "  for i ← 2 to n: @@loop", "    result ← result · i @@mul", "  return result            // no call stack: O(1) space @@ret"],
        java: ["static long factorialIter(int n) {", "  long result = 1; @@init", "  for (int i = 2; i <= n; i++) @@loop", "    result *= i; @@mul", "  return result; @@ret", "}"],
        cpp: ["long long factorialIter(int n) {", "  long long result = 1; @@init", "  for (int i = 2; i <= n; i++) @@loop", "    result *= i; @@mul", "  return result; @@ret", "}"],
        python: ["def factorial_iter(n):", "  result = 1 @@init", "  for i in range(2, n + 1): @@loop", "    result *= i @@mul", "  return result @@ret"],
      },
      run(it, a) {
        let r = 1;
        it.useMem(2).set({ n: a.n, result: r }).at("init").step("result = 1. Instead of waiting for sub-calls, we build the product upwards from 1.");
        for (let i = 2; i <= a.n; i++) {
          it.set({ i: i }).at("loop").step("i = " + i + ".");
          r *= i;
          it.set({ result: r }).row().at("mul").step("result = " + (r / i) + " · " + i + " = <b>" + r + "</b>.");
        }
        it.at("ret").step("Return <b>" + r + "</b>. Only two variables were ever used: <b>O(1)</b> extra space, compared with " + Math.max(1, a.n) + " stack frames for the recursive version.");
      },
    },
    fib: {
      code: {
        title: "fibIter(n) — two variables",
        pseudo: ["fibIter(n):", "  if n ≤ 1: return n @@base", "  a ← 0;  b ← 1                // fib(0), fib(1) @@init", "  for i ← 2 to n: @@loop", "    a, b ← b, a + b             // slide the window forward @@step", "  return b @@ret"],
        java: ["static int fibIter(int n) {", "  if (n <= 1) return n; @@base", "  int a = 0, b = 1; @@init", "  for (int i = 2; i <= n; i++) { @@loop", "    int t = a + b;  a = b;  b = t; @@step", "  }", "  return b; @@ret", "}"],
        cpp: ["int fibIter(int n) {", "  if (n <= 1) return n; @@base", "  int a = 0, b = 1; @@init", "  for (int i = 2; i <= n; i++) { @@loop", "    int t = a + b;  a = b;  b = t; @@step", "  }", "  return b; @@ret", "}"],
        python: ["def fib_iter(n):", "  if n <= 1: @@base", "    return n @@base", "  a, b = 0, 1 @@init", "  for i in range(2, n + 1): @@loop", "    a, b = b, a + b @@step", "  return b @@ret"],
      },
      run(it, x) {
        it.useMem(3).set({ n: x.n }).at("base^").step("Is n ≤ 1?");
        if (x.n <= 1) { it.at("base").step("Yes — return " + x.n + "."); return; }
        let a = 0, b = 1;
        it.set({ a: a, b: b }).at("init").step("a = fib(0) = 0, b = fib(1) = 1.");
        for (let i = 2; i <= x.n; i++) {
          it.set({ i: i }).at("loop").step("i = " + i + ".");
          [a, b] = [b, a + b];
          it.set({ a: a, b: b }).row().at("step").step("a ← " + a + ", b ← " + b + " = fib(" + i + "). Each Fibonacci number is computed <b>exactly once</b>.");
        }
        it.at("ret").step("Return <b>" + b + "</b> after " + (x.n - 1) + " loop steps: <b>Θ(n)</b> time, <b>O(1)</b> space. The naive recursion made about φⁿ calls.");
      },
    },
    fibmemo: {
      code: {
        title: "fibTable(n) — bottom-up DP",
        pseudo: ["fibTable(n):                   // bottom-up dynamic programming", "  if n ≤ 1: return n @@base", "  T ← new array[n+1];  T[0] ← 0;  T[1] ← 1 @@init", "  for i ← 2 to n: @@loop", "    T[i] ← T[i-1] + T[i-2]       // fill left to right @@fill", "  return T[n] @@ret"],
        java: ["static long fibTable(int n) {", "  if (n <= 1) return n; @@base", "  long[] t = new long[n + 1];  t[1] = 1; @@init", "  for (int i = 2; i <= n; i++) @@loop", "    t[i] = t[i - 1] + t[i - 2]; @@fill", "  return t[n]; @@ret", "}"],
        cpp: ["long long fibTable(int n) {", "  if (n <= 1) return n; @@base", "  vector<long long> t(n + 1);  t[1] = 1; @@init", "  for (int i = 2; i <= n; i++) @@loop", "    t[i] = t[i - 1] + t[i - 2]; @@fill", "  return t[n]; @@ret", "}"],
        python: ["def fib_table(n):", "  if n <= 1: @@base", "    return n @@base", "  t = [0] * (n + 1) @@init", "  t[1] = 1 @@init", "  for i in range(2, n + 1): @@loop", "    t[i] = t[i - 1] + t[i - 2] @@fill", "  return t[n] @@ret"],
      },
      run(it, x) {
        const T = {};
        it.view = { type: "memo", memo: T, n: x.n };
        it.set({ n: x.n }).at("base^").step("Is n ≤ 1?");
        if (x.n <= 1) { it.at("base").step("Yes — return " + x.n + "."); return; }
        T[0] = 0; T[1] = 1;
        it.useMem(x.n + 1).at("init").step("Allocate a table of " + (x.n + 1) + " cells; T[0] = 0, T[1] = 1.");
        for (let i = 2; i <= x.n; i++) {
          it.set({ i: i }).at("loop").step("i = " + i + ".");
          T[i] = T[i - 1] + T[i - 2];
          it.row().at("fill").step("T[" + i + "] = T[" + (i - 1) + "] + T[" + (i - 2) + "] = " + T[i - 1] + " + " + T[i - 2] + " = <b>" + T[i] + "</b>.");
        }
        it.at("ret").step("Return T[" + x.n + "] = <b>" + T[x.n] + "</b>. It fills the same table as the memoised recursion, but in order, with no calls and no stack.");
      },
    },
    gcd: {
      code: {
        title: "gcdIter(a, b) — a while loop",
        pseudo: ["gcdIter(a, b):", "  while b ≠ 0: @@loop", "    a, b ← b, a mod b @@step", "  return a @@ret"],
        java: ["static int gcdIter(int a, int b) {", "  while (b != 0) { @@loop", "    int r = a % b;  a = b;  b = r; @@step", "  }", "  return a; @@ret", "}"],
        cpp: ["int gcdIter(int a, int b) {", "  while (b != 0) { @@loop", "    int r = a % b;  a = b;  b = r; @@step", "  }", "  return a; @@ret", "}"],
        python: ["def gcd_iter(a, b):", "  while b != 0: @@loop", "    a, b = b, a % b @@step", "  return a @@ret"],
      },
      run(it, x) {
        let a = x.a, b = x.b;
        it.useMem(2).set({ a: a, b: b }).at("loop").step("Start with a = " + a + ", b = " + b + ".");
        while (b !== 0) {
          it.at("loop").step("b = " + b + " ≠ 0 — keep going.");
          [a, b] = [b, a % b];
          it.set({ a: a, b: b }).row().at("step").step("a ← " + a + ", b ← " + b + ". The same step the recursion takes, but it <em>replaces</em> the variables instead of pushing a new frame.");
        }
        it.at("loop").step("b = 0 — stop.");
        it.at("ret").step("Return <b>" + a + "</b>. The recursive gcd is <em>tail recursive</em>: nothing is left to do after the call returns. That is exactly the kind of recursion that turns mechanically into a loop.");
      },
    },
    power: {
      code: {
        title: "powerIter(x, n) — read n's bits",
        pseudo: ["powerIter(x, n):", "  result ← 1 @@init", "  while n > 0: @@loop", "    if n is odd: result ← result · x @@odd", "    x ← x · x;  n ← ⌊n / 2⌋        // next bit of n @@half", "  return result @@ret"],
        java: ["static long powerIter(long x, int n) {", "  long result = 1; @@init", "  while (n > 0) { @@loop", "    if (n % 2 == 1) result *= x; @@odd", "    x *= x;  n /= 2; @@half", "  }", "  return result; @@ret", "}"],
        cpp: ["long long powerIter(long long x, int n) {", "  long long result = 1; @@init", "  while (n > 0) { @@loop", "    if (n % 2 == 1) result *= x; @@odd", "    x *= x;  n /= 2; @@half", "  }", "  return result; @@ret", "}"],
        python: ["def power_iter(x, n):", "  result = 1 @@init", "  while n > 0: @@loop", "    if n % 2 == 1: @@odd", "      result *= x @@odd", "    x *= x @@half", "    n //= 2 @@half", "  return result @@ret"],
      },
      run(it, a) {
        let x = a.x, n = a.n, r = 1;
        it.useMem(3).set({ x: x, n: n, result: r }).at("init").step("result = 1. We will read n = " + n + " = " + n.toString(2) + "₂ one bit at a time, lowest bit first.");
        while (n > 0) {
          it.at("loop").step("n = " + n + " (" + n.toString(2) + "₂) &gt; 0.");
          if (n % 2) { r *= x; it.set({ result: big(r) }).at("odd").step("Lowest bit is 1, so multiply result by x = " + big(x) + " → result = " + big(r) + "."); }
          else it.at("odd^").step("Lowest bit is 0: skip.");
          x *= x; n = Math.floor(n / 2);
          it.set({ x: big(x), n: n }).row().at("half").step("Square x (now x<sup>2<sup>k</sup></sup> = " + big(x) + ") and shift n right to " + n + ".");
        }
        it.at("ret").step("Return <b>" + big(r) + "</b> after " + it.iters + " iterations, one per bit of n: <b>Θ(log n)</b>. The recursion halves n top-down; the loop reads the same bits bottom-up.");
      },
    },
    hanoi: {
      code: {
        title: "hanoiIter(n) — an explicit stack",
        pseudo: [
          "hanoiIter(n):                    // simulate the call stack yourself",
          "  S ← stack containing SOLVE(n, A→C via B) @@init",
          "  while S is not empty: @@loop",
          "    task ← S.pop() @@pop",
          "    if task is MOVE(from, to): move the top disk @@move",
          "    else if task is SOLVE(k, from→to via v) and k > 0: @@solve",
          "      S.push(SOLVE(k-1, v→to via from))   // pushed first, runs last @@push",
          "      S.push(MOVE(from, to)) @@push",
          "      S.push(SOLVE(k-1, from→v via to))   // pushed last, runs first @@push",
        ],
        java: [
          "static void hanoiIter(int n) {           // task = {k, from, to, via}; k = -1 means MOVE",
          "  Deque<int[]> st = new ArrayDeque<>(); @@init",
          "  st.push(new int[]{n, 'A', 'C', 'B'}); @@init",
          "  while (!st.isEmpty()) { @@loop",
          "    int[] t = st.pop(); @@pop",
          "    if (t[0] == -1) { move(t[1], t[2]);  continue; } @@move",
          "    if (t[0] > 0) { @@solve",
          "      st.push(new int[]{t[0] - 1, t[3], t[2], t[1]}); @@push",
          "      st.push(new int[]{-1, t[1], t[2], 0}); @@push",
          "      st.push(new int[]{t[0] - 1, t[1], t[3], t[2]}); @@push",
          "    }",
          "  }",
          "}",
        ],
        cpp: [
          "void hanoiIter(int n) {                  // task = {k, from, to, via}; k = -1 means MOVE",
          "  stack<array<int, 4>> st; @@init",
          "  st.push({n, 'A', 'C', 'B'}); @@init",
          "  while (!st.empty()) { @@loop",
          "    auto t = st.top();  st.pop(); @@pop",
          "    if (t[0] == -1) { move(t[1], t[2]);  continue; } @@move",
          "    if (t[0] > 0) { @@solve",
          "      st.push({t[0] - 1, t[3], t[2], t[1]}); @@push",
          "      st.push({-1, t[1], t[2], 0}); @@push",
          "      st.push({t[0] - 1, t[1], t[3], t[2]}); @@push",
          "    }",
          "  }",
          "}",
        ],
        python: [
          "def hanoi_iter(n):",
          "  st = [('SOLVE', n, 'A', 'C', 'B')] @@init",
          "  while st: @@loop",
          "    kind, k, frm, to, via = st.pop() @@pop",
          "    if kind == 'MOVE': @@move",
          "      move(frm, to) @@move",
          "    elif k > 0: @@solve",
          "      st.append(('SOLVE', k - 1, via, to, frm)) @@push",
          "      st.append(('MOVE', 0, frm, to, None)) @@push",
          "      st.append(('SOLVE', k - 1, frm, via, to)) @@push",
        ],
      },
      run(it, a) {
        const pegs = { A: [], B: [], C: [] };
        for (let d = a.n; d >= 1; d--) pegs.A.push(d);
        const st = [{ k: a.n, from: "A", to: "C", via: "B" }];
        const lab = (t) => (t.k < 0 ? "MOVE " + t.from + "→" + t.to : "SOLVE(" + t.k + ", " + t.from + "→" + t.to + ")");
        let moves = 0;
        it.view = { type: "pegs", pegs: pegs, n: a.n, moves: 0, tasks: st.map(lab) };
        it.useMem(1).set({ task: "—", "stack size": 1 }).at("init").step("Push the whole problem as one task. This stack plays the role of the call stack, but it is ours to see and control.");
        while (st.length) {
          it.at("loop").step("The stack holds " + st.length + " task(s).");
          const t = st.pop();
          it.view.tasks = st.map(lab);
          it.set({ task: lab(t), "stack size": st.length }).useMem(st.length).at("pop").step("Pop <b>" + lab(t) + "</b>.");
          if (t.k < 0) {
            const d = pegs[t.from].pop(); pegs[t.to].push(d); moves++;
            it.view.moves = moves;
            it.row().at("move").step("<b>Move disk " + d + ": " + t.from + " → " + t.to + "</b> (move #" + moves + ").");
            continue;
          }
          if (t.k === 0) { it.at("solve").step("k = 0, so the SOLVE branch is skipped: nothing to do. This is the recursion's base case."); continue; }
          it.at("solve").step("A SOLVE task with k = " + t.k + ": split it the same way the recursion does.");
          st.push({ k: t.k - 1, from: t.via, to: t.to, via: t.from });
          st.push({ k: -1, from: t.from, to: t.to });
          st.push({ k: t.k - 1, from: t.from, to: t.via, via: t.to });
          it.view.tasks = st.map(lab);
          it.set({ "stack size": st.length }).useMem(st.length).at("push").step("Push the three sub-tasks in <b>reverse</b> order, so the first one to run ends up on top.");
        }
        it.at("loop").step("Stack empty — done in <b>" + moves + " moves</b>. The same moves in the same order, and the same 2ⁿ − 1 cost. Recursion wasn't needed, only a stack, which is all recursion ever uses underneath.");
      },
    },
    bsearch: {
      code: {
        title: "binarySearchIter(A, target) — a loop",
        pseudo: ["binarySearchIter(A, target):", "  lo ← 0;  hi ← n - 1 @@init", "  while lo ≤ hi: @@loop", "    mid ← ⌊(lo + hi) / 2⌋ @@mid", "    if A[mid] == target: return mid @@found", "    if target < A[mid]: hi ← mid - 1 @@left", "    else: lo ← mid + 1 @@right", "  return -1 @@miss"],
        java: ["static int binarySearchIter(int[] a, int target) {", "  int lo = 0, hi = a.length - 1; @@init", "  while (lo <= hi) { @@loop", "    int mid = (lo + hi) / 2; @@mid", "    if (a[mid] == target) return mid; @@found", "    if (target < a[mid]) hi = mid - 1; @@left", "    else lo = mid + 1; @@right", "  }", "  return -1; @@miss", "}"],
        cpp: ["int binarySearchIter(const vector<int>& a, int target) {", "  int lo = 0, hi = (int)a.size() - 1; @@init", "  while (lo <= hi) { @@loop", "    int mid = (lo + hi) / 2; @@mid", "    if (a[mid] == target) return mid; @@found", "    if (target < a[mid]) hi = mid - 1; @@left", "    else lo = mid + 1; @@right", "  }", "  return -1; @@miss", "}"],
        python: ["def binary_search_iter(a, target):", "  lo, hi = 0, len(a) - 1 @@init", "  while lo <= hi: @@loop", "    mid = (lo + hi) // 2 @@mid", "    if a[mid] == target: @@found", "      return mid @@found", "    if target < a[mid]: @@left", "      hi = mid - 1 @@left", "    else: @@right", "      lo = mid + 1 @@right", "  return -1 @@miss"],
      },
      run(it, x) {
        const A = x.arr, t = x.target;
        let lo = 0, hi = A.length - 1;
        it.view = { type: "array", arr: A, lo: lo, hi: hi, mid: null, target: t };
        it.useMem(3).set({ lo: lo, hi: hi }).at("init").step("lo = 0, hi = " + hi + ".");
        while (lo <= hi) {
          it.at("loop").step("lo ≤ hi: " + (hi - lo + 1) + " candidate(s) left.");
          const mid = Math.floor((lo + hi) / 2);
          it.view.mid = mid;
          it.set({ mid: mid }).at("mid").step("mid = " + mid + ", A[mid] = " + A[mid] + ".");
          if (A[mid] === t) { it.row().at("found").step("Found <b>" + t + " at index " + mid + "</b>."); return; }
          it.at("found^").step(A[mid] + " ≠ " + t + ".");
          if (t < A[mid]) { hi = mid - 1; it.view.hi = hi; it.set({ hi: hi }).row().at("left").step(t + " &lt; " + A[mid] + ": hi ← " + hi + "."); }
          else { lo = mid + 1; it.view.lo = lo; it.set({ lo: lo }).row().at("right").step(t + " &gt; " + A[mid] + ": lo ← " + lo + "."); }
          it.view.mid = null;
        }
        it.at("miss").step("lo &gt; hi — return <b>−1</b>. Same Θ(log n) steps as the recursion, but O(1) space instead of Θ(log n) stack frames.");
      },
    },
    perms: {
      code: {
        title: "permutationsIter(s) — an explicit stack",
        pseudo: ["permutationsIter(s):", "  S ← stack containing (\"\", s) @@init", "  while S is not empty: @@loop", "    (chosen, rest) ← S.pop() @@pop", "    if rest is empty: output chosen;  continue @@out", "    for i ← length(rest)-1 down to 0:     // reversed, so i = 0 is popped first @@push", "      S.push((chosen + rest[i], rest without rest[i])) @@push"],
        java: [
          "static void permutationsIter(String s) {",
          "  Deque<String[]> st = new ArrayDeque<>(); @@init",
          "  st.push(new String[]{\"\", s}); @@init",
          "  while (!st.isEmpty()) { @@loop",
          "    String[] t = st.pop();  String chosen = t[0], rest = t[1]; @@pop",
          "    if (rest.isEmpty()) { System.out.println(chosen);  continue; } @@out",
          "    for (int i = rest.length() - 1; i >= 0; i--) @@push",
          "      st.push(new String[]{chosen + rest.charAt(i), rest.substring(0, i) + rest.substring(i + 1)}); @@push",
          "  }",
          "}",
        ],
        cpp: [
          "void permutationsIter(const string& s) {",
          "  stack<pair<string, string>> st; @@init",
          "  st.push({\"\", s}); @@init",
          "  while (!st.empty()) { @@loop",
          "    auto [chosen, rest] = st.top();  st.pop(); @@pop",
          "    if (rest.empty()) { cout << chosen << endl;  continue; } @@out",
          "    for (int i = (int)rest.size() - 1; i >= 0; i--) @@push",
          "      st.push({chosen + rest[i], rest.substr(0, i) + rest.substr(i + 1)}); @@push",
          "  }",
          "}",
        ],
        python: [
          "def permutations_iter(s):",
          "  st = [('', s)] @@init",
          "  while st: @@loop",
          "    chosen, rest = st.pop() @@pop",
          "    if not rest: @@out",
          "      print(chosen) @@out",
          "      continue @@out",
          "    for i in range(len(rest) - 1, -1, -1): @@push",
          "      st.append((chosen + rest[i], rest[:i] + rest[i + 1:])) @@push",
        ],
      },
      run(it, x) {
        const out = [], st = [["", x.str]];
        const lab = (t) => '("' + t[0] + '", "' + t[1] + '")';
        it.view = { type: "list", label: "permutations found", items: out, tasks: st.map(lab) };
        it.useMem(1).set({ chosen: "", rest: x.str, "stack size": 1 }).at("init").step("Push the starting state. Each stack entry is exactly what one recursive call's parameters would be.");
        while (st.length) {
          it.at("loop").step(st.length + " state(s) waiting.");
          const t = st.pop();
          it.view.tasks = st.map(lab);
          it.set({ chosen: t[0], rest: t[1], "stack size": st.length }).useMem(st.length).at("pop").step("Pop " + lab(t) + ".");
          if (!t[1].length) { out.push(t[0]); it.row().at("out").step("Nothing left to place, so output <b>\"" + t[0] + "\"</b> (#" + out.length + ")."); continue; }
          for (let i = t[1].length - 1; i >= 0; i--) st.push([t[0] + t[1][i], t[1].slice(0, i) + t[1].slice(i + 1)]);
          it.view.tasks = st.map(lab);
          it.set({ "stack size": st.length }).useMem(st.length).at("push").step("Push one child state per remaining character, in reverse so they pop in order.");
        }
        it.at("loop").step("Stack empty: all <b>" + out.length + "</b> permutations, in the same order as the recursion.");
      },
    },
  };

  /* =======================================================
     layout + rendering
     ======================================================= */
  let nodes = [], geom = { w: 400, h: 200, nw: 90 }, dock, dockL, dockR;

  function layout(ns) {
    if (!ns.length) return;
    let nw = 62;
    ns.forEach((n) => (nw = Math.max(nw, n.label.length * 7.1 + 14)));
    nw = Math.min(nw, 150);
    const gapX = nw + 14, gapY = 74;
    let leaf = 0, maxD = 0;
    (function walk(n) {
      maxD = Math.max(maxD, n.depth);
      if (!n.children.length) n._x = leaf++ * gapX + gapX / 2;
      else {
        n.children.forEach(walk);
        n._x = (n.children[0]._x + n.children[n.children.length - 1]._x) / 2;
      }
      n._y = 26 + n.depth * gapY;
    })(ns[0]);
    geom = { w: Math.max(340, leaf * gapX + 20), h: 26 + (maxD + 1) * gapY + 26, nw: nw };
  }

  function render(f) {
    if (f.L) return renderCompare(f);
    const host = q("main");
    host.innerHTML = "";
    if (f.kind === "iter") { host.appendChild(iterView(f)); D.stats("#stats", iterStats(f)); }
    else { host.appendChild(recView(f, false)); D.stats("#stats", recStats(f)); }
  }
  const recStats = (f) => [["calls made", f.calls], ["returns", f.returns], ["stack depth", f.depth], ["max depth (stack space)", f.maxDepth]];
  const iterStats = (f) => [["loop iterations", f.iters], ["extra memory now", f.mem + " cell(s)"], ["peak extra memory", f.peak + " cell(s)"]];

  function recView(f, compact) {
    const box = D.el("div");
    const row = D.el("div", { class: "row" });
    const left = D.el("div", { class: "col", style: "flex:0 1 " + (compact ? "220px" : "300px") });
    left.appendChild(D.el("div", { class: "cells-cap", html: "call stack <span class='mono'>(grows upward)</span>" }));
    const sc = D.el("div", { style: "min-height:120px" });
    if (!f.stack) sc.appendChild(D.el("p", { class: "small muted", text: "Press Run." }));
    else if (!f.stack.length) sc.appendChild(D.el("p", { class: "small muted", text: "The call stack is empty." }));
    else {
      const col = D.el("div", { style: "display:flex;flex-direction:column-reverse;gap:3px" });
      f.stack.forEach((id, k) => {
        const n = nodes[id];
        const top = k === f.stack.length - 1;
        const b = D.el("div", { class: "cell " + (top ? "active" : "visit") + " filled", style: "min-width:" + (compact ? 150 : 170) + "px;height:30px;font-size:.76rem;justify-content:flex-start;padding:0 .5rem", text: n.label });
        if (top) b.appendChild(D.el("span", { class: "ptr", style: "left:auto;right:-3.6rem;bottom:auto;top:50%;transform:translateY(-50%)", text: "← running" }));
        col.appendChild(b);
      });
      const holder = D.el("div", { style: "padding-right:3.8rem" });
      holder.appendChild(col);
      sc.appendChild(holder);
    }
    left.appendChild(sc);
    row.appendChild(left);

    const right = D.el("div", { class: "col", style: "flex:2 1 " + (compact ? "240px" : "460px") });
    right.appendChild(D.el("div", { class: "cells-cap", html: "recursion tree <span class='mono'>(each box is one call)</span>" }));
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + geom.w + " " + geom.h, width: geom.w, height: geom.h, style: "max-width:none;margin:0" });
    const NW = geom.nw, NH = 30, drawn = f.created || 0;
    for (let i = 0; i < drawn && i < nodes.length; i++) {
      const n = nodes[i];
      if (n.parent !== null && n.parent < drawn) {
        const p = nodes[n.parent];
        svg.appendChild(D.sLine(p._x, p._y + NH / 2, n._x, n._y - NH / 2, "edge " + (f.states[n.id] === "done" ? "tree" : f.states[n.id] ? "on" : "dim")));
      }
    }
    for (let i = 0; i < drawn && i < nodes.length; i++) {
      const n = nodes[i];
      const st = f.states[n.id];
      const cls = st === "active" ? "active" : st === "done" ? "done" : "visit";
      svg.appendChild(D.svg("rect", { x: n._x - NW / 2, y: n._y - NH / 2, width: NW, height: NH, rx: 7, class: "node-c " + cls }));
      svg.appendChild(D.sText(n._x, n._y, n.label, { "font-size": Math.min(12, 1100 / Math.max(12, n.label.length * 8)) + "" }));
      if (n.ret !== undefined && st === "done") svg.appendChild(D.sText(n._x, n._y + NH / 2 + 11, "↩ " + fmt(n.ret), { class: "lbl-s", fill: "#4ade80", "font-size": 10 }));
    }
    if (!drawn) svg.appendChild(D.sText(geom.w / 2, 30, "no calls yet", { class: "lbl-s" }));
    const sw = D.el("div", { style: "overflow:auto;max-height:" + (compact ? 340 : 480) + "px" });
    sw.appendChild(svg);
    right.appendChild(sw);
    /* the box is rebuilt every frame, so keep the running call in view once it is in the page */
    const focus = f.stack && f.stack.length ? nodes[f.stack[f.stack.length - 1]] : null;
    if (focus) Promise.resolve().then(() => {
      if (sw.scrollWidth > sw.clientWidth) sw.scrollLeft = Math.max(0, focus._x - sw.clientWidth / 2);
      if (sw.scrollHeight > sw.clientHeight) sw.scrollTop = Math.max(0, focus._y - sw.clientHeight / 2);
    });
    row.appendChild(right);
    box.appendChild(row);
    if (f.view) { const sv = sideView(f.view); sv.style.marginTop = ".8rem"; box.appendChild(sv); }
    return box;
  }

  function iterView(f) {
    const box = D.el("div");
    const row = D.el("div", { class: "row", style: "align-items:flex-start" });
    /* current variables */
    const vcol = D.el("div", { class: "col", style: "flex:0 1 260px" });
    vcol.appendChild(D.el("div", { class: "cells-cap", html: "variables <span class='mono'>(one set, overwritten)</span>" }));
    const vt = D.el("table", { class: "tbl" });
    let html = "";
    Object.keys(f.vars || {}).forEach((k) => {
      const hl = f.changed && f.changed.indexOf(k) >= 0;
      html += "<tr><th style='text-align:left'>" + k + "</th><td class='" + (hl ? "hl" : "") + "' style='min-width:5rem'>" + f.vars[k] + "</td></tr>";
    });
    vt.innerHTML = html || "<tr><td class='muted'>none yet</td></tr>";
    vcol.appendChild(vt);
    row.appendChild(vcol);
    /* iteration history */
    const hcol = D.el("div", { class: "col", style: "flex:2 1 320px" });
    hcol.appendChild(D.el("div", { class: "cells-cap", html: "loop trace <span class='mono'>(" + (f.rowCount || 0) + " iteration" + (f.rowCount === 1 ? "" : "s") + ")</span>" }));
    if (f.rows && f.rows.length) {
      const cols = Object.keys(f.rows[f.rows.length - 1]);
      const ht = D.el("table", { class: "tbl" });
      let h = "<tr>" + cols.map((c) => "<th>" + c + "</th>").join("") + "</tr>";
      f.rows.forEach((r, i) => { h += "<tr>" + cols.map((c) => "<td" + (i === f.rows.length - 1 ? " class='hl'" : "") + ">" + (r[c] == null ? "" : r[c]) + "</td>").join("") + "</tr>"; });
      ht.innerHTML = h;
      const sw = D.el("div", { style: "overflow-x:auto" });
      sw.appendChild(ht);
      hcol.appendChild(sw);
    } else hcol.appendChild(D.el("p", { class: "small muted", text: "No iterations yet." }));
    row.appendChild(hcol);
    box.appendChild(row);
    if (f.view) { const sv = sideView(f.view); sv.style.marginTop = ".8rem"; box.appendChild(sv); }
    return box;
  }

  function renderCompare(f) {
    const L = f.L, R = f.R;
    dockL.sync(L); dockR.sync(R);
    const ls = q("L-stage"), rs = q("R-stage");
    ls.innerHTML = ""; rs.innerHTML = "";
    ls.appendChild(recView(L, true));
    rs.appendChild(iterView(R));
    q("L-note").innerHTML = L.note || "";
    q("R-note").innerHTML = R.note || "";
    D.stats("#L-stats", [["calls", L.calls], ["max stack depth", L.maxDepth]]);
    D.stats("#R-stats", [["iterations", R.iters], ["peak extra memory", R.peak + " cell(s)"]]);
    q("pane-L").classList.toggle("finished", f.done[0] && player.index > 0);
    q("pane-R").classList.toggle("finished", f.done[1] && player.index > 0);
  }

  function sideView(v) {
    let el;
    if (v.type === "pegs") {
      const W = 420, H = 170, pegW = 120;
      el = D.svg("svg", { class: "canvas", viewBox: "0 0 " + W + " " + H, width: W, height: H, style: "margin:0" });
      ["A", "B", "C"].forEach((name, pi) => {
        const cx = 70 + pi * pegW;
        el.appendChild(D.svg("rect", { x: cx - 3, y: 30, width: 6, height: 100, rx: 3, fill: "#39456b" }));
        el.appendChild(D.svg("rect", { x: cx - 52, y: 130, width: 104, height: 7, rx: 3, fill: "#39456b" }));
        el.appendChild(D.sText(cx, 152, name, { class: "lbl-s", "font-size": 12 }));
        v.pegs[name].forEach((d, k) => {
          const w = 26 + d * 15;
          el.appendChild(D.svg("rect", { x: cx - w / 2, y: 130 - (k + 1) * 15, width: w, height: 13, rx: 5, fill: ["#6ea8fe", "#a78bfa", "#4ade80", "#ffc14d", "#ff6b9d"][(d - 1) % 5], opacity: 0.9 }));
          el.appendChild(D.sText(cx, 130 - (k + 1) * 15 + 7, d, { "font-size": 9, fill: "#0a0e1a" }));
        });
      });
      el.appendChild(D.sText(W - 60, 18, "moves: " + v.moves, { class: "lbl-s", "font-size": 12, fill: "#ffc14d" }));
    } else if (v.type === "array") {
      const marks = {}, ptrs = {};
      if (v.mid != null) marks[v.mid] = v.arr[v.mid] === v.target ? "done" : "target";
      if (v.lo < v.arr.length) ptrs[v.lo] = "lo";
      if (v.mid != null) ptrs[v.mid] = (ptrs[v.mid] ? ptrs[v.mid] + "/" : "") + "mid";
      if (v.hi >= 0) ptrs[v.hi] = (ptrs[v.hi] ? ptrs[v.hi] + "/" : "") + "hi";
      el = D.cells(v.arr, { marks: marks, ptrs: ptrs, live: (x, i) => i >= v.lo && i <= v.hi, show: (x) => x, w: 40, h: 36, label: "searching for <b>" + v.target + "</b> — dashed cells have been discarded" });
    } else if (v.type === "memo") {
      const arr = [];
      for (let i = 0; i <= v.n; i++) arr.push(v.memo[i] === undefined ? null : v.memo[i]);
      el = D.cells(arr, { marks: arr.reduce((m, x, i) => { if (x != null) m[i] = "done"; return m; }, {}), w: 40, h: 34, label: "table T[0…" + v.n + "] — green cells never need recomputing" });
    } else if (v.type === "list") {
      el = D.cells(v.items, { index: false, marks: v.items.reduce((m, x, i) => { m[i] = "done"; return m; }, {}), w: 52, h: 32, label: v.label + " (" + v.items.length + ")", emptyText: "none yet" });
    } else el = D.el("div");
    if (!v.tasks) return el;
    const wrap = D.el("div", { style: "display:flex;gap:1.4rem;flex-wrap:wrap;align-items:flex-end" });
    wrap.appendChild(el);
    const stk = D.el("div");
    stk.appendChild(D.el("div", { class: "cells-cap", text: "explicit stack (top on top)" }));
    const col = D.el("div", { style: "display:flex;flex-direction:column-reverse;gap:3px" });
    v.tasks.slice(-8).forEach((t, i, arr) => col.appendChild(D.el("div", { class: "cell filled " + (i === arr.length - 1 ? "active" : "visit"), style: "min-width:150px;height:26px;font-size:.72rem", text: t })));
    if (v.tasks.length > 8) col.appendChild(D.el("div", { class: "small muted", text: "… " + (v.tasks.length - 8) + " more below" }));
    if (!v.tasks.length) col.appendChild(D.el("div", { class: "small muted", text: "(empty)" }));
    stk.appendChild(col);
    wrap.appendChild(stk);
    return wrap;
  }

  /* =======================================================
     init
     ======================================================= */
  const ORDER = ["factorial", "fib", "fibmemo", "gcd", "power", "hanoi", "bsearch", "perms"];
  const EX = {
    factorial: [{ label: "factorial(6): recursive vs loop", mode: "cmp", args: { n: 6 } }, { label: "base case: factorial(1)", mode: "rec", args: { n: 1 } }],
    fib: [{ label: "fib(6): 25 calls vs 5 steps", mode: "cmp", args: { n: 6 } }, { label: "spot the repeated fib(2)", mode: "rec", args: { n: 5 } }],
    fibmemo: [{ label: "memo (top-down) vs table (bottom-up)", mode: "cmp", args: { n: 8 } }, { label: "fib(14) with memo", mode: "rec", args: { n: 14 } }],
    gcd: [{ label: "gcd(1071, 462)", mode: "cmp", args: { a: 1071, b: 462 } }, { label: "gcd(89, 55): consecutive Fibonacci numbers, the slowest case", mode: "rec", args: { a: 89, b: 55 } }],
    power: [{ label: "3¹³: halving vs reading bits", mode: "cmp", args: { x: 3, n: 13 } }, { label: "2³² with a loop", mode: "iter", args: { x: 2, n: 32 } }],
    hanoi: [{ label: "3 disks: call stack vs explicit stack", mode: "cmp", args: { n: 3 } }, { label: "4 disks, recursive", mode: "rec", args: { n: 4 } }],
    bsearch: [{ label: "find 47", mode: "cmp", args: { target: 47 } }, { label: "a missing key (50)", mode: "iter", args: { target: 50 } }],
    perms: [{ label: "ABC: recursion vs explicit stack", mode: "cmp", args: { str: "ABC" } }, { label: "ABCD: 24 leaves", mode: "rec", args: { str: "ABCD" } }],
  };
  let cur = "factorial", player, sortedArr = [], mode = "rec", modeSeg;

  function buildInputs(id) {
    const f = FN[id], box = q("inputs");
    box.innerHTML = "";
    (f.inputs || []).forEach((inp) => {
      const wrap = D.el("div", { class: "field" });
      wrap.appendChild(D.el("label", { text: inp.label }));
      wrap.appendChild(D.el("input", { type: "number", id: "in-" + inp.id, value: inp.value, min: inp.min, max: inp.max, style: "width:5rem" }));
      box.appendChild(wrap);
    });
    if (f.stringInput) {
      const wrap = D.el("div", { class: "field" });
      wrap.appendChild(D.el("label", { text: f.stringInput.label }));
      wrap.appendChild(D.el("input", { type: "text", id: "in-str", value: f.stringInput.value, style: "width:6rem" }));
      box.appendChild(wrap);
    }
    if (f.arrayInput) {
      const wrap = D.el("div", { class: "field" });
      wrap.appendChild(D.el("label", { text: "sorted array" }));
      wrap.appendChild(D.el("input", { type: "text", id: "in-arr", class: "wide", value: sortedArr.join(", ") }));
      box.appendChild(wrap);
    }
  }

  function setMode(m) {
    mode = m;
    D.showFor(m);
    if (modeSeg && modeSeg.current !== m) modeSeg.pick(m, true);
    dock.show(cur + (m === "iter" ? "_iter" : "_rec"));
    dockL.show(cur + "_rec");
    dockR.show(cur + "_iter");
  }

  function select(id) {
    cur = id;
    const f = FN[id];
    q("fn-name").textContent = f.label;
    q("fn-blurb").innerHTML = f.blurb;
    q("fn-big").innerHTML = f.big.map((b) => "<span>" + b + "</span>").join("");
    D.$$("#fn-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
    buildInputs(id);
    setMode(mode);
    D.Examples("#examples", EX[id].map((e) => ({ label: e.label, run: () => runExample(e) })));
    D.practiceShow(id);
    nodes = [];
    player.load([{ note: "Ready — press <b>Run</b> to trace " + f.label + "." }], false);
  }

  function runExample(e) {
    Object.keys(e.args).forEach((k) => {
      const el = k === "str" ? q("in-str") : q("in-" + k);
      if (el) el.value = e.args[k];
    });
    setMode(e.mode);
    run();
  }

  function readArgs() {
    const f = FN[cur];
    const args = {};
    (f.inputs || []).forEach((inp) => {
      let v = parseInt(D.$("#in-" + inp.id).value, 10);
      if (isNaN(v)) v = inp.value;
      v = D.clamp(v, inp.min, inp.max);
      D.$("#in-" + inp.id).value = v;
      args[inp.id] = v;
    });
    if (f.stringInput) {
      const s = (D.$("#in-str").value || "ABC").replace(/\s+/g, "").slice(0, f.stringInput.max);
      D.$("#in-str").value = s;
      if (!s.length) { D.toast("Enter at least one character.", true); return null; }
      args.str = s;
    }
    if (f.arrayInput) {
      let a = D.parseNums(D.$("#in-arr").value);
      if (a.length < 2) a = sortedArr.slice();
      a.sort((x, y) => x - y);
      sortedArr = a;
      D.$("#in-arr").value = a.join(", ");
      args.arr = a;
    }
    return args;
  }

  function traceRec(args) {
    const t = new Tracer(1600);
    t.frame("Ready to call the outermost function. The call stack is empty.");
    FN[cur].run(t, clone(args));
    t.at(null);
    t.frame("Done. The stack is empty again: every frame that was pushed has been popped. Total calls: <b>" + t.calls + "</b>, deepest the stack ever got: <b>" + t.maxDepth + "</b>.");
    nodes = t.nodes;
    layout(nodes);
    t.frames.forEach((fr) => (fr.code = cur + "_rec"));
    return t;
  }
  function traceIter(args) {
    const it = new It(1600);
    ITER[cur].run(it, clone(args));
    it.frames.forEach((fr) => (fr.code = cur + "_iter"));
    return it;
  }

  function run() {
    const args = readArgs();
    if (!args) return;
    let frames;
    if (mode === "rec") { const t = traceRec(args); if (t.over) D.toast("Trace truncated — try a smaller input.", true); frames = t.frames; }
    else if (mode === "iter") { frames = traceIter(args).frames; }
    else {
      const t = traceRec(args), it = traceIter(args);
      frames = D.zip(t.frames, it.frames, (L, R, i, a, b) =>
        "Same input, two programs, one step each per frame. Recursive: <b>" + a + "</b> steps. Iterative: <b>" + b + "</b> steps." + (i >= Math.min(a, b) - 1 ? " The shorter one has finished and waits with a ✓." : ""));
    }
    player.load(frames, true);
  }

  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "factorial": {
    "label": "factorial",
    "items": [
     [
      509,
      "Fibonacci Number",
      "fibonacci-number",
      "Easy",
      "The next simplest recursion."
     ],
     [
      172,
      "Factorial Trailing Zeroes",
      "factorial-trailing-zeroes",
      "Medium",
      "Reason about n! without computing it."
     ],
     [
      344,
      "Reverse String",
      "reverse-string",
      "Easy",
      "Recursion that shrinks the input by one."
     ]
    ]
   },
   "fib": {
    "label": "fib (naive)",
    "items": [
     [
      509,
      "Fibonacci Number",
      "fibonacci-number",
      "Easy",
      "Write it naively, then time it for n = 40."
     ],
     [
      1137,
      "N-th Tribonacci Number",
      "n-th-tribonacci-number",
      "Easy",
      "Three branches — even more repeated work."
     ],
     [
      70,
      "Climbing Stairs",
      "climbing-stairs",
      "Easy",
      "Fibonacci in disguise."
     ]
    ]
   },
   "fibmemo": {
    "label": "fib (memoised)",
    "items": [
     [
      70,
      "Climbing Stairs",
      "climbing-stairs",
      "Easy",
      "Add a memo and it becomes O(n)."
     ],
     [
      746,
      "Min Cost Climbing Stairs",
      "min-cost-climbing-stairs",
      "Easy",
      "Top-down memo or bottom-up table."
     ],
     [
      198,
      "House Robber",
      "house-robber",
      "Medium",
      "The next step in dynamic programming."
     ]
    ]
   },
   "gcd": {
    "label": "gcd",
    "items": [
     [
      1979,
      "Find Greatest Common Divisor of Array",
      "find-greatest-common-divisor-of-array",
      "Easy",
      "Euclid's algorithm directly."
     ],
     [
      1071,
      "Greatest Common Divisor of Strings",
      "greatest-common-divisor-of-strings",
      "Easy",
      "The same recursion on strings."
     ]
    ]
   },
   "power": {
    "label": "fast power",
    "items": [
     [
      50,
      "Pow(x, n)",
      "powx-n",
      "Medium",
      "Exactly this algorithm — watch out for negative n."
     ],
     [
      231,
      "Power of Two",
      "power-of-two",
      "Easy",
      "Read the bits of n."
     ],
     [
      326,
      "Power of Three",
      "power-of-three",
      "Easy",
      "Divide until you hit the base case."
     ]
    ]
   },
   "hanoi": {
    "label": "Towers of Hanoi",
    "note": "Hanoi itself is not on LeetCode. These use the same pattern: solve a smaller copy of the problem, then combine.",
    "items": [
     [
      206,
      "Reverse Linked List",
      "reverse-linked-list",
      "Easy",
      "Recurse on the rest, then fix one link."
     ],
     [
      24,
      "Swap Nodes in Pairs",
      "swap-nodes-in-pairs",
      "Medium",
      "Handle two nodes, recurse on the rest."
     ],
     [
      779,
      "K-th Symbol in Grammar",
      "k-th-symbol-in-grammar",
      "Medium",
      "Each row is built from the row above, like each Hanoi level."
     ]
    ]
   },
   "bsearch": {
    "label": "binary search",
    "items": [
     [
      704,
      "Binary Search",
      "binary-search",
      "Easy",
      "Exactly this tab."
     ],
     [
      35,
      "Search Insert Position",
      "search-insert-position",
      "Easy",
      "What lo points at when the search misses."
     ],
     [
      33,
      "Search in Rotated Sorted Array",
      "search-in-rotated-sorted-array",
      "Medium",
      "Decide which half is sorted first."
     ]
    ]
   },
   "perms": {
    "label": "permutations",
    "items": [
     [
      46,
      "Permutations",
      "permutations",
      "Medium",
      "Exactly this tab."
     ],
     [
      47,
      "Permutations II",
      "permutations-ii",
      "Medium",
      "Skip duplicate letters."
     ],
     [
      78,
      "Subsets",
      "subsets",
      "Medium",
      "The same choose-or-skip recursion tree."
     ],
     [
      17,
      "Letter Combinations of a Phone Number",
      "letter-combinations-of-a-phone-number",
      "Medium",
      "Backtracking over choices."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    sortedArr = [3, 8, 14, 21, 29, 36, 47, 55, 68, 74, 82, 91];
    const listings = {};
    ORDER.forEach((id) => {
      listings[id + "_rec"] = Object.assign({ title: FN[id].label + " — recursive" }, FN[id].code);
      listings[id + "_iter"] = ITER[id].code;
    });
    const M = (t) => "<span class='mono'>" + t + "</span>";
    const HI = { pseudo: "n − 1", java: "a.length - 1", cpp: "(int)a.size() - 1", python: "len(a) - 1" };
    D.specs(listings, {
      factorial_rec: { does: "Computes n! = n · (n−1)!, with 0! = 1! = 1 as the base case.", params: M("n") + " — n ≥ 0", returns: "n!", errors: "overflows an int beyond 12!", cost: "O(n) time, O(n) stack frames" },
      factorial_iter: { does: "Computes n! with a loop that multiplies 2, 3, …, n into one variable.", params: M("n") + " — n ≥ 0", returns: "n!", errors: "overflows a long beyond 20!", cost: "O(n) time, O(1) space" },
      fib_rec: { does: "Computes the n-th Fibonacci number straight from the definition fib(n) = fib(n−1) + fib(n−2).", params: M("n") + " — n ≥ 0", returns: "fib(n)", errors: "none, but it recomputes the same values over and over", cost: "Θ(φⁿ) ≈ Θ(1.618ⁿ) calls, O(n) stack" },
      fib_iter: { does: "Computes fib(n) by sliding two variables (the previous two numbers) forward.", params: M("n") + " — n ≥ 0", returns: "fib(n)", errors: "none", cost: "O(n) time, O(1) space" },
      fibmemo_rec: { does: "Recursive fib that stores each answer in a memo, so every fib(k) is computed only once (top-down DP).", params: M("n") + " — n ≥ 0 · " + M("memo") + " — the map of answers found so far", returns: "fib(n)", errors: "none", cost: "O(n) time, O(n) memo + O(n) stack", callVals: { memo: { pseudo: "{}", java: "new HashMap<>()", cpp: "memo", python: "{}" } } },
      fibmemo_iter: { does: "Fills a table T[0..n] from the bottom up: T[i] = T[i−1] + T[i−2].", params: M("n") + " — n ≥ 0", returns: "T[n] = fib(n)", errors: "none", cost: "O(n) time, O(n) space" },
      gcd_rec: { does: "Euclid's algorithm: gcd(a, b) = gcd(b, a mod b), and gcd(a, 0) = a.", params: M("a") + ", " + M("b") + " — non-negative integers", returns: "their greatest common divisor", errors: "none", cost: "O(log min(a, b)) calls — tail recursive" },
      gcd_iter: { does: "Euclid's algorithm as a loop: replace (a, b) by (b, a mod b) until b is 0.", params: M("a") + ", " + M("b") + " — non-negative integers", returns: "gcd(a, b)", errors: "none", cost: "O(log min(a, b)) time, O(1) space" },
      power_rec: { does: "Computes xⁿ by squaring: xⁿ = (x^⌊n/2⌋)², times x when n is odd.", params: M("x") + " — the base · " + M("n") + " — exponent ≥ 0", returns: "xⁿ", errors: "overflows a long for large results", cost: "O(log n) multiplications and stack frames" },
      power_iter: { does: "Computes xⁿ by reading the bits of n: square x each step, multiply it in when the bit is 1.", params: M("x") + " — the base · " + M("n") + " — exponent ≥ 0", returns: "xⁿ", errors: "overflows a long for large results", cost: "O(log n) time, O(1) space" },
      hanoi_rec: { does: "Moves n disks from one peg to another: move n−1 out of the way, move the biggest, move n−1 back on top.", params: M("n") + " — number of disks · the three pegs", returns: "nothing (prints the moves)", errors: "none", cost: "2ⁿ − 1 moves, O(n) stack", callVals: { from: "'A'", to: "'C'", via: "'B'", src: "'A'", dst: "'C'" } },
      hanoi_iter: { does: "The same moves, driven by an explicit stack of pending tasks instead of the call stack.", params: M("n") + " — number of disks", returns: "nothing (prints the moves)", errors: "none", cost: "2ⁿ − 1 moves, O(n) explicit stack" },
      bsearch_rec: { does: "Binary search in a sorted array: compare with the middle, then recurse into the half that can hold the target.", params: M("A") + " — sorted array · " + M("target") + " — the key · " + M("lo") + ", " + M("hi") + " — the range (call with 0 and n − 1)", returns: "an index holding target, or −1", errors: "wrong answers if A is not sorted", cost: "O(log n) time and stack", callVals: { lo: "0", hi: HI, A: "A", a: "a" } },
      bsearch_iter: { does: "The same binary search with a loop that moves lo and hi.", params: M("A") + " — sorted array · " + M("target") + " — the key", returns: "an index holding target, or −1", errors: "wrong answers if A is not sorted", cost: "O(log n) time, O(1) space" },
      perms_rec: { does: "Prints every ordering of the characters: fix each remaining character next, then permute the rest.", params: M("chosen") + " — the prefix built so far · " + M("rest") + " — characters still to place", returns: "nothing (prints n! strings)", errors: "none", cost: "Θ(n · n!)", callVals: { chosen: '""' } },
      perms_iter: { does: "The same orderings, produced by an explicit stack of (chosen, rest) states.", params: M("s") + " — the characters", returns: "nothing (prints n! strings)", errors: "none", cost: "Θ(n · n!)" },
    });
    /* the call line shows the values in the input boxes */
    const inputArgs = () => {
      const v = {};
      D.$$("#inputs input").forEach((el) => {
        const id = el.id.replace(/^in-/, "");
        if (id === "str") { v.s = v.rest = '"' + el.value + '"'; }
        else if (id !== "arr" && el.value !== "") v[id] = el.value;
      });
      return v;
    };
    dock = D.CodeDock("#code", listings, { args: inputArgs });
    dockL = D.CodeDock("#L-code", listings, { collapsible: false, args: inputArgs });
    dockR = D.CodeDock("#R-code", listings, { collapsible: false, args: inputArgs });
    player = new D.Player({ mount: "#player", render: render, delay: 700, code: dock });
    const tabs = q("fn-tabs");
    ORDER.forEach((id) => tabs.appendChild(D.el("button", { text: FN[id].label, "data-id": id, onclick: () => select(id) })));
    modeSeg = D.Segmented("#mode", [
      { id: "rec", label: "Recursive" },
      { id: "iter", label: "Iterative" },
      { id: "cmp", label: "Side by side" },
    ], (m) => { setMode(m); player.load([{ note: "Mode: <b>" + { rec: "recursive", iter: "iterative", cmp: "recursive vs iterative, side by side" }[m] + "</b>. Press <b>Run</b>." }], false); }, "rec");
    q("btn-run").addEventListener("click", run);
    D.legend("#legend", [
      { color: "var(--c-active)", label: "currently running (top of stack)" },
      { color: "var(--c-visit)", label: "on the stack, waiting for a sub-call" },
      { color: "var(--c-done)", label: "returned / computed" },
      { color: "#6ea8fe", label: "variable that just changed" },
    ]);
    select("factorial");
  });
})();
