/* ============================================================
   arrays.js — fixed array, dynamic array, 2-D array, and
   singly / doubly / circularly linked lists.
   Every operation records frames tagged with a code listing
   and an anchor, so the code dock above the stage follows along.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const q = (id) => D.$("#" + id);

  /* ============================================================
     CODE LISTINGS  (lines ending "@@name" are anchors)
     ============================================================ */
  const CODE = {};

  /* ---------- shared by fixed + dynamic arrays ---------- */
  CODE.get = {
    title: "get(i)",
    pseudo: [
      "get(i):",
      "  if i < 0 or i ≥ n: error         // out of bounds @@check",
      "  return A[i]      // address = base + i · cellSize @@ret",
    ],
    java: [
      "double get(int i) {",
      "  if (i < 0 || i >= n) throw new IndexOutOfBoundsException(); @@check",
      "  return a[i];     // address = base + i * 4 bytes @@ret",
      "}",
    ],
  };
  CODE.set = {
    title: "set(i, x)",
    pseudo: ["set(i, x):", "  if i < 0 or i ≥ n: error @@check", "  A[i] ← x          // overwrite in place, O(1) @@write"],
    java: ["void set(int i, double x) {", "  if (i < 0 || i >= n) throw new IndexOutOfBoundsException(); @@check", "  a[i] = x; @@write", "}"],
  };
  CODE.remove = {
    title: "remove(i)",
    pseudo: [
      "remove(i):",
      "  if i < 0 or i ≥ n: error @@check",
      "  x ← A[i] @@save",
      "  for k ← i to n-2:              // close the gap @@shift",
      "    A[k] ← A[k+1] @@shift",
      "  A[n-1] ← null @@clear",
      "  n ← n - 1 @@clear",
      "  return x @@ret",
    ],
    java: [
      "double remove(int i) {",
      "  if (i < 0 || i >= n) throw new IndexOutOfBoundsException(); @@check",
      "  double x = a[i]; @@save",
      "  for (int k = i; k < n - 1; k++)   // close the gap @@shift",
      "    a[k] = a[k + 1]; @@shift",
      "  a[n - 1] = 0; @@clear",
      "  n--; @@clear",
      "  return x; @@ret",
      "}",
    ],
  };
  CODE.indexOf = {
    title: "indexOf(x)",
    pseudo: ["indexOf(x):", "  for i ← 0 to n-1: @@loop", "    if A[i] == x: return i @@cmp", "  return -1          // not found @@miss"],
    java: ["int indexOf(double x) {", "  for (int i = 0; i < n; i++) @@loop", "    if (a[i] == x) return i; @@cmp", "  return -1; @@miss", "}"],
  };

  /* ---------- fixed array ---------- */
  CODE.fa_add = {
    title: "add(x) — fixed capacity",
    pseudo: ["add(x):", "  if n == capacity: error \"array is full\" @@full", "  A[n] ← x @@write", "  n ← n + 1 @@size"],
    java: [
      "void add(double x) {",
      "  if (n == a.length) throw new IllegalStateException(\"full\"); @@full",
      "  a[n] = x; @@write",
      "  n++; @@size",
      "}",
    ],
  };
  CODE.fa_insert = {
    title: "insert(i, x) — fixed capacity",
    pseudo: [
      "insert(i, x):",
      "  if i < 0 or i > n: error @@check",
      "  if n == capacity: error \"array is full\" @@full",
      "  for k ← n-1 down to i:          // open a gap @@shift",
      "    A[k+1] ← A[k] @@shift",
      "  A[i] ← x @@write",
      "  n ← n + 1 @@size",
    ],
    java: [
      "void insert(int i, double x) {",
      "  if (i < 0 || i > n) throw new IndexOutOfBoundsException(); @@check",
      "  if (n == a.length) throw new IllegalStateException(\"full\"); @@full",
      "  for (int k = n - 1; k >= i; k--)   // open a gap @@shift",
      "    a[k + 1] = a[k]; @@shift",
      "  a[i] = x; @@write",
      "  n++; @@size",
      "}",
    ],
  };

  /* ---------- dynamic array (listing depends on the growth rule) ---------- */
  function resizeLines(lang) {
    return {
      pseudo: [
        "",
        "resize(newCap):",
        "  B ← new array[newCap] @@alloc",
        "  for k ← 0 to n-1: @@copy",
        "    B[k] ← A[k]           // the expensive part @@copy",
        "  A ← B                   // old array becomes garbage @@swap",
      ],
      java: [
        "",
        "private void resize(int newCap) {",
        "  double[] b = new double[newCap]; @@alloc",
        "  for (int k = 0; k < n; k++) @@copy",
        "    b[k] = a[k]; @@copy",
        "  a = b; @@swap",
        "}",
      ],
    }[lang];
  }
  function growExpr(lang, geo) {
    return {
      pseudo: geo ? "2 · capacity" : "capacity + 2",
      java: geo ? "2 * a.length" : "a.length + 2",
    }[lang];
  }
  function daAddCode(geo) {
    const why = geo ? "geometric: 1, 2, 4, 8, …" : "arithmetic: +2 each time";
    return {
      title: "add(x) — grows " + (geo ? "×2" : "+2"),
      pseudo: [
        "add(x):",
        "  if n == capacity: @@full",
        "    resize(" + growExpr("pseudo", geo) + ")   // " + why + " @@grow",
        "  A[n] ← x @@write",
        "  n ← n + 1 @@size",
      ].concat(resizeLines("pseudo")),
      java: [
        "void add(double x) {",
        "  if (n == a.length) @@full",
        "    resize(" + growExpr("java", geo) + ");   // " + why + " @@grow",
        "  a[n] = x; @@write",
        "  n++; @@size",
        "}",
      ].concat(resizeLines("java")),
    };
  }
  function daInsertCode(geo) {
    return {
      title: "insert(i, x) — grows " + (geo ? "×2" : "+2"),
      pseudo: [
        "insert(i, x):",
        "  if i < 0 or i > n: error @@check",
        "  if n == capacity: resize(" + growExpr("pseudo", geo) + ") @@full,grow",
        "  for k ← n-1 down to i:          // open a gap @@shift",
        "    A[k+1] ← A[k] @@shift",
        "  A[i] ← x @@write",
        "  n ← n + 1 @@size",
      ].concat(resizeLines("pseudo")),
      java: [
        "void insert(int i, double x) {",
        "  if (i < 0 || i > n) throw new IndexOutOfBoundsException(); @@check",
        "  if (n == a.length) resize(" + growExpr("java", geo) + "); @@full,grow",
        "  for (int k = n - 1; k >= i; k--)   // open a gap @@shift",
        "    a[k + 1] = a[k]; @@shift",
        "  a[i] = x; @@write",
        "  n++; @@size",
        "}",
      ].concat(resizeLines("java")),
    };
  }
  CODE.da_add_geo = daAddCode(true);
  CODE.da_add_arith = daAddCode(false);
  CODE.da_insert_geo = daInsertCode(true);
  CODE.da_insert_arith = daInsertCode(false);

  /* ---------- 2-D array ---------- */
  CODE.g_get = {
    title: "get(r, c)",
    pseudo: [
      "get(r, c):                       // rows × cols, row-major",
      "  if r ∉ [0, rows) or c ∉ [0, cols): error @@check",
      "  k ← r · cols + c                 // flatten to one index @@flat",
      "  return M[k]                      // one memory access @@ret",
    ],
    java: [
      "static double get(double[][] m, int r, int c) {",
      "  if (r < 0 || r >= m.length || c < 0 || c >= m[r].length) throw new IndexOutOfBoundsException(); @@check",
      "  double[] row = m[r];   // Java: an array of row arrays @@flat",
      "  return row[c]; @@ret",
      "}",
    ],
  };
  CODE.g_set = {
    title: "set(r, c, x)",
    pseudo: [
      "set(r, c, x):",
      "  if r ∉ [0, rows) or c ∉ [0, cols): error @@check",
      "  k ← r · cols + c @@flat",
      "  M[k] ← x @@write",
    ],
    java: ["static void set(double[][] m, int r, int c, double x) {", "  if (r < 0 || r >= m.length || c < 0 || c >= m[r].length) throw new IndexOutOfBoundsException(); @@check", "  double[] row = m[r]; @@flat", "  row[c] = x; @@write", "}"],
  };
  CODE.g_rowmajor = {
    title: "row-major traversal",
    pseudo: [
      "traverseRowMajor():",
      "  for r ← 0 to rows-1: @@outer",
      "    for c ← 0 to cols-1: @@inner",
      "      visit(M[r][c])      // memory: consecutive cells @@visit",
    ],
    java: [
      "static void traverseRowMajor(double[][] m) {",
      "  for (int r = 0; r < m.length; r++) @@outer",
      "    for (int c = 0; c < m[r].length; c++) @@inner",
      "      visit(m[r][c]); @@visit",
      "}",
    ],
  };
  CODE.g_colmajor = {
    title: "column-major traversal",
    pseudo: [
      "traverseColumnMajor():",
      "  for c ← 0 to cols-1: @@outer",
      "    for r ← 0 to rows-1: @@inner",
      "      visit(M[r][c])      // memory: jumps by cols @@visit",
    ],
    java: [
      "static void traverseColumnMajor(double[][] m) {",
      "  for (int c = 0; c < m[0].length; c++) @@outer",
      "    for (int r = 0; r < m.length; r++) @@inner",
      "      visit(m[r][c]); @@visit",
      "}",
    ],
  };
  CODE.g_rowsum = {
    title: "rowSum(r)",
    pseudo: ["rowSum(r):", "  if r ∉ [0, rows): error @@check", "  s ← 0 @@init", "  for c ← 0 to cols-1: @@loop", "    s ← s + M[r][c] @@add", "  return s @@ret"],
    java: ["static double rowSum(double[][] m, int r) {", "  if (r < 0 || r >= m.length) throw new IndexOutOfBoundsException(); @@check", "  double s = 0; @@init", "  for (int c = 0; c < m[r].length; c++) @@loop", "    s += m[r][c]; @@add", "  return s; @@ret", "}"],
  };
  CODE.g_find = {
    title: "find(x)",
    pseudo: [
      "find(x):",
      "  for r ← 0 to rows-1: @@outer",
      "    for c ← 0 to cols-1: @@inner",
      "      if M[r][c] == x: return (r, c) @@cmp",
      "  return (-1, -1) @@miss",
    ],
    java: [
      "static int[] find(double[][] m, double x) {",
      "  for (int r = 0; r < m.length; r++) @@outer",
      "    for (int c = 0; c < m[r].length; c++) @@inner",
      "      if (m[r][c] == x) return new int[]{r, c}; @@cmp",
      "  return new int[]{-1, -1}; @@miss",
      "}",
    ],
  };

  /* ---------- singly linked list (head + tail) ---------- */
  CODE.s_addFirst = {
    title: "addFirst(x) — singly linked",
    pseudo: [
      "addFirst(x):",
      "  node ← new Node(x) @@alloc",
      "  node.next ← head        // link first, or the list is lost @@link",
      "  head ← node @@head",
      "  if tail == null: tail ← node @@tail",
      "  size ← size + 1 @@size",
    ],
    java: [
      "void addFirst(double x) {",
      "  Node node = new Node(x); @@alloc",
      "  node.next = head; @@link",
      "  head = node; @@head",
      "  if (tail == null) tail = node; @@tail",
      "  size++; @@size",
      "}",
    ],
  };
  CODE.s_addLast = {
    title: "addLast(x) — singly linked",
    pseudo: [
      "addLast(x):",
      "  node ← new Node(x) @@alloc",
      "  if head == null: head ← node @@empty",
      "  else: tail.next ← node   // the tail pointer saves a walk @@link",
      "  tail ← node @@tail",
      "  size ← size + 1 @@size",
    ],
    java: [
      "void addLast(double x) {",
      "  Node node = new Node(x); @@alloc",
      "  if (head == null) head = node; @@empty",
      "  else tail.next = node; @@link",
      "  tail = node; @@tail",
      "  size++; @@size",
      "}",
    ],
  };
  CODE.s_insert = {
    title: "insert(i, x) — singly linked",
    pseudo: [
      "insert(i, x):                  // 0 < i ≤ size",
      "  if i < 1 or i > size: error   // i = 0 is addFirst @@check",
      "  prev ← head @@start",
      "  for k ← 1 to i-1: prev ← prev.next @@walk",
      "  node ← new Node(x) @@alloc",
      "  node.next ← prev.next @@link",
      "  prev.next ← node @@splice",
      "  if node.next == null: tail ← node @@tail",
      "  size ← size + 1 @@size",
    ],
    java: [
      "void insert(int i, double x) {",
      "  if (i < 1 || i > size) throw new IndexOutOfBoundsException(); @@check",
      "  Node prev = head; @@start",
      "  for (int k = 1; k < i; k++) prev = prev.next; @@walk",
      "  Node node = new Node(x); @@alloc",
      "  node.next = prev.next; @@link",
      "  prev.next = node; @@splice",
      "  if (node.next == null) tail = node; @@tail",
      "  size++; @@size",
      "}",
    ],
  };
  CODE.s_removeFirst = {
    title: "removeFirst() — singly linked",
    pseudo: [
      "removeFirst():",
      "  if head == null: error \"empty\" @@check",
      "  x ← head.data @@save",
      "  head ← head.next @@head",
      "  if head == null: tail ← null @@tail",
      "  size ← size - 1 @@size",
      "  return x @@ret",
    ],
    java: [
      "double removeFirst() {",
      "  if (head == null) throw new NoSuchElementException(); @@check",
      "  double x = head.data; @@save",
      "  head = head.next; @@head",
      "  if (head == null) tail = null; @@tail",
      "  size--; @@size",
      "  return x; @@ret",
      "}",
    ],
  };
  CODE.s_removeLast = {
    title: "removeLast() — singly linked",
    pseudo: [
      "removeLast():",
      "  if head == tail: return removeFirst()   // 0 or 1 node @@one",
      "  prev ← head @@start",
      "  while prev.next ≠ tail: prev ← prev.next   // O(n) walk @@walk",
      "  x ← tail.data @@save",
      "  prev.next ← null @@unlink",
      "  tail ← prev @@tail",
      "  size ← size - 1 @@size",
      "  return x @@ret",
    ],
    java: [
      "double removeLast() {",
      "  if (head == tail) return removeFirst(); @@one",
      "  Node prev = head; @@start",
      "  while (prev.next != tail) prev = prev.next; @@walk",
      "  double x = tail.data; @@save",
      "  prev.next = null; @@unlink",
      "  tail = prev; @@tail",
      "  size--; @@size",
      "  return x; @@ret",
      "}",
    ],
  };
  CODE.s_remove = {
    title: "remove(i) — singly linked",
    pseudo: [
      "remove(i):                     // 0 < i < size",
      "  if i < 1 or i ≥ size: error   // i = 0 is removeFirst @@check",
      "  prev ← head @@start",
      "  for k ← 1 to i-1: prev ← prev.next @@walk",
      "  cur ← prev.next @@cur",
      "  prev.next ← cur.next         // jump over cur @@unlink",
      "  if cur == tail: tail ← prev @@tail",
      "  size ← size - 1 @@size",
      "  return cur.data @@ret",
    ],
    java: [
      "double remove(int i) {",
      "  if (i < 1 || i >= size) throw new IndexOutOfBoundsException(); @@check",
      "  Node prev = head; @@start",
      "  for (int k = 1; k < i; k++) prev = prev.next; @@walk",
      "  Node cur = prev.next; @@cur",
      "  prev.next = cur.next; @@unlink",
      "  if (cur == tail) tail = prev; @@tail",
      "  size--; @@size",
      "  return cur.data; @@ret",
      "}",
    ],
  };
  CODE.l_indexOf = {
    title: "indexOf(x) — linked list",
    pseudo: [
      "indexOf(x):",
      "  cur ← head;  i ← 0 @@start",
      "  while cur ≠ null: @@loop",
      "    if cur.data == x: return i @@cmp",
      "    cur ← cur.next;  i ← i + 1   // no index arithmetic possible @@next",
      "  return -1 @@miss",
    ],
    java: [
      "int indexOf(double x) {",
      "  Node cur = head;  int i = 0; @@start",
      "  while (cur != null) { @@loop",
      "    if (cur.data == x) return i; @@cmp",
      "    cur = cur.next;  i++; @@next",
      "  }",
      "  return -1; @@miss",
      "}",
    ],
  };
  CODE.s_reverse = {
    title: "reverse() — singly linked",
    pseudo: [
      "reverse():",
      "  prev ← null;  cur ← head;  tail ← head @@init",
      "  while cur ≠ null: @@loop",
      "    next ← cur.next             // remember the rest @@save",
      "    cur.next ← prev             // flip one arrow @@flip",
      "    prev ← cur;  cur ← next @@advance",
      "  head ← prev @@head",
    ],
    java: [
      "void reverse() {",
      "  Node prev = null, cur = head;  tail = head; @@init",
      "  while (cur != null) { @@loop",
      "    Node next = cur.next; @@save",
      "    cur.next = prev; @@flip",
      "    prev = cur;  cur = next; @@advance",
      "  }",
      "  head = prev; @@head",
      "}",
    ],
  };

  /* ---------- doubly linked list ---------- */
  CODE.d_addFirst = {
    title: "addFirst(x) — doubly linked",
    pseudo: [
      "addFirst(x):",
      "  node ← new Node(x) @@alloc",
      "  node.next ← head @@link",
      "  if head ≠ null: head.prev ← node @@back",
      "  else: tail ← node @@backElse",
      "  head ← node @@head",
      "  size ← size + 1 @@size",
    ],
    java: [
      "void addFirst(double x) {",
      "  Node node = new Node(x); @@alloc",
      "  node.next = head; @@link",
      "  if (head != null) head.prev = node; @@back",
      "  else tail = node; @@backElse",
      "  head = node; @@head",
      "  size++; @@size",
      "}",
    ],
  };
  CODE.d_addLast = {
    title: "addLast(x) — doubly linked",
    pseudo: [
      "addLast(x):",
      "  node ← new Node(x) @@alloc",
      "  node.prev ← tail @@link",
      "  if tail ≠ null: tail.next ← node @@back",
      "  else: head ← node @@backElse",
      "  tail ← node @@tail",
      "  size ← size + 1 @@size",
    ],
    java: [
      "void addLast(double x) {",
      "  Node node = new Node(x); @@alloc",
      "  node.prev = tail; @@link",
      "  if (tail != null) tail.next = node; @@back",
      "  else head = node; @@backElse",
      "  tail = node; @@tail",
      "  size++; @@size",
      "}",
    ],
  };
  CODE.d_insert = {
    title: "insert(i, x) — doubly linked",
    pseudo: [
      "insert(i, x):                  // 0 < i < size",
      "  if i < 1 or i ≥ size: error   // i = 0 is addFirst, i = size is addLast @@check",
      "  cur ← head @@start",
      "  for k ← 1 to i: cur ← cur.next     // cur is at index i @@walk",
      "  node ← new Node(x) @@alloc",
      "  node.prev ← cur.prev;  node.next ← cur @@link",
      "  cur.prev.next ← node @@fwd",
      "  cur.prev ← node @@back",
      "  size ← size + 1 @@size",
    ],
    java: [
      "void insert(int i, double x) {",
      "  if (i < 1 || i >= size) throw new IndexOutOfBoundsException(); @@check",
      "  Node cur = head; @@start",
      "  for (int k = 1; k <= i; k++) cur = cur.next; @@walk",
      "  Node node = new Node(x); @@alloc",
      "  node.prev = cur.prev;  node.next = cur; @@link",
      "  cur.prev.next = node; @@fwd",
      "  cur.prev = node; @@back",
      "  size++; @@size",
      "}",
    ],
  };
  CODE.d_removeFirst = {
    title: "removeFirst() — doubly linked",
    pseudo: [
      "removeFirst():",
      "  if head == null: error \"empty\" @@check",
      "  x ← head.data @@save",
      "  head ← head.next @@head",
      "  if head == null: tail ← null @@tail",
      "  else: head.prev ← null @@tailElse",
      "  size ← size - 1 @@size",
      "  return x @@ret",
    ],
    java: [
      "double removeFirst() {",
      "  if (head == null) throw new NoSuchElementException(); @@check",
      "  double x = head.data; @@save",
      "  head = head.next; @@head",
      "  if (head == null) tail = null; @@tail",
      "  else head.prev = null; @@tailElse",
      "  size--; @@size",
      "  return x; @@ret",
      "}",
    ],
  };
  CODE.d_removeLast = {
    title: "removeLast() — doubly linked",
    pseudo: [
      "removeLast():",
      "  if tail == null: error \"empty\" @@check",
      "  x ← tail.data @@save",
      "  tail ← tail.prev            // no walk: prev is right there @@tail",
      "  if tail == null: head ← null @@unlink",
      "  else: tail.next ← null @@unlinkElse",
      "  size ← size - 1 @@size",
      "  return x @@ret",
    ],
    java: [
      "double removeLast() {",
      "  if (tail == null) throw new NoSuchElementException(); @@check",
      "  double x = tail.data; @@save",
      "  tail = tail.prev; @@tail",
      "  if (tail == null) head = null; @@unlink",
      "  else tail.next = null; @@unlinkElse",
      "  size--; @@size",
      "  return x; @@ret",
      "}",
    ],
  };
  CODE.d_remove = {
    title: "remove(i) — doubly linked",
    pseudo: [
      "remove(i):                     // 0 < i < size-1",
      "  if i < 1 or i ≥ size-1: error   // i = 0 is removeFirst, i = size-1 is removeLast @@check",
      "  cur ← head @@start",
      "  for k ← 1 to i: cur ← cur.next @@walk",
      "  cur.prev.next ← cur.next @@fwd",
      "  cur.next.prev ← cur.prev @@back",
      "  size ← size - 1 @@size",
      "  return cur.data @@ret",
    ],
    java: [
      "double remove(int i) {",
      "  if (i < 1 || i >= size - 1) throw new IndexOutOfBoundsException(); @@check",
      "  Node cur = head; @@start",
      "  for (int k = 1; k <= i; k++) cur = cur.next; @@walk",
      "  cur.prev.next = cur.next; @@fwd",
      "  cur.next.prev = cur.prev; @@back",
      "  size--; @@size",
      "  return cur.data; @@ret",
      "}",
    ],
  };
  CODE.d_backward = {
    title: "walk backward — doubly linked",
    pseudo: ["printBackward():", "  cur ← tail @@start", "  while cur ≠ null: @@loop", "    visit(cur.data) @@visit", "    cur ← cur.prev          // only possible with prev links @@next"],
    java: ["void printBackward() {", "  Node cur = tail; @@start", "  while (cur != null) { @@loop", "    visit(cur.data); @@visit", "    cur = cur.prev; @@next", "  }", "}"],
  };

  /* ---------- circularly linked list (tail only; head = tail.next) ---------- */
  CODE.c_addFirst = {
    title: "addFirst(x) — circularly linked",
    pseudo: [
      "addFirst(x):",
      "  node ← new Node(x) @@alloc",
      "  if tail == null: @@empty",
      "    tail ← node;  node.next ← node      // a ring of one @@empty",
      "  else:",
      "    node.next ← tail.next               // the old head @@link",
      "    tail.next ← node @@splice",
      "  size ← size + 1 @@size",
    ],
    java: [
      "void addFirst(double x) {",
      "  Node node = new Node(x); @@alloc",
      "  if (tail == null) { @@empty",
      "    tail = node;  node.next = node; @@empty",
      "  } else {",
      "    node.next = tail.next; @@link",
      "    tail.next = node; @@splice",
      "  }",
      "  size++; @@size",
      "}",
    ],
  };
  CODE.c_addLast = {
    title: "addLast(x) — circularly linked",
    pseudo: [
      "addLast(x):",
      "  addFirst(x)             // new node sits right after tail @@first",
      "  tail ← tail.next        // …so make it the tail @@tail",
    ],
    java: ["void addLast(double x) {", "  addFirst(x); @@first", "  tail = tail.next; @@tail", "}"],
  };
  CODE.c_removeFirst = {
    title: "removeFirst() — circularly linked",
    pseudo: [
      "removeFirst():",
      "  if tail == null: error \"empty\" @@check",
      "  head ← tail.next @@save",
      "  if head == tail: tail ← null      // it was the only node @@one",
      "  else: tail.next ← head.next @@unlink",
      "  size ← size - 1 @@size",
      "  return head.data @@ret",
    ],
    java: [
      "double removeFirst() {",
      "  if (tail == null) throw new NoSuchElementException(); @@check",
      "  Node head = tail.next; @@save",
      "  if (head == tail) tail = null; @@one",
      "  else tail.next = head.next; @@unlink",
      "  size--; @@size",
      "  return head.data; @@ret",
      "}",
    ],
  };
  CODE.c_rotate = {
    title: "rotate() — circularly linked",
    pseudo: ["rotate():                  // front element moves to the back", "  if tail ≠ null: @@check", "    tail ← tail.next        // one pointer move, O(1) @@rot"],
    java: ["void rotate() {", "  if (tail != null) @@check", "    tail = tail.next; @@rot", "}"],
  };
  CODE.c_indexOf = {
    title: "indexOf(x) — circularly linked",
    pseudo: [
      "indexOf(x):",
      "  if tail == null: return -1 @@check",
      "  cur ← tail.next;  i ← 0 @@start",
      "  do:",
      "    if cur.data == x: return i @@cmp",
      "    cur ← cur.next;  i ← i + 1 @@next",
      "  while cur ≠ tail.next      // there is no null: stop after one lap @@loop",
      "  return -1 @@miss",
    ],
    java: [
      "int indexOf(double x) {",
      "  if (tail == null) return -1; @@check",
      "  Node cur = tail.next;  int i = 0; @@start",
      "  do {",
      "    if (cur.data == x) return i; @@cmp",
      "    cur = cur.next;  i++; @@next",
      "  } while (cur != tail.next); @@loop",
      "  return -1; @@miss",
      "}",
    ],
  };

  /* ============================================================
     SPECS — what each function does, shown above its code
     ============================================================ */
  const M = (t) => "<span class='mono'>" + t + "</span>";
  D.specs(CODE, {
    get: { does: "Returns the element at index " + M("i") + ".", params: M("i") + " — an index in [0, n)", returns: "the element " + M("A[i]"), errors: "index out of bounds if " + M("i < 0") + " or " + M("i ≥ n"), time: "O(1) — one address calculation, no scanning", space: "O(1)" },
    set: { does: "Overwrites the element at index " + M("i") + " with " + M("x") + ".", params: M("i") + " — an index in [0, n) · " + M("x") + " — the new value (any number)", returns: "nothing", errors: "index out of bounds if " + M("i ∉ [0, n)"), time: "O(1)", space: "O(1)" },
    remove: { does: "Removes and returns the element at index " + M("i") + ", shifting everything after it one slot left.", params: M("i") + " — an index in [0, n)", returns: "the removed element", errors: "index out of bounds if " + M("i ∉ [0, n)"), time: "O(n) — n − i − 1 shifts, worst at i = 0", space: "O(1)" },
    indexOf: { does: "Finds the first index holding " + M("x") + ".", params: M("x") + " — the value to look for", returns: "its index, or −1 if absent", errors: "none", time: "O(n) — linear search, no order to exploit", space: "O(1)" },
    fa_add: { does: "Appends " + M("x") + " after the last element of a fixed-capacity array.", params: M("x") + " — the value to append (any number)", returns: "nothing", errors: "array is full when " + M("n == capacity") + " — a fixed array cannot grow", time: "O(1)", space: "O(1)" },
    fa_insert: { does: "Inserts " + M("x") + " at index " + M("i") + ", shifting " + M("A[i..n−1]") + " one slot right.", params: M("i") + " — a position in [0, n] (n = append) · " + M("x") + " — the value (any number)", returns: "nothing", errors: "index out of bounds if " + M("i ∉ [0, n]") + "; array is full if " + M("n == capacity"), time: "O(n) — n − i shifts, worst at i = 0", space: "O(1)" },
    da_add_geo: { does: "Appends " + M("x") + "; when the array is full it first grows to <b>double</b> the capacity.", params: M("x") + " — the value to append (any number)", returns: "nothing", errors: "none — the array grows instead of failing", time: "O(n) — when the array is full every element is copied into the new one; any other add is O(1)", space: "O(n) — the new array made by a resize" },
    da_add_arith: { does: "Appends " + M("x") + "; when the array is full it first grows by a <b>constant 2</b> slots.", params: M("x") + " — the value to append (any number)", returns: "nothing", errors: "none", time: "O(n) — when the array is full every element is copied; with +2 growth that happens every other add", space: "O(n) — the new array made by a resize" },
    da_insert_geo: { does: "Inserts " + M("x") + " at index " + M("i") + ", doubling the capacity first if the array is full.", params: M("i") + " — a position in [0, n] · " + M("x") + " — the value (any number)", returns: "nothing", errors: "index out of bounds if " + M("i ∉ [0, n]"), time: "O(n) — shifting, plus copying when it resizes", space: "O(n) — the new array made by a resize" },
    da_insert_arith: { does: "Inserts " + M("x") + " at index " + M("i") + ", growing by 2 slots first if the array is full.", params: M("i") + " — a position in [0, n] · " + M("x") + " — the value (any number)", returns: "nothing", errors: "index out of bounds if " + M("i ∉ [0, n]"), time: "O(n) — shifting, plus copying when it resizes", space: "O(n) — the new array made by a resize" },
    g_get: { does: "Reads the cell at row " + M("r") + ", column " + M("c") + ".", params: M("r") + " — row in [0, rows) · " + M("c") + " — column in [0, cols)", returns: M("M[r][c]"), errors: "index out of bounds if either index is out of range", time: "O(1) — the address is r · cols + c", space: "O(1)" },
    g_set: { does: "Writes " + M("x") + " into row " + M("r") + ", column " + M("c") + ".", params: M("r") + ", " + M("c") + " — cell position · " + M("x") + " — the value (any number)", returns: "nothing", errors: "index out of bounds if either index is out of range", time: "O(1)", space: "O(1)" },
    g_rowmajor: { does: "Visits every cell row by row — the order the cells sit in memory.", params: M("m") + " — the 2-D array", returns: "nothing (visits each cell)", errors: "none", time: "O(rows · cols) — and cache-friendly, because each step is the next address", space: "O(1)" },
    g_colmajor: { does: "Visits every cell column by column, jumping a whole row ahead in memory each step.", params: M("m") + " — the 2-D array", returns: "nothing (visits each cell)", errors: "none", time: "O(rows · cols) — but each step jumps cols cells in memory, so it is slower on large arrays", space: "O(1)" },
    g_rowsum: { does: "Adds up the values in row " + M("r") + ".", params: M("r") + " — a row in [0, rows)", returns: "the sum of the row", errors: "index out of bounds if " + M("r ∉ [0, rows)"), time: "O(cols)", space: "O(1)" },
    g_find: { does: "Searches every cell, row by row, for " + M("x") + ".", params: M("x") + " — the value to look for", returns: "its (row, column), or (−1, −1) if absent", errors: "none", time: "O(rows · cols)", space: "O(1)" },
    s_addFirst: { does: "Puts a new node holding " + M("x") + " at the front of a singly linked list.", params: M("x") + " — the value (any number)", returns: "nothing", errors: "none", time: "O(1) — two pointer writes, no traversal", space: "O(1) — one new node" },
    s_addLast: { does: "Puts a new node holding " + M("x") + " at the back, using the tail reference.", params: M("x") + " — the value (any number)", returns: "nothing", errors: "none", time: "O(1) — thanks to the tail pointer", space: "O(1) — one new node" },
    s_insert: { does: "Inserts " + M("x") + " so that it ends up at index " + M("i") + ", by walking to the node before it.", params: M("i") + " — a position in [1, size] (0 is addFirst) · " + M("x") + " — the value (any number)", returns: "nothing", errors: "index out of bounds if " + M("i ∉ [1, size]"), time: "O(n) — the walk to node i − 1; the splice itself is O(1)", space: "O(1) — one new node" },
    s_removeFirst: { does: "Unlinks and returns the first node's value.", params: "none", returns: "the removed value", errors: "list is empty if " + M("head == null"), time: "O(1)", space: "O(1)" },
    s_removeLast: { does: "Unlinks and returns the last node's value. A singly linked list must walk to find the node before the tail.", params: "none", returns: "the removed value", errors: "list is empty (via removeFirst when there are 0 nodes)", time: "O(n) — the walk to the second-to-last node", space: "O(1)" },
    s_remove: { does: "Removes the node at index " + M("i") + " by walking to its predecessor and bypassing it.", params: M("i") + " — a position in [1, size) (0 is removeFirst)", returns: "the removed value", errors: "index out of bounds if " + M("i ∉ [1, size)"), time: "O(n) — the walk to node i − 1", space: "O(1)" },
    l_indexOf: { does: "Follows next pointers from the head until it finds " + M("x") + ".", params: M("x") + " — the value to look for", returns: "its index, or −1 if absent", errors: "none", time: "O(n)", space: "O(1)" },
    s_reverse: { does: "Reverses the list in place by flipping every next pointer.", params: "none", returns: "nothing (head and tail swap roles)", errors: "none — works for 0 or 1 nodes too", time: "O(n) — one pass", space: "O(1) — three pointers, no copy of the list" },
    d_addFirst: { does: "Puts a new node at the front of a doubly linked list, linking it both ways.", params: M("x") + " — the value (any number)", returns: "nothing", errors: "none", time: "O(1)", space: "O(1) — one new node" },
    d_addLast: { does: "Puts a new node at the back, linking it both ways.", params: M("x") + " — the value (any number)", returns: "nothing", errors: "none", time: "O(1)", space: "O(1) — one new node" },
    d_insert: { does: "Splices " + M("x") + " in before the node currently at index " + M("i") + ".", params: M("i") + " — a position in [1, size) (0 is addFirst, size is addLast) · " + M("x") + " — the value (any number)", returns: "nothing", errors: "index out of bounds if " + M("i ∉ [1, size)"), time: "O(n) — the walk; then four pointer writes", space: "O(1) — one new node" },
    d_removeFirst: { does: "Unlinks and returns the first node's value.", params: "none", returns: "the removed value", errors: "list is empty if " + M("head == null"), time: "O(1)", space: "O(1)" },
    d_removeLast: { does: "Unlinks and returns the last node's value using " + M("tail.prev") + " — no walk.", params: "none", returns: "the removed value", errors: "list is empty if " + M("tail == null"), time: "O(1) — tail.prev, no walk", space: "O(1)" },
    d_remove: { does: "Removes the node at index " + M("i") + " by making its neighbours point past it.", params: M("i") + " — a position in [1, size − 1)", returns: "the removed value", errors: "index out of bounds if " + M("i ∉ [1, size − 1)"), time: "O(n) — the walk; O(1) if you already hold the node", space: "O(1)" },
    d_backward: { does: "Visits every value from the tail back to the head using prev links.", params: "none", returns: "nothing (visits each value)", errors: "none", time: "O(n)", space: "O(1)" },
    c_addFirst: { does: "Adds " + M("x") + " as the new head of a circular list — the node right after the tail.", params: M("x") + " — the value (any number)", returns: "nothing", errors: "none", time: "O(1)", space: "O(1) — one new node" },
    c_addLast: { does: "Adds " + M("x") + " at the back: addFirst, then move the tail one step forward.", params: M("x") + " — the value (any number)", returns: "nothing", errors: "none", time: "O(1)", space: "O(1) — one new node" },
    c_removeFirst: { does: "Removes and returns the head (the node after the tail) and closes the ring past it.", params: "none", returns: "the removed value", errors: "list is empty if " + M("tail == null"), time: "O(1)", space: "O(1)" },
    c_rotate: { does: "Moves the front element to the back by advancing the tail pointer — nothing is unlinked.", params: "none", returns: "nothing", errors: "none — does nothing on an empty ring", time: "O(1)", space: "O(1)" },
    c_indexOf: { does: "Walks once around the ring looking for " + M("x") + ", stopping after a full lap.", params: M("x") + " — the value to look for", returns: "its index, or −1 if absent", errors: "none", time: "O(n)", space: "O(1)" },
  });

  /* ============================================================
     CLASSES — the fields each method reads and writes. get, set, remove,
     indexOf and the linked-list indexOf are shared by two tabs, so
     selectTab() points them at the class of the tab on screen.
     ============================================================ */
  const NODE1 = {
    pseudo: [
      "  class Node:                // one box in the chain",
      "    data                     // the value stored in this node",
      "    next                     // the next node, or null at the end",
      "    constructor(x):          // new Node(x) makes a node holding x",
      "      data ← x",
      "      next ← null",
    ],
    java: [
      "  private static class Node {   // one box in the chain",
      "    double data;                // the value stored in this node",
      "    Node next;                  // the next node, or null at the end",
      "    Node(double data) {         // constructor: new Node(5) makes a node holding 5",
      "      this.data = data;         // this.data is the field, data is the parameter",
      "      this.next = null;",
      "    }",
      "  }",
    ],
  };
  const NODE2 = {
    pseudo: [
      "  class Node:                // one box in the chain",
      "    data                     // the value stored in this node",
      "    next                     // the next node, or null at the end",
      "    prev                     // the previous node, or null at the front",
      "    constructor(x):          // new Node(x) makes a node holding x",
      "      data ← x",
      "      next ← null;  prev ← null",
    ],
    java: [
      "  private static class Node {   // one box in the chain",
      "    double data;                // the value stored in this node",
      "    Node next;                  // the next node, or null at the end",
      "    Node prev;                  // the previous node, or null at the front",
      "    Node(double data) {         // constructor: new Node(5) makes a node holding 5",
      "      this.data = data;         // this.data is the field, data is the parameter",
      "      this.next = null;",
      "      this.prev = null;",
      "    }",
      "  }",
    ],
  };
  const CLS = {
    fixed: { name: "FixedArray",
      note: "This page's array was created with <span class='mono'>new FixedArray(8)</span>.",
      pseudo: [
        "class FixedArray:",
        "  A                        // array of capacity cells; capacity never changes",
        "  n                        // how many cells are in use: A[0] … A[n-1]",
        "",
        "  constructor(capacity):   // runs once, when the array is created",
        "    A ← new array of capacity cells",
        "    n ← 0",
      ],
      java: [
        "public class FixedArray {",
        "  private double[] a;      // the cells; a.length is the capacity and never changes",
        "  private int n;           // how many cells are in use: a[0] … a[n-1]",
        "",
        "  public FixedArray(int capacity) {   // constructor: runs on new FixedArray(8)",
        "    a = new double[capacity];",
        "    n = 0;",
        "  }",
        "",
        "  // the methods below use a and n",
        "}",
      ] },
    dynamic: { name: "DynamicArray",
      note: "Created with <span class='mono'>new DynamicArray()</span>, which starts with capacity 4.",
      pseudo: [
        "class DynamicArray:",
        "  A                        // the current backing array; replaced when it fills up",
        "  n                        // how many cells are in use: A[0] … A[n-1]",
        "",
        "  constructor():",
        "    A ← new array of 4 cells",
        "    n ← 0",
      ],
      java: [
        "public class DynamicArray {",
        "  private double[] a;      // the current backing array; resize() replaces it",
        "  private int n;           // how many cells are in use: a[0] … a[n-1]",
        "",
        "  public DynamicArray() {  // constructor: runs on new DynamicArray()",
        "    a = new double[4];",
        "    n = 0;",
        "  }",
        "",
        "  // the methods below use a and n",
        "}",
      ] },
    single: { name: "SinglyLinkedList",
      note: "Each <span class='mono'>Node</span> object is one box on the stage; <span class='mono'>next</span> is its arrow.",
      pseudo: [
        "class SinglyLinkedList:",
      ].concat(NODE1.pseudo, [
        "",
        "  head                     // the first node, or null when the list is empty",
        "  tail                     // the last node, or null when the list is empty",
        "  size                     // number of nodes",
        "",
        "  constructor():",
        "    head ← null;  tail ← null;  size ← 0",
      ]),
      java: [
        "public class SinglyLinkedList {",
      ].concat(NODE1.java, [
        "",
        "  private Node head;       // the first node, or null when the list is empty",
        "  private Node tail;       // the last node, or null when the list is empty",
        "  private int size;        // number of nodes",
        "",
        "  public SinglyLinkedList() {",
        "    head = null;  tail = null;  size = 0;",
        "  }",
        "",
        "  // the methods below use head, tail and size",
        "}",
      ]) },
    double: { name: "DoublyLinkedList",
      note: "Each <span class='mono'>Node</span> object is one box on the stage, with an arrow each way.",
      pseudo: [
        "class DoublyLinkedList:",
      ].concat(NODE2.pseudo, [
        "",
        "  head                     // the first node, or null when the list is empty",
        "  tail                     // the last node, or null when the list is empty",
        "  size                     // number of nodes",
        "",
        "  constructor():",
        "    head ← null;  tail ← null;  size ← 0",
      ]),
      java: [
        "public class DoublyLinkedList {",
      ].concat(NODE2.java, [
        "",
        "  private Node head;       // the first node, or null when the list is empty",
        "  private Node tail;       // the last node, or null when the list is empty",
        "  private int size;        // number of nodes",
        "",
        "  public DoublyLinkedList() {",
        "    head = null;  tail = null;  size = 0;",
        "  }",
        "",
        "  // the methods below use head, tail and size",
        "}",
      ]) },
    circular: { name: "CircularlyLinkedList",
      note: "There is no head field: the head is always <span class='mono'>tail.next</span>.",
      pseudo: [
        "class CircularlyLinkedList:",
      ].concat(NODE1.pseudo, [
        "",
        "  tail                     // the last node (its next is the head), or null when empty",
        "  size                     // number of nodes",
        "",
        "  constructor():",
        "    tail ← null;  size ← 0",
      ]),
      java: [
        "public class CircularlyLinkedList {",
      ].concat(NODE1.java, [
        "",
        "  private Node tail;       // the last node (tail.next is the head), or null when empty",
        "  private int size;        // number of nodes",
        "",
        "  public CircularlyLinkedList() {",
        "    tail = null;  size = 0;",
        "  }",
        "",
        "  // the methods below use tail and size",
        "}",
      ]) },
  };
  D.classes(CODE, [
    Object.assign({ keys: /^fa_/ }, CLS.fixed),
    Object.assign({ keys: /^da_/ }, CLS.dynamic),
    Object.assign({ keys: /^s_/ }, CLS.single),
    Object.assign({ keys: /^d_/ }, CLS.double),
    Object.assign({ keys: /^c_/ }, CLS.circular),
  ]);
  /* the listings two tabs share follow the tab on screen */
  function shareClass(tabId) {
    const c = CLS[tabId] || null;
    ["get", "set", "remove", "indexOf", "l_indexOf"].forEach((k) => (CODE[k].cls = c));
  }

  /* ============================================================
     STATE
     ============================================================ */
  const FA = { cap: 8, a: new Array(8).fill(null), n: 0 };
  const DA = { cap: 4, a: new Array(4).fill(null), n: 0, copies: 0, grows: 0, geo: true, history: [4] };
  const G2 = { rows: 4, cols: 5, m: [] };
  const LL = { single: [], double: [], circular: [] };
  let tab = "fixed", player, dock;

  /* ============================================================
     FIXED ARRAY
     ============================================================ */
  /** the operation's guard fails: light the check line, report the error, change nothing */
  function fail(r, line, why, extra) {
    r.at(line).snap(Object.assign({ note: "<b style='color:var(--c-swap)'>✗ Error:</b> " + why + " The operation stops here and the structure is unchanged." }, extra || {}));
    return r;
  }
  function faRec() {
    return D.Rec(() => ({ kind: "fa", a: FA.a.slice(), n: FA.n, cap: FA.cap, marks: {} }));
  }
  const fa = {
    add(v) {
      const r = faRec().code("fa_add");
      r.snap({ note: "<b>add(" + v + ")</b> — append after the last element. n = " + FA.n + ", capacity = " + FA.cap + " (fixed when the array was created)." });
      if (FA.n === FA.cap) {
        r.at("full").snap({ marks: allMarks(FA.n, "swap"), note: "<b>The array is full.</b> A fixed array can never grow: its size was decided at <span class='mono'>new double[" + FA.cap + "]</span>. The only options are to fail or copy everything into a bigger array — which is exactly what a <b>dynamic array</b> automates." });
        return r;
      }
      r.at("full^").snap({ note: "n = " + FA.n + " &lt; " + FA.cap + ", so there is room." });
      FA.a[FA.n] = v;
      r.at("write").snap({ marks: { [FA.n]: "done" }, note: "Write " + v + " into slot n = " + FA.n + "." });
      FA.n++;
      r.at("size").snap({ marks: { [FA.n - 1]: "done" }, note: "Bump n to " + FA.n + ". No shifting, so add at the end is <b>O(1)</b>." });
      return r;
    },
    insert(i, v) {
      const r = faRec().code("fa_insert");
      r.snap({ marks: { [i]: "target" }, note: "<b>insert(" + i + ", " + v + ")</b> — everything from index " + i + " onwards has to slide one slot right." });
      if (i < 0 || i > FA.n) return fail(r, "check", "index " + i + " is outside [0, n] = [0, " + FA.n + "]. An insert may go anywhere from the front up to just past the last element, and nowhere else.");
      r.at("check^").snap({ marks: { [i]: "target" }, note: "0 ≤ " + i + " ≤ n = " + FA.n + " — a valid position." });
      if (FA.n === FA.cap) {
        r.at("full").snap({ marks: allMarks(FA.n, "swap"), note: "<b>Full</b> — no free slot to shift into. A fixed array fails here." });
        return r;
      }
      r.at("full^").snap({ note: "There is at least one free slot at the end." });
      for (let k = FA.n - 1; k >= i; k--) {
        FA.a[k + 1] = FA.a[k];
        r.at("shift").snap({ marks: { [k + 1]: "swap", [k]: "cmp" }, note: "Shift A[" + k + "] = " + FA.a[k] + " right into slot " + (k + 1) + ". Work backwards so nothing is overwritten." });
      }
      FA.a[i] = v;
      r.at("write").snap({ marks: { [i]: "done" }, note: "Drop " + v + " into the gap at index " + i + "." });
      FA.n++;
      r.at("size").snap({ marks: { [i]: "done" }, note: "n = " + FA.n + ". That took " + (FA.n - 1 - i) + " shift(s): insert is <b>O(n)</b>, worst at index 0." });
      return r;
    },
    remove(i) { return removeAt(FA, faRec, i); },
    get(i) { return getAt(FA, faRec, i); },
    set(i, v) {
      const r = faRec().code("set");
      r.snap({ note: "<b>set(" + i + ", " + v + ")</b>." });
      if (i < 0 || i >= FA.n) return fail(r, "check", "index " + i + " is outside [0, n) = [0, " + FA.n + ")." + (i >= FA.n && i < FA.cap ? " Slot " + i + " exists in memory, but it is not part of the list yet." : ""));
      r.at("check^").snap({ marks: { [i]: "target" }, note: "Index " + i + " is inside [0, n)." });
      const old = FA.a[i];
      FA.a[i] = v;
      r.at("write").snap({ marks: { [i]: "done" }, note: "Overwrite " + old + " with " + v + " — one write, <b>O(1)</b>, nothing moves." });
      return r;
    },
    indexOf(v) { return linearSearch(FA, faRec, v); },
  };

  /* shared array operations (fixed and dynamic behave identically here) */
  function removeAt(S, mk, i) {
    const r = mk().code("remove");
    const v = S.a[i];
    if (i < 0 || i >= S.n) { r.snap({ note: "<b>remove(" + i + ")</b>." }); return fail(r, "check", S.n ? "index " + i + " is outside [0, n) = [0, " + S.n + ")." : "the array is empty (n = 0), so there is no index to remove."); }
    r.snap({ marks: { [i]: "swap" }, note: "<b>remove(" + i + ")</b> — take out A[" + i + "] = " + v + " and close the gap." });
    r.at("check^").snap({ marks: { [i]: "swap" }, note: "0 ≤ " + i + " &lt; n = " + S.n + " — valid." });
    r.at("save").snap({ marks: { [i]: "target" }, note: "Save x = " + v + " to return later." });
    for (let k = i; k < S.n - 1; k++) {
      S.a[k] = S.a[k + 1];
      r.at("shift").snap({ marks: { [k]: "swap", [k + 1]: "cmp" }, note: "Shift A[" + (k + 1) + "] = " + S.a[k] + " left into slot " + k + "." });
    }
    S.a[S.n - 1] = null;
    S.n--;
    r.at("clear").snap({ note: "Clear the old last slot and set n = " + S.n + "." + (S.copies != null ? " Capacity stays " + S.cap + " — removing does not shrink the array." : "") });
    r.at("ret").snap({ note: "Return " + v + ". " + (S.n - i) + " shift(s): remove is <b>O(n)</b>, worst at index 0." });
    return r;
  }
  function getAt(S, mk, i) {
    const r = mk().code("get");
    r.snap({ note: "<b>get(" + i + ")</b>." });
    if (i < 0 || i >= S.n) return fail(r, "check", "index " + i + " is outside [0, n) = [0, " + S.n + ")." + (i >= S.n && i < S.cap ? " Slot " + i + " is allocated, but it holds no element — reading it would return garbage, so the check refuses." : ""));
    r.at("check^").snap({ marks: { [i]: "cmp" }, note: "Bounds check: 0 ≤ " + i + " &lt; n = " + S.n + "." });
    r.at("ret").snap({ marks: { [i]: "target" }, note: "Address = base + " + i + " × cellSize — one multiply and one add, then a single read: <b>A[" + i + "] = " + S.a[i] + "</b>. No scanning. <b>O(1) random access</b> is the reason arrays exist." });
    return r;
  }
  function linearSearch(S, mk, v) {
    const r = mk().code("indexOf");
    r.snap({ note: "<b>indexOf(" + v + ")</b> — an unsorted array has no shortcut, so scan from the left." });
    for (let i = 0; i < S.n; i++) {
      r.at("loop").snap({ marks: { [i]: "active" }, note: "i = " + i + "." });
      if (S.a[i] === v) {
        r.at("cmp").snap({ marks: { [i]: "done" }, note: "A[" + i + "] = " + v + " — <b>found at index " + i + "</b> after " + (i + 1) + " comparison(s)." });
        return r;
      }
      r.at("cmp").snap({ marks: { [i]: "cmp" }, note: "A[" + i + "] = " + S.a[i] + " ≠ " + v + ", keep going." });
    }
    r.at("miss").snap({ note: "Reached n without a match — return <b>−1</b>. Linear search is <b>O(n)</b>." });
    return r;
  }
  const allMarks = (n, cls) => { const m = {}; for (let i = 0; i < n; i++) m[i] = cls; return m; };

  /* ============================================================
     DYNAMIC ARRAY
     ============================================================ */
  function daRec() {
    return D.Rec(() => ({
      kind: "da", a: DA.a.slice(), n: DA.n, cap: DA.cap, marks: {}, copies: DA.copies, grows: DA.grows,
      geo: DA.geo, history: DA.history.slice(),
    }));
  }
  const newCap = () => (DA.geo ? Math.max(1, DA.cap * 2) : DA.cap + 2);

  function daGrow(r) {
    const old = DA.a.slice();
    const nc = newCap();
    r.at("full").snap({ marks: allMarks(DA.n, "swap"), note: "The array is <b>full</b>: n = " + DA.n + " = capacity. There is no room to write into." });
    r.at("grow").snap({ note: "Call resize(" + nc + "). " + (DA.geo ? "The new capacity is <b>double</b> the old one (" + DA.cap + " × 2)." : "The new capacity is the old one <b>plus 2</b> (" + DA.cap + " + 2).") });
    DA.cap = nc;
    DA.a = new Array(nc).fill(null);
    DA.grows++;
    DA.history.push(nc);
    const n = DA.n;
    DA.n = 0;
    r.at("alloc").snap({ src: { a: old, marks: {} }, note: "Allocate B, a fresh array of " + nc + " empty slots. The old array is still there until we finish copying." });
    for (let k = 0; k < n; k++) {
      DA.a[k] = old[k];
      DA.n = k + 1;
      DA.copies++;
      r.at("copy").snap({ marks: { [k]: "swap" }, src: { a: old, marks: { [k]: "cmp" } }, note: "Copy old[" + k + "] = " + old[k] + " → B[" + k + "]. Copies so far: <b>" + DA.copies + "</b>." });
    }
    DA.n = n;
    r.at("swap").snap({ note: "A ← B. The old array is garbage now. Capacities so far: <span class='mono'>" + DA.history.join(" → ") + "</span>" + (DA.geo ? " — a geometric progression." : " — an arithmetic progression.") });
  }
  const da = {
    add(v) {
      const r = daRec().code(DA.geo ? "da_add_geo" : "da_add_arith");
      r.snap({ note: "<b>add(" + v + ")</b> — n = " + DA.n + ", capacity = " + DA.cap + "." });
      if (DA.n === DA.cap) daGrow(r);
      else r.at("full^").snap({ note: "n = " + DA.n + " &lt; capacity " + DA.cap + " — there is room, no resize needed." });
      DA.a[DA.n] = v;
      r.at("write").snap({ marks: { [DA.n]: "done" }, note: "Write " + v + " into slot " + DA.n + "." });
      DA.n++;
      r.at("size").snap({ marks: { [DA.n - 1]: "done" }, note: "n = " + DA.n + ". Most adds are this cheap: <b>O(1)</b>." });
      return r;
    },
    insert(i, v) {
      const r = daRec().code(DA.geo ? "da_insert_geo" : "da_insert_arith");
      r.snap({ marks: { [i]: "target" }, note: "<b>insert(" + i + ", " + v + ")</b>." });
      if (i < 0 || i > DA.n) return fail(r, "check", "index " + i + " is outside [0, n] = [0, " + DA.n + "]. Growing only adds room at the end — it never makes an index like this valid.");
      r.at("check^").snap({ marks: { [i]: "target" }, note: "0 ≤ " + i + " ≤ n = " + DA.n + " — valid." });
      if (DA.n === DA.cap) daGrow(r);
      else r.at("full^").snap({ note: "There is a free slot, so no resize." });
      for (let k = DA.n - 1; k >= i; k--) {
        DA.a[k + 1] = DA.a[k];
        r.at("shift").snap({ marks: { [k + 1]: "swap", [k]: "cmp" }, note: "Shift A[" + k + "] = " + DA.a[k] + " right into slot " + (k + 1) + "." });
      }
      DA.a[i] = v;
      r.at("write").snap({ marks: { [i]: "done" }, note: "Write " + v + " into the gap at " + i + "." });
      DA.n++;
      r.at("size").snap({ marks: { [i]: "done" }, note: "n = " + DA.n + ". Shifting makes insert <b>O(n)</b> no matter how the array grows." });
      return r;
    },
    remove(i) { return removeAt(DA, daRec, i); },
    get(i) { return getAt(DA, daRec, i); },
    indexOf(v) { return linearSearch(DA, daRec, v); },
  };
  function daReset(cap) {
    DA.cap = cap; DA.a = new Array(cap).fill(null); DA.n = 0; DA.copies = 0; DA.grows = 0; DA.history = [cap];
  }

  /* ============================================================
     2-D ARRAY
     ============================================================ */
  function g2Rec() {
    return D.Rec(() => ({ kind: "g2", rows: G2.rows, cols: G2.cols, m: G2.m.map((row) => row.slice()), marks: {}, acc: null }));
  }
  const key2 = (r, c) => r + "," + c;
  const g2In = (r, c) => r >= 0 && r < G2.rows && c >= 0 && c < G2.cols;
  const g2Why = (r, c) => (r < 0 || r >= G2.rows ? "row " + r + " is outside [0, " + G2.rows + ")" : "column " + c + " is outside [0, " + G2.cols + ")") + ". (Some languages let a negative index wrap around to the other end. Java throws instead, and the check makes that explicit.)";
  const g2 = {
    get(r0, c0) {
      const r = g2Rec().code("g_get");
      const k = r0 * G2.cols + c0;
      r.snap({ note: "<b>get(" + r0 + ", " + c0 + ")</b> on a " + G2.rows + " × " + G2.cols + " array." });
      if (!g2In(r0, c0)) return fail(r, "check", g2Why(r0, c0));
      r.at("check^").snap({ marks: { ["r" + r0]: "cmp", ["c" + c0]: "cmp" }, note: "Row " + r0 + " is in [0, " + G2.rows + ") and column " + c0 + " is in [0, " + G2.cols + ")." });
      r.at("flat").snap({ marks: { [key2(r0, c0)]: "cmp", ["r" + r0]: "cmp", ["c" + c0]: "cmp" }, flat: { [k]: "cmp" }, note: "Find the cell. In the pseudocode the array is one row-major block, so the flat index is <span class='mono'>r · cols + c = " + r0 + " · " + G2.cols + " + " + c0 + " = " + k + "</span>. In Java, <span class='mono'>m[" + r0 + "]</span> first fetches row " + r0 + "'s own array, and <span class='mono'>[" + c0 + "]</span> then indexes into it." });
      r.at("ret").snap({ marks: { [key2(r0, c0)]: "target" }, flat: { [k]: "target" }, note: "One read: <b>M[" + r0 + "][" + c0 + "] = " + G2.m[r0][c0] + "</b>. Still O(1). A 2-D array is just a 1-D array plus a little arithmetic." });
      return r;
    },
    set(r0, c0, v) {
      const r = g2Rec().code("g_set");
      const k = r0 * G2.cols + c0;
      r.snap({ note: "<b>set(" + r0 + ", " + c0 + ", " + v + ")</b>." });
      if (!g2In(r0, c0)) return fail(r, "check", g2Why(r0, c0));
      r.at("check^").snap({ marks: { ["r" + r0]: "cmp", ["c" + c0]: "cmp" }, note: "Both indices are in range." });
      r.at("flat").snap({ marks: { [key2(r0, c0)]: "cmp" }, flat: { [k]: "cmp" }, note: "Locate the cell: flat index " + r0 + " · " + G2.cols + " + " + c0 + " = " + k + " (pseudocode), or row " + r0 + "'s array then column " + c0 + " (Java)." });
      G2.m[r0][c0] = v;
      r.at("write").snap({ marks: { [key2(r0, c0)]: "done" }, flat: { [k]: "done" }, note: "Write " + v + ". <b>O(1)</b>." });
      return r;
    },
    traverse(rowMajor) {
      const r = g2Rec().code(rowMajor ? "g_rowmajor" : "g_colmajor");
      const order = [];
      r.snap({ note: "<b>" + (rowMajor ? "Row" : "Column") + "-major traversal</b> — watch the memory strip underneath." });
      const outerN = rowMajor ? G2.rows : G2.cols, innerN = rowMajor ? G2.cols : G2.rows;
      for (let a = 0; a < outerN; a++) {
        r.at("outer").snap({ marks: seen(order, rowMajor ? { ["r" + a]: "active" } : { ["c" + a]: "active" }), flat: seenFlat(order), note: (rowMajor ? "Row " : "Column ") + a + "." });
        for (let b = 0; b < innerN; b++) {
          const rr = rowMajor ? a : b, cc = rowMajor ? b : a;
          const k = rr * G2.cols + cc;
          const prev = order.length ? order[order.length - 1] : null;
          order.push(k);
          const jump = prev == null ? "" : k - prev === 1 ? " — the very next cell in memory." : " — a jump of " + (k - prev) + " cells in memory.";
          r.at(["inner", "visit"]).snap({
            marks: Object.assign(seen(order.slice(0, -1)), { [key2(rr, cc)]: "active" }),
            flat: Object.assign(seenFlat(order.slice(0, -1)), { [k]: "active" }),
            note: "visit M[" + rr + "][" + cc + "] = " + G2.m[rr][cc] + " (flat index " + k + ")" + jump,
          });
        }
      }
      r.at(null).snap({ marks: seen(order), flat: seenFlat(order), note: rowMajor
        ? "Every step moved to the <b>next</b> memory cell. Caches load memory in blocks, so row-major traversal of a row-major array is the fast way."
        : "Each step jumped <b>" + G2.cols + "</b> cells. Same O(rows·cols) work, but on large arrays this stride misses the cache and can be several times slower." });
      return r;
      function seen(list, extra) { const m = {}; list.forEach((k) => (m[key2(Math.floor(k / G2.cols), k % G2.cols)] = "visit")); return Object.assign(m, extra || {}); }
      function seenFlat(list) { const m = {}; list.forEach((k) => (m[k] = "visit")); return m; }
    },
    rowSum(r0) {
      const r = g2Rec().code("g_rowsum");
      let s = 0;
      r.snap({ marks: { ["r" + r0]: "active" }, note: "<b>rowSum(" + r0 + ")</b>." });
      if (r0 < 0 || r0 >= G2.rows) return fail(r, "check", "row " + r0 + " is outside [0, " + G2.rows + ").");
      r.at("check^").snap({ marks: { ["r" + r0]: "active" }, note: "Row " + r0 + " exists." });
      r.at("init").snap({ marks: { ["r" + r0]: "active" }, acc: s, note: "s = 0." });
      const done = {};
      for (let c = 0; c < G2.cols; c++) {
        r.at("loop").snap({ marks: Object.assign({ ["r" + r0]: "active", [key2(r0, c)]: "cmp" }, done), acc: s, note: "c = " + c + "." });
        s = Math.round((s + G2.m[r0][c]) * 100) / 100;   /* keep decimal sums tidy (0.1 + 0.2 shows as 0.3) */
        done[key2(r0, c)] = "done";
        r.at("add").snap({ marks: Object.assign({ ["r" + r0]: "active" }, done), acc: s, note: "s += M[" + r0 + "][" + c + "] = " + G2.m[r0][c] + " → s = " + s + "." });
      }
      r.at("loop").snap({ marks: done, acc: s, note: "c = " + G2.cols + " — past the last column, the loop ends." });
      r.at("ret").snap({ marks: done, acc: s, note: "Return <b>" + s + "</b>. One pass over one row: O(cols)." });
      return r;
    },
    find(v) {
      const r = g2Rec().code("g_find");
      r.snap({ note: "<b>find(" + v + ")</b> — check every cell, row by row." });
      const seenM = {};
      for (let rr = 0; rr < G2.rows; rr++) {
        r.at("outer").snap({ marks: Object.assign({ ["r" + rr]: "active" }, seenM), note: "Row " + rr + "." });
        for (let cc = 0; cc < G2.cols; cc++) {
          if (G2.m[rr][cc] === v) {
            r.at(["inner", "cmp"]).snap({ marks: Object.assign({}, seenM, { [key2(rr, cc)]: "done" }), flat: { [rr * G2.cols + cc]: "done" }, note: "M[" + rr + "][" + cc + "] = " + v + " — <b>found at (" + rr + ", " + cc + ")</b>." });
            return r;
          }
          r.at(["inner", "cmp^"]).snap({ marks: Object.assign({}, seenM, { [key2(rr, cc)]: "cmp" }), note: "M[" + rr + "][" + cc + "] = " + G2.m[rr][cc] + " ≠ " + v + "." });
          seenM[key2(rr, cc)] = "visit";
        }
      }
      r.at("miss").snap({ marks: seenM, note: "Checked all " + G2.rows * G2.cols + " cells — <b>not found</b>. O(rows · cols)." });
      return r;
    },
  };
  function g2New(rows, cols) {
    G2.rows = rows; G2.cols = cols;
    G2.m = [];
    for (let r = 0; r < rows; r++) G2.m.push(D.randArray(cols, 1, 99));
  }

  /* ============================================================
     LINKED LISTS
     ============================================================ */
  function llRec(kind) {
    return D.Rec(() => ({ kind: "ll", lk: kind, vals: LL[kind].slice(), marks: {}, ptrs: {}, float: null, floatLinks: [], bypass: null, back: null }));
  }
  /** hop from the head to index `to`, one frame per hop, naming the walking pointer `name` */
  function walk(r, vals, to, name, lineStart, lineWalk, why) {
    r.at(lineStart).snap({ marks: { 0: "active" }, ptrs: { [name]: 0 }, note: name + " ← head. " + (why || "") });
    for (let i = 1; i <= to; i++)
      r.at(lineWalk).snap({ marks: { [i]: "active" }, ptrs: { [name]: i }, note: name + " ← " + name + ".next — now at node " + i + " (value " + vals[i] + "). Hop " + i + "." });
  }

  const sll = {
    addFirst(v) {
      const L = LL.single, r = llRec("single").code("s_addFirst");
      r.snap({ note: "<b>addFirst(" + v + ")</b>." });
      r.at("alloc").snap({ float: { v: v, at: -1 }, note: "Allocate a new node holding " + v + "." });
      r.at("link").snap({ float: { v: v, at: -1 }, floatLinks: L.length ? [0] : [], marks: L.length ? { 0: "cmp" } : {}, note: L.length ? "node.next ← head. Do this <em>first</em>: if head moved first, the rest of the list would be unreachable." : "head is null, so node.next is null too." });
      L.unshift(v);
      r.at("head").snap({ marks: { 0: "done" }, note: "head ← node." });
      r.at(L.length === 1 ? "tail" : "tail^").snap({ marks: { 0: "done" }, note: L.length === 1 ? "The list was empty, so the new node is also the tail." : "tail is unchanged." });
      r.at("size").snap({ marks: { 0: "done" }, note: "size = " + L.length + ". <b>O(1)</b> — no traversal at all." });
      return r;
    },
    addLast(v) {
      const L = LL.single, r = llRec("single").code("s_addLast");
      r.snap({ note: "<b>addLast(" + v + ")</b>." });
      r.at("alloc").snap({ float: { v: v, at: L.length - 1 }, note: "Allocate a new node holding " + v + "." });
      if (!L.length) {
        L.push(v);
        r.at("empty").snap({ marks: { 0: "done" }, note: "The list was empty — head ← node." });
      } else {
        r.at("link").snap({ float: { v: v, at: L.length - 1 }, marks: { [L.length - 1]: "cmp" }, note: "tail.next ← node. Because we keep a <b>tail</b> pointer, there is no walk." });
        L.push(v);
      }
      r.at("tail").snap({ marks: { [L.length - 1]: "done" }, note: "tail ← node." });
      r.at("size").snap({ marks: { [L.length - 1]: "done" }, note: "size = " + L.length + ". <b>O(1)</b> thanks to the tail reference." });
      return r;
    },
    insert(k, v) {
      const L = LL.single, r = llRec("single").code("s_insert");
      r.snap({ note: "<b>insert(" + k + ", " + v + ")</b> — we need the node <em>before</em> position " + k + "." });
      if (k < 1 || k > L.length) return fail(r, "check", "i = " + k + " is outside [1, size] = [1, " + L.length + "]." + (k === 0 ? " (Index 0 has no predecessor — that case is addFirst.)" : ""));
      r.at("check^").snap({ note: "1 ≤ " + k + " ≤ size = " + L.length + "." });
      walk(r, L, k - 1, "prev", "start", "walk", "Walk to index " + (k - 1) + ".");
      r.at("alloc").snap({ float: { v: v, at: k - 1 }, marks: { [k - 1]: "active" }, ptrs: { prev: k - 1 }, note: "Allocate the node." });
      r.at("link").snap({ float: { v: v, at: k - 1 }, floatLinks: k < L.length ? [k] : [], marks: { [k - 1]: "active" }, ptrs: { prev: k - 1 }, note: "node.next ← prev.next" + (k < L.length ? " (node " + k + ")." : " (null).") });
      L.splice(k, 0, v);
      r.at("splice").snap({ marks: { [k]: "done", [k - 1]: "active" }, ptrs: { prev: k - 1 }, note: "prev.next ← node. Two pointer writes and nothing shifts." });
      r.at(k === L.length - 1 ? "tail" : "tail^").snap({ marks: { [k]: "done" }, note: k === L.length - 1 ? "It went at the end, so it is the new tail." : "Not at the end, so tail is unchanged." });
      r.at("size").snap({ marks: { [k]: "done" }, note: "size = " + L.length + ". The walk makes this <b>O(n)</b>. The splice itself is O(1)." });
      return r;
    },
    removeFirst(inner) {
      const L = LL.single, r = inner || llRec("single").code("s_removeFirst");
      if (!inner) r.snap({ note: "<b>removeFirst()</b>." });
      if (!L.length) return fail(r, "check", "head is null — the list is empty, there is nothing to remove.");
      r.at("check^").snap({ note: "head ≠ null — the list is not empty." });
      const v = L[0];
      r.at("save").snap({ marks: { 0: "swap" }, note: "x = head.data = " + v + "." });
      r.at("head").snap({ marks: { 0: "swap", 1: "cmp" }, bypass: L.length > 1 ? { from: -1, to: 1 } : null, note: "head ← head.next." });
      L.shift();
      r.at(L.length ? "tail^" : "tail").snap({ note: L.length ? "The list still has nodes; tail is unchanged." : "The list is now empty, so tail ← null too." });
      r.at("size").snap({ note: "size = " + L.length + "." });
      r.at("ret").snap({ note: "Return " + v + ". The old node is unreachable and will be collected. <b>O(1)</b>." });
      return r;
    },
    removeLast() {
      const L = LL.single, n = L.length;
      const r = llRec("single").code("s_removeLast");
      r.snap({ note: "<b>removeLast()</b> — we need the node <em>before</em> the tail, and a singly linked list cannot go backwards." });
      if (n <= 1) {
        r.at("one").snap({ marks: n ? { 0: "swap" } : {}, note: n ? "head == tail — only one node, so hand the job to removeFirst()." : "head == tail — both are null, so call removeFirst() (which will complain)." });
        r.code("s_removeFirst");
        sll.removeFirst(r);
        if (!n) return r;
        r.code("s_removeLast");
        r.at("one").snap({ note: "Back in removeLast: return what removeFirst returned." });
        return r;
      }
      r.at("one^").snap({ note: "head ≠ tail — more than one node." });
      walk(r, L, n - 2, "prev", "start", "walk", "");
      r.at("walk").snap({ marks: { [n - 2]: "active", [n - 1]: "cmp" }, ptrs: { prev: n - 2 }, note: "prev.next == tail — stop." });
      const v = L[n - 1];
      r.at("save").snap({ marks: { [n - 2]: "active", [n - 1]: "swap" }, ptrs: { prev: n - 2 }, note: "x = tail.data = " + v + "." });
      r.at("unlink").snap({ marks: { [n - 2]: "active", [n - 1]: "swap" }, ptrs: { prev: n - 2 }, cut: n - 2, note: "prev.next ← null — cut the last link." });
      L.pop();
      r.at("tail").snap({ marks: { [n - 2]: "done" }, note: "tail ← prev." });
      r.at("size").snap({ marks: { [n - 2]: "done" }, note: "size = " + L.length + "." });
      r.at("ret").snap({ note: "Return " + v + ". Even with a tail pointer this took " + (n - 2) + " hop(s): <b>O(n)</b>. A doubly linked list fixes this." });
      return r;
    },
    remove(k) {
      const L = LL.single, r = llRec("single").code("s_remove");
      r.snap({ note: "<b>remove(" + k + ")</b>." });
      if (k < 1 || k >= L.length) return fail(r, "check", "i = " + k + " is outside [1, size) = [1, " + L.length + ")." + (k === 0 ? " (Index 0 has no predecessor — that case is removeFirst.)" : ""));
      r.at("check^").snap({ note: "1 ≤ " + k + " &lt; size = " + L.length + "." });
      walk(r, L, k - 1, "prev", "start", "walk", "Walk to the predecessor, index " + (k - 1) + ".");
      r.at("cur").snap({ marks: { [k - 1]: "active", [k]: "swap" }, ptrs: { prev: k - 1, cur: k }, note: "cur ← prev.next (value " + L[k] + ")." });
      r.at("unlink").snap({ marks: { [k - 1]: "active", [k]: "swap" }, ptrs: { prev: k - 1, cur: k }, bypass: { from: k - 1, to: k + 1 }, note: "prev.next ← cur.next — the arrow now jumps over cur." });
      const v = L.splice(k, 1)[0];
      r.at(k === L.length ? "tail" : "tail^").snap({ marks: { [k - 1]: "done" }, note: k === L.length ? "cur was the tail, so tail ← prev." : "cur was not the tail." });
      r.at("size").snap({ marks: { [k - 1]: "done" }, note: "size = " + L.length + "." });
      r.at("ret").snap({ note: "Return " + v + ". The nodes around it never moved. Only one pointer changed." });
      return r;
    },
    indexOf(v, kind) {
      const L = LL[kind || "single"], r = llRec(kind || "single").code("l_indexOf");
      r.snap({ note: "<b>indexOf(" + v + ")</b> — follow next pointers one at a time." });
      r.at("start").snap({ marks: L.length ? { 0: "active" } : {}, ptrs: L.length ? { cur: 0 } : {}, note: "cur ← head, i ← 0." });
      for (let i = 0; i < L.length; i++) {
        r.at("loop").snap({ marks: { [i]: "active" }, ptrs: { cur: i }, note: "cur ≠ null." });
        if (L[i] === v) { r.at("cmp").snap({ marks: { [i]: "done" }, ptrs: { cur: i }, note: "cur.data = " + v + " — <b>found at index " + i + "</b>." }); return r; }
        r.at("cmp").snap({ marks: { [i]: "cmp" }, ptrs: { cur: i }, note: L[i] + " ≠ " + v + "." });
        r.at("next").snap({ marks: i + 1 < L.length ? { [i + 1]: "active" } : {}, ptrs: i + 1 < L.length ? { cur: i + 1 } : {}, note: "cur ← cur.next, i = " + (i + 1) + "." });
      }
      r.at("loop").snap({ note: "cur is null — we fell off the end." });
      r.at("miss").snap({ note: "Return <b>−1</b>. Linear search, <b>O(n)</b>." });
      return r;
    },
    reverse() {
      const L = LL.single, r = llRec("single").code("s_reverse");
      const n = L.length;
      r.snap({ note: "<b>reverse()</b> — the three-pointer walk." });
      r.at("init").snap({ marks: n ? { 0: "active" } : {}, ptrs: n ? { cur: 0 } : {}, note: "prev ← null, cur ← head" + (n ? ". The old head will become the tail." : " = null.") });
      const flipped = {};
      for (let i = 0; i < n; i++) {
        const pp = Object.assign(i > 0 ? { prev: i - 1 } : {}, { cur: i });
        r.at("loop").snap({ marks: Object.assign({}, flipped, { [i]: "active" }), ptrs: pp, flipped: i, note: "cur ≠ null." });
        r.at("save").snap({ marks: Object.assign({}, flipped, { [i]: "active" }), ptrs: Object.assign({}, pp, i + 1 < n ? { next: i + 1 } : {}), flipped: i, note: "next ← cur.next — remember the rest of the list before we break the link." });
        flipped[i] = "visit";
        r.at("flip").snap({ marks: Object.assign({}, flipped, { [i]: "active" }), ptrs: Object.assign({}, pp, i + 1 < n ? { next: i + 1 } : {}), flipped: i + 1, note: "cur.next ← prev — node " + i + " now points " + (i ? "back to node " + (i - 1) : "to null") + "." });
        r.at("advance").snap({ marks: Object.assign({}, flipped), ptrs: Object.assign({ prev: i }, i + 1 < n ? { cur: i + 1 } : {}), flipped: i + 1, note: "prev ← cur, cur ← next." });
      }
      r.at("loop").snap({ marks: Object.assign({}, flipped), ptrs: n ? { prev: n - 1 } : {}, flipped: n, note: "cur is null — every arrow is flipped." });
      L.reverse();
      r.at("head").snap({ marks: { 0: "done" }, note: n < 2 ? "head ← prev. With " + n + " node" + (n === 1 ? "" : "s") + " there was nothing to reorder, but the same code handles it without a special case." : "head ← prev (the old tail). Reversed in one pass: <b>O(n)</b> time, <b>O(1)</b> extra space." });
      return r;
    },
  };

  const dll = {
    addFirst(v) {
      const L = LL.double, r = llRec("double").code("d_addFirst");
      r.snap({ note: "<b>addFirst(" + v + ")</b>." });
      r.at("alloc").snap({ float: { v: v, at: -1 }, note: "Allocate a node with both next and prev set to null." });
      r.at("link").snap({ float: { v: v, at: -1 }, floatLinks: L.length ? [0] : [], note: "node.next ← head." });
      r.at(L.length ? "back" : ["back^", "backElse"]).snap({ float: { v: v, at: -1 }, floatLinks: L.length ? [0] : [], marks: L.length ? { 0: "cmp" } : {}, note: L.length ? "head.prev ← node — the old head now points back at the newcomer." : "The list was empty, so the node is also the tail." });
      L.unshift(v);
      r.at("head").snap({ marks: { 0: "done" }, note: "head ← node." });
      r.at("size").snap({ marks: { 0: "done" }, note: "size = " + L.length + ". <b>O(1)</b>." });
      return r;
    },
    addLast(v) {
      const L = LL.double, r = llRec("double").code("d_addLast");
      r.snap({ note: "<b>addLast(" + v + ")</b>." });
      r.at("alloc").snap({ float: { v: v, at: L.length - 1 }, note: "Allocate the node." });
      r.at("link").snap({ float: { v: v, at: L.length - 1 }, marks: L.length ? { [L.length - 1]: "cmp" } : {}, note: "node.prev ← tail." });
      r.at(L.length ? "back" : ["back^", "backElse"]).snap({ float: { v: v, at: L.length - 1 }, marks: L.length ? { [L.length - 1]: "cmp" } : {}, note: L.length ? "tail.next ← node." : "Empty list: head ← node." });
      L.push(v);
      r.at("tail").snap({ marks: { [L.length - 1]: "done" }, note: "tail ← node." });
      r.at("size").snap({ marks: { [L.length - 1]: "done" }, note: "size = " + L.length + ". <b>O(1)</b>." });
      return r;
    },
    insert(k, v) {
      const L = LL.double, r = llRec("double").code("d_insert");
      r.snap({ note: "<b>insert(" + k + ", " + v + ")</b> — walk to the node currently at index " + k + ". With prev links we can splice in <em>before</em> it." });
      if (k < 1 || k >= L.length) return fail(r, "check", "i = " + k + " is outside [1, size) = [1, " + L.length + ")." + (k === 0 ? " (i = 0 is addFirst.)" : ""));
      r.at("check^").snap({ note: "1 ≤ " + k + " &lt; size = " + L.length + "." });
      walk(r, L, k, "cur", "start", "walk", "");
      r.at("alloc").snap({ float: { v: v, at: k - 1 }, marks: { [k]: "active" }, ptrs: { cur: k }, note: "Allocate the node." });
      r.at("link").snap({ float: { v: v, at: k - 1 }, floatLinks: [k - 1, k], marks: { [k]: "active", [k - 1]: "cmp" }, ptrs: { cur: k }, note: "node.prev ← cur.prev, node.next ← cur. The new node points at both neighbours before anything points at it." });
      r.at("fwd").snap({ float: { v: v, at: k - 1 }, floatLinks: [k - 1, k], marks: { [k]: "active", [k - 1]: "swap" }, ptrs: { cur: k }, note: "cur.prev.next ← node." });
      L.splice(k, 0, v);
      r.at("back").snap({ marks: { [k]: "done", [k + 1]: "active" }, ptrs: { cur: k + 1 }, note: "cur.prev ← node. Four pointer writes in total." });
      r.at("size").snap({ marks: { [k]: "done" }, note: "size = " + L.length + "." });
      return r;
    },
    removeFirst() {
      const L = LL.double, r = llRec("double").code("d_removeFirst");
      r.snap({ note: "<b>removeFirst()</b>." });
      if (!L.length) return fail(r, "check", "head is null — the list is empty.");
      r.at("check^").snap({ note: "Not empty." });
      const v = L[0];
      r.at("save").snap({ marks: { 0: "swap" }, note: "x = " + v + "." });
      r.at("head").snap({ marks: { 0: "swap", 1: "cmp" }, bypass: L.length > 1 ? { from: -1, to: 1 } : null, note: "head ← head.next." });
      L.shift();
      r.at(L.length ? ["tail^", "tailElse"] : "tail").snap({ marks: L.length ? { 0: "cmp" } : {}, note: L.length ? "head.prev ← null — the new head must not point back at the removed node." : "Now empty, so tail ← null." });
      r.at("size").snap({ note: "size = " + L.length + "." });
      r.at("ret").snap({ note: "Return " + v + ". <b>O(1)</b>." });
      return r;
    },
    removeLast() {
      const L = LL.double, r = llRec("double").code("d_removeLast");
      const n = L.length;
      r.snap({ note: "<b>removeLast()</b> — no walk needed: tail.prev is right there." });
      if (!n) return fail(r, "check", "tail is null — the list is empty.");
      r.at("check^").snap({ note: "Not empty." });
      const v = L[n - 1];
      r.at("save").snap({ marks: { [n - 1]: "swap" }, note: "x = tail.data = " + v + "." });
      r.at("tail").snap({ marks: { [n - 1]: "swap", [n - 2]: "active" }, note: "tail ← tail.prev — one hop <em>backwards</em>." });
      r.at(n > 1 ? ["unlink^", "unlinkElse"] : "unlink").snap({ marks: { [n - 1]: "swap", [n - 2]: "active" }, cut: n - 2, note: n > 1 ? "tail.next ← null." : "That was the only node: head ← null." });
      L.pop();
      r.at("size").snap({ marks: n > 1 ? { [n - 2]: "done" } : {}, note: "size = " + L.length + "." });
      r.at("ret").snap({ note: "Return " + v + ". <b>O(1)</b>. Compare with the singly linked version, which had to walk n − 2 hops." });
      return r;
    },
    remove(k) {
      const L = LL.double, r = llRec("double").code("d_remove");
      r.snap({ note: "<b>remove(" + k + ")</b> — walk straight to the node itself. prev gives us its predecessor for free." });
      if (k < 1 || k >= L.length - 1) return fail(r, "check", "i = " + k + " is outside [1, size−1) with size = " + L.length + ". This version only removes nodes that have a neighbour on both sides.");
      r.at("check^").snap({ note: "1 ≤ " + k + " &lt; size − 1 = " + (L.length - 1) + "." });
      walk(r, L, k, "cur", "start", "walk", "");
      r.at("fwd").snap({ marks: { [k]: "swap", [k - 1]: "active" }, ptrs: { cur: k }, bypass: { from: k - 1, to: k + 1 }, note: "cur.prev.next ← cur.next." });
      r.at("back").snap({ marks: { [k]: "swap", [k + 1]: "active" }, ptrs: { cur: k }, bypass: { from: k - 1, to: k + 1 }, back: { from: k + 1, to: k - 1 }, note: "cur.next.prev ← cur.prev. Both neighbours now skip cur." });
      const v = L.splice(k, 1)[0];
      r.at("size").snap({ marks: { [k - 1]: "done", [k]: "done" }, note: "size = " + L.length + "." });
      r.at("ret").snap({ note: "Return " + v + ". If you already held a reference to the node, this would be <b>O(1)</b>: no walk at all." });
      return r;
    },
    backward() {
      const L = LL.double, r = llRec("double").code("d_backward");
      const out = [];
      r.snap({ note: "<b>Walk backward</b> from the tail using prev links." });
      r.at("start").snap({ marks: { [L.length - 1]: "active" }, ptrs: { cur: L.length - 1 }, note: "cur ← tail." });
      for (let i = L.length - 1; i >= 0; i--) {
        r.at("loop").snap({ marks: visitedFrom(i + 1, L.length, { [i]: "active" }), ptrs: { cur: i }, out: out.slice(), note: "cur ≠ null." });
        out.push(L[i]);
        r.at("visit").snap({ marks: visitedFrom(i, L.length), ptrs: { cur: i }, out: out.slice(), note: "visit " + L[i] + "." });
        r.at("next").snap({ marks: visitedFrom(i, L.length, i ? { [i - 1]: "active" } : {}), ptrs: i ? { cur: i - 1 } : {}, out: out.slice(), note: "cur ← cur.prev" + (i ? "." : " = null.") });
      }
      r.at("loop").snap({ marks: visitedFrom(0, L.length), out: out.slice(), note: !out.length ? "cur is null straight away — the list is empty, so there is nothing to visit." : "Done: <b>" + out.join(", ") + "</b>. A singly linked list can only do this with a stack or with recursion." });
      return r;
      function visitedFrom(a, b, extra) { const m = {}; for (let i = a; i < b; i++) m[i] = "visit"; return Object.assign(m, extra || {}); }
    },
  };

  const cll = {
    addFirst(v, inner) {
      const L = LL.circular, r = inner || llRec("circular").code("c_addFirst");
      if (!inner) r.snap({ note: "<b>addFirst(" + v + ")</b> — in a circular list the head is simply <span class='mono'>tail.next</span>." });
      r.at("alloc").snap({ float: { v: v, at: L.length - 1 }, note: "Allocate a node holding " + v + "." });
      if (!L.length) {
        L.push(v);
        r.at("empty").snap({ marks: { 0: "done" }, note: "The list was empty: tail ← node, and node.next ← node. A ring of one node points to itself." });
      } else {
        r.at("link").snap({ float: { v: v, at: L.length - 1 }, floatLinks: [0], marks: { 0: "cmp" }, note: "node.next ← tail.next — the current head." });
        L.unshift(v);
        r.at("splice").snap({ marks: { 0: "done", [L.length - 1]: "active" }, note: "tail.next ← node. The new node is now the head, sitting right after the tail in the ring." });
      }
      r.at("size").snap({ marks: { 0: "done" }, note: "size = " + L.length + ". <b>O(1)</b>." });
      return r;
    },
    addLast(v) {
      const L = LL.circular, r = llRec("circular").code("c_addLast");
      r.snap({ note: "<b>addLast(" + v + ")</b> — a neat trick: add at the front, then move the tail forward one step." });
      r.at("first").snap({ note: "Call addFirst(" + v + ")." });
      r.code("c_addFirst");
      cll.addFirst(v, r);
      r.code("c_addLast");
      r.at("first").snap({ marks: { 0: "done" }, note: "Back in addLast: " + v + " is at the front, right after the tail." });
      if (L.length > 1) L.push(L.shift());
      r.at("tail").snap({ marks: { [L.length - 1]: "done" }, note: "tail ← tail.next. The ring did not change at all. We only moved which node we call the tail, so " + v + " is now last. <b>O(1)</b>." });
      return r;
    },
    removeFirst() {
      const L = LL.circular, r = llRec("circular").code("c_removeFirst");
      r.snap({ note: "<b>removeFirst()</b>." });
      if (!L.length) return fail(r, "check", "tail is null — the ring is empty.");
      r.at("check^").snap({ note: "tail ≠ null." });
      const v = L[0];
      r.at("save").snap({ marks: { 0: "swap" }, ptrs: { head: 0 }, note: "head ← tail.next (value " + v + ")." });
      if (L.length === 1) {
        L.shift();
        r.at("one").snap({ note: "head == tail — it was the only node, so tail ← null." });
      } else {
        r.at("one^").snap({ marks: { 0: "swap" }, ptrs: { head: 0 }, note: "head ≠ tail." });
        r.at("unlink").snap({ marks: { 0: "swap", [L.length - 1]: "active", 1: "cmp" }, ptrs: { head: 0 }, wrapTo: 1, note: "tail.next ← head.next — the ring now closes past the old head." });
        L.shift();
      }
      r.at("size").snap({ note: "size = " + L.length + "." });
      r.at("ret").snap({ note: "Return " + v + ". <b>O(1)</b>." });
      return r;
    },
    rotate() {
      const L = LL.circular, r = llRec("circular").code("c_rotate");
      r.snap({ marks: { 0: "cmp", [L.length - 1]: "active" }, note: "<b>rotate()</b> — the front element should become the back. That is what a round-robin scheduler does after each time slice." });
      if (!L.length) { r.at("check^").snap({ note: "tail is null — an empty ring has nothing to rotate, so the body is skipped. No error: rotate() just does nothing." }); return r; }
      r.at("check").snap({ marks: { 0: "cmp", [L.length - 1]: "active" }, note: "tail ≠ null." });
      L.push(L.shift());
      r.at("rot").snap({ marks: { [L.length - 1]: "done", 0: "active" }, note: "tail ← tail.next. One pointer move, <b>O(1)</b>. Nothing was unlinked or allocated: " + L[L.length - 1] + " is now at the back and " + L[0] + " is the new front." });
      return r;
    },
    indexOf(v) {
      const L = LL.circular, r = llRec("circular").code("c_indexOf");
      r.snap({ note: "<b>indexOf(" + v + ")</b>. There is no null to stop at, so we must stop when we get back to where we started." });
      if (!L.length) { r.at("check").snap({ note: "tail is null — the ring is empty. Return <b>−1</b> straight away." }); return r; }
      r.at("check^").snap({ note: "tail ≠ null." });
      r.at("start").snap({ marks: { 0: "active" }, ptrs: { cur: 0 }, note: "cur ← tail.next (the head), i ← 0." });
      for (let i = 0; i < L.length; i++) {
        if (L[i] === v) { r.at("cmp").snap({ marks: { [i]: "done" }, ptrs: { cur: i }, note: "<b>Found " + v + " at index " + i + "</b>." }); return r; }
        r.at("cmp").snap({ marks: { [i]: "cmp" }, ptrs: { cur: i }, note: L[i] + " ≠ " + v + "." });
        const nx = (i + 1) % L.length;
        r.at("next").snap({ marks: { [nx]: "active" }, ptrs: { cur: nx }, wrapOn: nx === 0, note: "cur ← cur.next" + (nx === 0 ? " — this wraps round from the tail back to the head." : ".") });
        r.at("loop").snap({ marks: { [nx]: "active" }, ptrs: { cur: nx }, wrapOn: nx === 0, note: nx === 0 ? "cur == tail.next again — <b>one full lap</b>, stop." : "cur ≠ tail.next, keep going." });
      }
      r.at("miss").snap({ note: "Return <b>−1</b>. Without the lap check this loop would spin forever." });
      return r;
    },
  };

  /* ============================================================
     RENDERING
     ============================================================ */
  function render(f) {
    const stage = q("stage");
    stage.innerHTML = "";
    if (f.kind === "fa") renderFA(stage, f);
    else if (f.kind === "da") renderDA(stage, f);
    else if (f.kind === "g2") renderG2(stage, f);
    else if (f.kind === "ll") renderLL(stage, f);
  }

  function renderFA(stage, f) {
    stage.appendChild(D.cells(f.a, {
      marks: f.marks, live: (v) => v != null, ptrs: f.n < f.cap ? { [f.n]: "n" } : {}, roomBelow: true,
      label: "double[" + f.cap + "] — capacity fixed at creation",
    }));
  }

  function renderDA(stage, f) {
    stage.appendChild(D.cells(f.a, {
      marks: f.marks, live: (v) => v != null, ptrs: f.n < f.cap ? { [f.n]: "n" } : {}, roomBelow: true,
      label: "backing array A — capacity " + f.cap,
    }));
    if (f.src) {
      const old = D.cells(f.src.a, { marks: f.src.marks, live: (v) => v != null, label: "old array — discarded after the copy" });
      old.style.opacity = ".75";
      stage.appendChild(old);
    }
    stage.appendChild(D.el("div", { class: "small mono muted", style: "margin-top:.3rem", html: "capacity history: " + f.history.join(" → ") + (f.history.length > 1 ? (f.geo ? "   <span style='color:var(--c-done)'>(×2 each time — geometric)</span>" : "   <span style='color:var(--c-warn)'>(+2 each time — arithmetic)</span>") : "") }));
  }

  function renderG2(stage, f) {
    const wrap = D.el("div", { style: "display:flex;gap:1.6rem;flex-wrap:wrap;align-items:flex-start" });
    const grid = D.el("div", { class: "grid2d", style: "grid-template-columns: 1.4rem repeat(" + f.cols + ", auto)" });
    grid.appendChild(D.el("div"));
    for (let c = 0; c < f.cols; c++) grid.appendChild(D.el("div", { class: "ch" + (f.marks["c" + c] ? " hl" : ""), text: "c" + c, style: f.marks["c" + c] ? "color:var(--c-cmp)" : "" }));
    for (let r = 0; r < f.rows; r++) {
      grid.appendChild(D.el("div", { class: "rh", text: "r" + r, style: f.marks["r" + r] ? "color:var(--c-cmp)" : "" }));
      for (let c = 0; c < f.cols; c++) grid.appendChild(D.el("div", { class: "cell filled " + (f.marks[r + "," + c] || ""), text: f.m[r][c] }));
    }
    const left = D.el("div");
    left.appendChild(D.el("div", { class: "cells-cap", text: "logical view — M[r][c]" }));
    left.appendChild(grid);
    wrap.appendChild(left);
    if (f.acc != null) wrap.appendChild(D.el("div", { class: "var-box", style: "align-self:center", html: "local variable <span class='mono'>s = " + f.acc + "</span>" }));
    stage.appendChild(wrap);

    const flat = [];
    f.m.forEach((row) => row.forEach((v) => flat.push(v)));
    const fm = Object.assign({}, f.flat || {});
    /* mirror grid marks into the strip when the frame did not set strip marks itself */
    if (!f.flat) Object.keys(f.marks).forEach((k) => { if (k.indexOf(",") > 0) { const p = k.split(","); fm[+p[0] * f.cols + +p[1]] = f.marks[k]; } });
    const ptrs = {};
    for (let r = 0; r < f.rows; r++) ptrs[r * f.cols] = "row " + r;
    const strip = D.cells(flat, { marks: fm, ptrs: ptrs, w: 38, h: 34, label: "physical memory — one contiguous block, row after row (row-major)" });
    strip.style.marginTop = ".8rem";
    stage.appendChild(strip);
  }

  /* ---- linked list drawing ---- */
  const NW = 58, NGAP = 42, PADX = 84, ROWY = 86;
  const nodeX = (i) => PADX + i * (NW + NGAP);

  function renderLL(stage, f) {
    const n = f.vals.length, circ = f.lk === "circular", dbl = f.lk === "double";
    const w = Math.max(420, nodeX(Math.max(1, n)) + 70);
    const h = circ ? 230 : 190;
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + w + " " + h, width: w, height: h });
    svg.appendChild(D.svg("defs", {}, [marker("arw", "#5b6a92"), marker("arwOn", "#6ea8fe"), marker("arwCut", "#ff6b9d"), marker("arwDone", "#4ade80")]));

    /* head pointer (circular lists have none: head is tail.next) */
    if (!circ) {
      svg.appendChild(D.sText(30, ROWY + 20, "head", { class: "lbl-s", "font-size": 12, fill: "#6ea8fe" }));
      if (n) svg.appendChild(arrow(48, ROWY + 20, nodeX(0) - 6, ROWY + 20, "on"));
      else svg.appendChild(D.sText(nodeX(0) + 10, ROWY + 20, "null", { class: "lbl-s", "font-size": 13 }));
    }
    /* tail pointer, drawn above the last node */
    if (n) {
      const tx = nodeX(n - 1) + NW / 2;
      svg.appendChild(D.sText(tx, ROWY - 44, "tail", { class: "lbl-s", "font-size": 12, fill: "#6ea8fe" }));
      svg.appendChild(arrow(tx, ROWY - 36, tx, ROWY - 20, "on"));
    } else if (circ) svg.appendChild(D.sText(w / 2, ROWY + 20, "tail = null", { class: "lbl-s", "font-size": 13 }));

    const ny = dbl ? 13 : 20;
    for (let i = 0; i < n; i++) {
      const x = nodeX(i), y = ROWY;
      svg.appendChild(D.svg("rect", { x: x, y: y, width: NW, height: 40, rx: 8, class: "node-c " + (f.marks[i] || "") }));
      svg.appendChild(D.sText(x + NW / 2, y + 20, f.vals[i], { "font-size": 14 }));
      svg.appendChild(D.sText(x + NW / 2, y - 10, i, { class: "lbl-s" }));

      /* next link. During reverse, links left of `flipped` point backwards */
      const flippedHere = f.flipped != null && i < f.flipped;
      if (flippedHere) {
        if (i > 0) svg.appendChild(arrow(x - 6 + 6, y + ny + 8, nodeX(i - 1) + NW + 2, y + ny + 8, "done"));
        else { svg.appendChild(arrow(x, y + ny + 8, x - 22, y + ny + 8, "done")); svg.appendChild(D.sText(x - 38, y + ny + 8, "null", { class: "lbl-s" })); }
      } else if (f.cut === i) {
        svg.appendChild(D.sText(x + NW + 20, y + ny, "✕", { fill: "#ff6b9d", "font-size": 14 }));
      } else if (i < n - 1) {
        svg.appendChild(arrow(x + NW, y + ny, nodeX(i + 1) - 6, y + ny, f.marks[i] === "active" || f.marks[i] === "done" ? "on" : ""));
      } else if (!circ) {
        svg.appendChild(arrow(x + NW, y + ny, x + NW + 22, y + ny, ""));
        svg.appendChild(D.sText(x + NW + 40, y + ny, "null", { class: "lbl-s" }));
      }
      /* prev link */
      if (dbl) {
        if (i > 0) svg.appendChild(arrow(x - 6, y + 30, nodeX(i - 1) + NW, y + 30, "dim"));
        else { svg.appendChild(arrow(x - 4, y + 30, x - 24, y + 30, "dim")); svg.appendChild(D.sText(x - 40, y + 32, "null", { class: "lbl-s" })); }
      }
      /* pointer names */
      const names = Object.keys(f.ptrs).filter((k) => f.ptrs[k] === i);
      if (names.length) svg.appendChild(D.sText(x + NW / 2, y + 60, names.join(" / "), { class: "lbl-s", fill: "#ffc14d", "font-size": 12 }));
    }

    /* circular wrap-around link: tail.next → head (or → wrapTo during removeFirst) */
    if (circ && n) {
      const to = f.wrapTo != null && f.wrapTo < n ? f.wrapTo : 0;
      const x1 = nodeX(n - 1) + NW - 12, x2 = nodeX(to) + 12, y0 = ROWY + 40;
      const p = D.svg("path", {
        d: n === 1 && to === 0
          ? "M " + (x1 + 14) + " " + y0 + " C " + (x1 + 60) + " " + (y0 + 60) + ", " + (x1 - 60) + " " + (y0 + 60) + ", " + (x1 - 14) + " " + (y0 + 2)
          : "M " + x1 + " " + y0 + " C " + x1 + " " + (y0 + 80) + ", " + x2 + " " + (y0 + 80) + ", " + x2 + " " + (y0 + 2),
        class: "edge " + (f.wrapOn || f.wrapTo != null ? "on" : ""),
      });
      p.setAttribute("marker-end", "url(#" + (f.wrapOn || f.wrapTo != null ? "arwOn" : "arw") + ")");
      svg.appendChild(p);
      svg.appendChild(D.sText((x1 + x2) / 2, y0 + 72, "tail.next (the head)", { class: "lbl-s", "font-size": 11 }));
    }

    /* freshly allocated node */
    if (f.float) {
      const fx = f.float.at < 0 ? Math.max(8, nodeX(0) - 50) : nodeX(f.float.at) + (NW + NGAP) / 2 + 4;
      const fy = 8;
      svg.appendChild(D.svg("rect", { x: fx, y: fy, width: NW, height: 32, rx: 8, class: "node-c cmp", "stroke-dasharray": "5 3" }));
      svg.appendChild(D.sText(fx + NW / 2, fy + 16, f.float.v, { "font-size": 14 }));
      svg.appendChild(D.sText(fx + NW + 30, fy + 16, "node", { class: "lbl-s", "font-size": 10 }));
      (f.floatLinks || []).forEach((t) => { if (t >= 0 && t < n) svg.appendChild(curve(fx + NW / 2, fy + 32, nodeX(t) + NW / 2, ROWY - 2, "on", true)); });
    }
    /* bypass arrow while unlinking */
    if (f.bypass) {
      const a = f.bypass.from < 0 ? 40 : nodeX(f.bypass.from) + NW / 2;
      const b = f.bypass.to < n ? nodeX(f.bypass.to) + NW / 2 : nodeX(n - 1) + NW + 34;
      svg.appendChild(curve(a, ROWY - 2, b, ROWY - 2, "on"));
    }
    if (f.back) {
      const a = nodeX(f.back.from) + NW / 2, b = nodeX(f.back.to) + NW / 2;
      const p = D.svg("path", { d: "M " + a + " " + (ROWY + 42) + " C " + a + " " + (ROWY + 80) + ", " + b + " " + (ROWY + 80) + ", " + b + " " + (ROWY + 42), class: "edge on" });
      p.setAttribute("marker-end", "url(#arwOn)");
      svg.appendChild(p);
    }
    if (!n && !circ) svg.appendChild(D.sText(w / 2, 40, "empty list", { class: "lbl-s", "font-size": 13 }));
    stage.appendChild(svg);
    if (f.out) stage.appendChild(D.el("div", { class: "small mono", style: "color:var(--c-done);margin-top:.3rem", text: "output: " + (f.out.join(", ") || "—") }));
  }

  function marker(id, color) {
    return D.svg("marker", { id: id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, [
      D.svg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }),
    ]);
  }
  function arrow(x1, y1, x2, y2, cls) {
    const l = D.sLine(x1, y1, x2, y2, "edge " + (cls === "done" ? "tree" : cls || ""));
    l.setAttribute("marker-end", "url(#" + (cls === "on" ? "arwOn" : cls === "done" ? "arwDone" : "arw") + ")");
    return l;
  }
  function curve(x1, y1, x2, y2, cls, down) {
    const lift = down ? 26 : -34;
    const p = D.svg("path", { d: "M " + x1 + " " + y1 + " C " + x1 + " " + (y1 + lift) + ", " + x2 + " " + (y2 + lift) + ", " + x2 + " " + y2, class: "edge " + (cls || "") });
    p.setAttribute("marker-end", "url(#arwOn)");
    return p;
  }

  /* ============================================================
     TABS, NOTES
     ============================================================ */
  const NOTES = {
    fixed:
      "<p class='blurb'>A <b>fixed array</b> is one contiguous block whose capacity is decided once, at <span class='mono'>new double[8]</span>, and can " +
      "never change. You track how many slots are in use (<span class='mono'>n</span>) yourself. Reads and writes by index are O(1). " +
      "Inserting or removing in the middle means shifting, and when every slot is used there is simply no room left.</p>",
    dynamic:
      "<div class='callout' style='margin-top:.9rem'><b>Growth is a geometric progression.</b> When the array is full, a dynamic array allocates a new one of " +
      "<b>twice</b> the capacity and copies everything across. That one add costs <b>O(n) time and O(n) space</b> (the new array), which is its worst case; " +
      "every other add is O(1). The capacities form the geometric sequence 4, 8, 16, …, and the total copying is their sum, " +
      "less than 2n for n adds, so resizes stay rare.<br><br>" +
      "Compare <b>arithmetic</b> growth (+2 each time): the array fills up again after just 2 more adds, so resizes happen constantly and " +
      "the total copying grows like n². Switch <em>growth</em> to “+2”, keep adding, and watch the capacity history under the array. " +
      "Java's <span class='mono'>ArrayList</span> grows ×1.5; any ratio &gt; 1 keeps resizes rare.</div>",
    grid:
      "<p class='blurb'>A <b>2-D array</b> is a grid addressed by (row, column), but memory is one-dimensional. In memory, " +
      "a grid is laid out <b>row-major</b>: row 0, then row 1, … so M[r][c] lives at flat index r·C + c (the pseudocode works this way). In Java, " +
      "<span class='mono'>double[][]</span> is an <em>array of references to row arrays</em>. Each row is contiguous, but rows can live apart and can even have different " +
      "lengths (a “jagged” array). Either way the big-O is the same: O(1) access, O(R·C) to visit everything.</p>",
    single:
      "<p class='blurb'>A <b>singly linked list</b> stores <span class='mono'>next</span> only. We keep both <span class='mono'>head</span> and " +
      "<span class='mono'>tail</span>, so addFirst, addLast and removeFirst are O(1). Anything that needs a <em>predecessor</em> has to walk from the head, " +
      "because you can only move forwards. That includes removeLast and remove(i), so they are O(n).</p>",
    double:
      "<p class='blurb'>A <b>doubly linked list</b> also stores <span class='mono'>prev</span>. That costs one more pointer per node, but every node can reach its " +
      "predecessor in O(1). removeLast becomes O(1), you can traverse backwards, and removing a node you already hold never needs a walk. " +
      "Java's <span class='mono'>LinkedList</span> is doubly linked.</p>",
    circular:
      "<p class='blurb'>A <b>circularly linked list</b> is a singly linked list whose last node points back to the first. You only need to store " +
      "<span class='mono'>tail</span>, because the head is always <span class='mono'>tail.next</span>. That one pointer gives O(1) access to both ends, and " +
      "<b>rotate()</b> (move the front to the back) is a single assignment. That makes it the natural structure for round-robin scheduling and turn-taking games. " +
      "The catch is that there is no null to stop at, so every loop must stop after one full lap.</p>",
  };

  function load(r) { if (r.overflow) D.toast("Step limit reached.", true); player.load(r.frames, true); }
  function still(snapRec, note) { const r = snapRec(); r.snap({ note: note }); player.load(r.frames, false); }
  function stillTab(note) {
    if (tab === "fixed") still(faRec, note);
    else if (tab === "dynamic") still(daRec, note);
    else if (tab === "grid") still(g2Rec, note);
    else still(() => llRec(tab), note);
  }


  function faFill(vals) { FA.a = new Array(FA.cap).fill(null); vals.forEach((v, i) => (FA.a[i] = v)); FA.n = vals.length; }
  function setGrowth() {
    const geo = q("growth").value === "geo";
    if (geo === DA.geo) return;
    DA.geo = geo;
    dock.show(geo ? "da_add_geo" : "da_add_arith");
  }

  function selectTab(id) {
    tab = id;
    D.showFor(id);
    D.practiceShow(id);
    q("notes").innerHTML = NOTES[id];
    shareClass(id);
    const first = {
      fixed: "fa_insert", dynamic: DA.geo ? "da_add_geo" : "da_add_arith", grid: "g_get",
      single: "s_addFirst", double: "d_addFirst", circular: "c_addFirst",
    }[id];
    dock.show(first);
    const msg = {
      fixed: "A fixed array of capacity " + FA.cap + " holding " + FA.n + " element(s).",
      dynamic: "A dynamic array: size " + DA.n + ", capacity " + DA.cap + ".",
      grid: "A " + G2.rows + " × " + G2.cols + " array. The strip underneath is how it really sits in memory.",
      single: "A singly linked list with " + LL.single.length + " node(s).",
      double: "A doubly linked list with " + LL.double.length + " node(s).",
      circular: "A circularly linked list with " + LL.circular.length + " node(s). There is no null at the end: the tail points back to the head.",
    }[id];
    stillTab(msg + " Pick an operation above.");
  }

  /* ============================================================
     INIT
     ============================================================ */
  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "fixed": {
    "label": "Fixed array",
    "items": [
     [
      1089,
      "Duplicate Zeros",
      "duplicate-zeros",
      "Easy",
      "Shift elements right inside a fixed-length array — exactly insert-at-index."
     ],
     [
      27,
      "Remove Element",
      "remove-element",
      "Easy",
      "Close gaps in place and track n yourself."
     ],
     [
      283,
      "Move Zeroes",
      "move-zeroes",
      "Easy",
      "In-place shifting without extra space."
     ],
     [
      88,
      "Merge Sorted Array",
      "merge-sorted-array",
      "Easy",
      "Fill a fixed-capacity array from the back so nothing is overwritten."
     ],
     [
      189,
      "Rotate Array",
      "rotate-array",
      "Medium",
      "Moving every element: O(n) no matter how you do it."
     ]
    ]
   },
   "dynamic": {
    "label": "Dynamic array",
    "items": [
     [
      1929,
      "Concatenation of Array",
      "concatenation-of-array",
      "Easy",
      "Build a new array twice the size — the core of a resize."
     ],
     [
      1480,
      "Running Sum of 1d Array",
      "running-sum-of-1d-array",
      "Easy",
      "Warm-up: indexed reads and writes are O(1)."
     ],
     [
      1470,
      "Shuffle the Array",
      "shuffle-the-array",
      "Easy",
      "Index arithmetic into a new array."
     ],
     [
      1672,
      "Richest Customer Wealth",
      "richest-customer-wealth",
      "Easy",
      "Lists of lists, like ArrayList<ArrayList<Integer>>."
     ]
    ]
   },
   "grid": {
    "label": "2-D array",
    "items": [
     [
      566,
      "Reshape the Matrix",
      "reshape-the-matrix",
      "Easy",
      "Row-major order: flat index = r · cols + c."
     ],
     [
      867,
      "Transpose Matrix",
      "transpose-matrix",
      "Easy",
      "Swap the roles of rows and columns."
     ],
     [
      54,
      "Spiral Matrix",
      "spiral-matrix",
      "Medium",
      "Traversal order through a grid."
     ],
     [
      48,
      "Rotate Image",
      "rotate-image",
      "Medium",
      "In-place 2-D index gymnastics."
     ],
     [
      74,
      "Search a 2D Matrix",
      "search-a-2d-matrix",
      "Medium",
      "Treat a row-major grid as one sorted 1-D array."
     ]
    ]
   },
   "single": {
    "label": "Singly linked list",
    "items": [
     [
      707,
      "Design Linked List",
      "design-linked-list",
      "Medium",
      "Implement get, addAtHead, addAtTail, addAtIndex, deleteAtIndex — this whole tab."
     ],
     [
      206,
      "Reverse Linked List",
      "reverse-linked-list",
      "Easy",
      "The three-pointer reverse from this page."
     ],
     [
      203,
      "Remove Linked List Elements",
      "remove-linked-list-elements",
      "Easy",
      "Unlink by keeping a pointer to the previous node."
     ],
     [
      876,
      "Middle of the Linked List",
      "middle-of-the-linked-list",
      "Easy",
      "Walking a list with two pointers."
     ],
     [
      19,
      "Remove Nth Node From End of List",
      "remove-nth-node-from-end-of-list",
      "Medium",
      "Find a predecessor without knowing the size."
     ],
     [
      21,
      "Merge Two Sorted Lists",
      "merge-two-sorted-lists",
      "Easy",
      "Splice nodes instead of copying values."
     ]
    ]
   },
   "double": {
    "label": "Doubly linked list",
    "items": [
     [
      146,
      "LRU Cache",
      "lru-cache",
      "Medium",
      "A doubly linked list plus a hash map: O(1) remove from the middle."
     ],
     [
      430,
      "Flatten a Multilevel Doubly Linked List",
      "flatten-a-multilevel-doubly-linked-list",
      "Medium",
      "Keep next and prev consistent while splicing."
     ],
     [
      707,
      "Design Linked List",
      "design-linked-list",
      "Medium",
      "Try it again with prev pointers and compare removeLast."
     ]
    ]
   },
   "circular": {
    "label": "Circularly linked list",
    "items": [
     [
      61,
      "Rotate List",
      "rotate-list",
      "Medium",
      "Close the list into a ring, then move the tail — this tab's rotate()."
     ],
     [
      141,
      "Linked List Cycle",
      "linked-list-cycle",
      "Easy",
      "Detect a ring: the loop that would never stop without a lap check."
     ],
     [
      142,
      "Linked List Cycle II",
      "linked-list-cycle-ii",
      "Medium",
      "Find where the ring starts."
     ],
     [
      1823,
      "Find the Winner of the Circular Game",
      "find-the-winner-of-the-circular-game",
      "Medium",
      "Josephus: round-robin elimination on a ring."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    dock = D.CodeDock("#code", CODE, { recv: (k) => (/^(s|d|c|l)_/.test(k) ? "list" : "arr") });
    player = new D.Player({ mount: "#player", render: render, code: dock });

    const num = (id) => D.readInt(q(id));
    /* values may be negative or decimal; empty means random */
    const val = () => D.readNum(q("val"), () => D.randInt(10, 99));
    const need = (ok, msg) => { if (!ok) D.toast(msg, true); return ok; };
    /* only reject input that is not a number: out-of-range indices run, so the code's own check can fail on screen */
    const idx = () => { const i = num("idx"); return need(!isNaN(i), "Type a whole-number index first (an index can be negative, but not a decimal).") ? i : null; };

    /* fixed */
    q("fa-add").onclick = () => load(fa.add(val()));
    q("fa-insert").onclick = () => { const i = idx(); if (i != null) load(fa.insert(i, val())); };
    q("fa-remove").onclick = () => { const i = idx(); if (i != null) load(fa.remove(i)); };
    q("fa-get").onclick = () => { const i = idx(); if (i != null) load(fa.get(i)); };
    q("fa-set").onclick = () => { const i = idx(); if (i != null) load(fa.set(i, val())); };
    q("fa-find").onclick = () => load(fa.indexOf(val()));
    q("fa-clear").onclick = () => { faFill([]); stillTab("Cleared: n = 0. The capacity is still " + FA.cap + "."); };

    /* dynamic */
    q("growth").onchange = () => { setGrowth(); stillTab("Growth rule: <b>" + (DA.geo ? "×2 (geometric)" : "+2 (arithmetic)") + "</b>. Keep pressing add and watch the capacity history."); };
    q("da-add").onclick = () => load(da.add(val()));
    q("da-insert").onclick = () => { const i = idx(); if (i != null) load(da.insert(i, val())); };
    q("da-remove").onclick = () => { const i = idx(); if (i != null) load(da.remove(i)); };
    q("da-get").onclick = () => { const i = idx(); if (i != null) load(da.get(i)); };
    q("da-find").onclick = () => load(da.indexOf(val()));
    q("da-clear").onclick = () => { daReset(4); stillTab("Reset: an empty dynamic array of capacity 4."); };

    /* 2-D */
    const rc = () => {
      const r = num("g-r"), c = num("g-c");
      if (!need(!isNaN(r) && !isNaN(c), "Type a whole-number row and column first.")) return null;
      return [r, c];
    };
    const gval = () => D.readNum(q("g-v"), () => D.randInt(1, 99));
    q("g-get").onclick = () => { const p = rc(); if (p) load(g2.get(p[0], p[1])); };
    q("g-set").onclick = () => { const p = rc(); if (p) load(g2.set(p[0], p[1], gval())); };
    q("g-rowsum").onclick = () => { const r = num("g-r"); if (need(!isNaN(r), "Type a whole-number row first.")) load(g2.rowSum(r)); };
    q("g-find").onclick = () => load(g2.find(gval()));
    q("g-rowmajor").onclick = () => load(g2.traverse(true));
    q("g-colmajor").onclick = () => load(g2.traverse(false));
    q("g-new").onclick = () => {
      const rows = D.clamp(num("g-rows") || 4, 1, 6), cols = D.clamp(num("g-cols") || 5, 1, 8);
      q("g-rows").value = rows; q("g-cols").value = cols;
      g2New(rows, cols);
      stillTab("New " + rows + " × " + cols + " array of random values.");
    };

    /* singly + doubly share one toolbar */
    const L = () => LL[tab];
    const ops = () => (tab === "double" ? dll : sll);
    q("ll-af").onclick = () => load(ops().addFirst(val()));
    q("ll-al").onclick = () => load(ops().addLast(val()));
    q("ll-ins").onclick = () => {
      const n = L().length, i = idx();
      if (i == null) return;
      if (i === 0) return load(ops().addFirst(val()));
      if (tab === "double" && i === n) return load(dll.addLast(val()));
      load(ops().insert(i, val()));
    };
    q("ll-rf").onclick = () => load(ops().removeFirst());
    q("ll-rl").onclick = () => load(ops().removeLast());
    q("ll-rat").onclick = () => {
      const n = L().length, i = idx();
      if (i == null) return;
      if (i === 0) return load(ops().removeFirst());
      if (tab === "double" && i === n - 1) return load(dll.removeLast());
      load(ops().remove(i));
    };
    q("ll-find").onclick = () => load(sll.indexOf(val(), tab));
    q("ll-rev").onclick = () => load(sll.reverse());
    q("ll-back").onclick = () => load(dll.backward());
    q("ll-rand").onclick = () => { LL[tab] = D.randArray(D.randInt(4, 6), 10, 99); stillTab("Built a list of " + L().length + " random nodes."); };
    q("ll-clear").onclick = () => { LL[tab] = []; stillTab("Cleared: head = tail = null."); };

    /* circular */
    q("cl-af").onclick = () => load(cll.addFirst(val()));
    q("cl-al").onclick = () => load(cll.addLast(val()));
    q("cl-rf").onclick = () => load(cll.removeFirst());
    q("cl-rot").onclick = () => load(cll.rotate());
    q("cl-find").onclick = () => load(cll.indexOf(val()));
    q("cl-rand").onclick = () => { LL.circular = D.randArray(D.randInt(4, 6), 10, 99); stillTab("Built a ring of " + LL.circular.length + " random nodes."); };
    q("cl-clear").onclick = () => { LL.circular = []; stillTab("Cleared: tail = null."); };

    D.legend("#legend", [
      { color: "var(--c-active)", label: "current position / pointer" },
      { color: "var(--c-cmp)", label: "being examined" },
      { color: "var(--c-swap)", label: "moving / being removed" },
      { color: "var(--c-done)", label: "written / result" },
      { color: "var(--c-target)", label: "the answer" },
      { color: "var(--c-visit)", label: "already visited" },
    ]);

    /* seed data */
    faFill([23, 47, 8, 91, 15]);
    daReset(4);
    [23, 47, 8, 91, 15].forEach((v) => da.add(v));
    DA.copies = 0; DA.grows = 0; DA.history = [DA.cap];
    g2New(4, 5);
    LL.single = [31, 7, 64, 12];
    LL.double = [31, 7, 64, 12];
    LL.circular = [31, 7, 64, 12];

    D.Tabs("#tabs", [
      { id: "fixed", label: "Fixed array" },
      { id: "dynamic", label: "Dynamic array" },
      { id: "grid", label: "2-D array" },
      { id: "single", label: "Singly linked" },
      { id: "double", label: "Doubly linked" },
      { id: "circular", label: "Circularly linked" },
    ], selectTab);
  });
})();
