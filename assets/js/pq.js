/* ============================================================
   pq.js — the Priority Queue ADT, four ways:
     unsorted list · sorted list · array-based heap · tree-based heap
   plus PQ-sort in its three classic forms:
     selection sort (unsorted list) · insertion sort (sorted list) · heap sort (heap)
   All priority queues are min-oriented: smallest key = highest priority.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const q = (id) => D.$("#" + id);
  const MAXN = 31;

  /* ============================================================
     CODE LISTINGS
     ============================================================ */
  const UP_HEAP = {
    pseudo: [
      "",
      "upHeap(j):",
      "  while j > 0: @@uloop",
      "    p ← ⌊(j - 1) / 2⌋                    // parent index @@parent",
      "    if H[j] ≥ H[p]: break                // heap order holds @@ucmp",
      "    swap H[j], H[p] @@uswap",
      "    j ← p @@up",
    ],
    java: [
      "",
      "void upHeap(int j) {",
      "  while (j > 0) { @@uloop",
      "    int p = (j - 1) / 2; @@parent",
      "    if (heap.get(j) >= heap.get(p)) break; @@ucmp",
      "    swap(j, p); @@uswap",
      "    j = p; @@up",
      "  }",
      "}",
    ],
    cpp: [
      "",
      "void upHeap(int j) {",
      "  while (j > 0) { @@uloop",
      "    int p = (j - 1) / 2; @@parent",
      "    if (heap[j] >= heap[p]) break; @@ucmp",
      "    swap(heap[j], heap[p]); @@uswap",
      "    j = p; @@up",
      "  }",
      "}",
    ],
    python: [
      "",
      "def _up_heap(self, j):",
      "  while j > 0: @@uloop",
      "    p = (j - 1) // 2 @@parent",
      "    if self.heap[j] >= self.heap[p]: @@ucmp",
      "      break @@ucmp",
      "    self.heap[j], self.heap[p] = self.heap[p], self.heap[j] @@uswap",
      "    j = p @@up",
    ],
  };
  const DOWN_HEAP = {
    pseudo: [
      "",
      "downHeap(j):",
      "  while 2j + 1 < n: @@dloop",
      "    c ← 2j + 1                           // left child @@left",
      "    if c + 1 < n and H[c+1] < H[c]: c ← c + 1   // the smaller child @@right",
      "    if H[c] ≥ H[j]: break                // heap order holds @@dcmp",
      "    swap H[j], H[c] @@dswap",
      "    j ← c @@down",
    ],
    java: [
      "",
      "void downHeap(int j) {",
      "  int n = heap.size();",
      "  while (2 * j + 1 < n) { @@dloop",
      "    int c = 2 * j + 1; @@left",
      "    if (c + 1 < n && heap.get(c + 1) < heap.get(c)) c++; @@right",
      "    if (heap.get(c) >= heap.get(j)) break; @@dcmp",
      "    swap(j, c); @@dswap",
      "    j = c; @@down",
      "  }",
      "}",
    ],
    cpp: [
      "",
      "void downHeap(int j) {",
      "  int n = heap.size();",
      "  while (2 * j + 1 < n) { @@dloop",
      "    int c = 2 * j + 1; @@left",
      "    if (c + 1 < n && heap[c + 1] < heap[c]) c++; @@right",
      "    if (heap[c] >= heap[j]) break; @@dcmp",
      "    swap(heap[j], heap[c]); @@dswap",
      "    j = c; @@down",
      "  }",
      "}",
    ],
    python: [
      "",
      "def _down_heap(self, j):",
      "  n = len(self.heap)",
      "  while 2 * j + 1 < n: @@dloop",
      "    c = 2 * j + 1 @@left",
      "    if c + 1 < n and self.heap[c + 1] < self.heap[c]: @@right",
      "      c += 1 @@right",
      "    if self.heap[c] >= self.heap[j]: @@dcmp",
      "      break @@dcmp",
      "    self.heap[j], self.heap[c] = self.heap[c], self.heap[j] @@dswap",
      "    j = c @@down",
    ],
  };
  const NODE_AT = {
    pseudo: [
      "",
      "nodeAt(pos):                         // 1-based position in level order",
      "  cur ← root",
      "  for each bit of pos after its leading 1:",
      "    cur ← (bit == 0) ? cur.left : cur.right @@bit",
      "  return cur",
    ],
    java: [
      "",
      "Node nodeAt(int pos) {              // 1-based position in level order",
      "  Node cur = root;",
      "  for (int b = Integer.highestOneBit(pos) >> 1; b > 0; b >>= 1)",
      "    cur = (pos & b) == 0 ? cur.left : cur.right;   // 0 = left, 1 = right @@bit",
      "  return cur;",
      "}",
    ],
    cpp: [
      "",
      "Node* nodeAt(int pos) {             // 1-based position in level order",
      "  Node* cur = root;",
      "  for (int b = (1 << (31 - __builtin_clz(pos))) >> 1; b > 0; b >>= 1)",
      "    cur = (pos & b) == 0 ? cur->left : cur->right; @@bit",
      "  return cur;",
      "}",
    ],
    python: [
      "",
      "def _node_at(self, pos):             # 1-based position in level order",
      "  cur = self.root",
      "  for bit in bin(pos)[3:]:           # the bits after '0b1'",
      "    cur = cur.left if bit == '0' else cur.right @@bit",
      "  return cur",
    ],
  };
  const withTail = (base, tail) => {
    const o = { title: base.title };
    ["pseudo", "java", "cpp", "python"].forEach((l) => (o[l] = base[l].concat(tail[l])));
    return o;
  };

  const CODE = {
    /* ---------- unsorted list ---------- */
    u_insert: {
      title: "insert(k) — unsorted list",
      pseudo: ["insert(k):", "  L.addLast(k)                 // no order to maintain: O(1) @@add"],
      java: ["void insert(int k) {", "  list.add(k);                 // O(1) @@add", "}"],
      cpp: ["void insert(int k) {", "  list.push_back(k);           // O(1) @@add", "}"],
      python: ["def insert(self, k):", "  self.list.append(k)          # O(1) @@add"],
    },
    u_min: {
      title: "min() — unsorted list",
      pseudo: ["min():", "  if L is empty: return null @@empty", "  best ← L[0] @@init", "  for each key k in L: @@loop", "    if k < best: best ← k @@cmp", "  return best                  // a full scan: O(n) @@ret"],
      java: ["int min() {", "  if (list.isEmpty()) throw new NoSuchElementException(); @@empty", "  int best = list.get(0); @@init", "  for (int k : list) @@loop", "    if (k < best) best = k; @@cmp", "  return best; @@ret", "}"],
      cpp: ["int min() const {", "  if (list.empty()) throw underflow_error(\"empty\"); @@empty", "  int best = list[0]; @@init", "  for (int k : list) @@loop", "    if (k < best) best = k; @@cmp", "  return best; @@ret", "}"],
      python: ["def min(self):", "  if not self.list: @@empty", "    return None @@empty", "  best = self.list[0] @@init", "  for k in self.list: @@loop", "    if k < best: @@cmp", "      best = k @@cmp", "  return best @@ret"],
    },
    u_removeMin: {
      title: "removeMin() — unsorted list",
      pseudo: [
        "removeMin():",
        "  if L is empty: return null @@empty",
        "  b ← 0                        // index of the smallest so far @@init",
        "  for i ← 1 to size-1: @@loop",
        "    if L[i] < L[b]: b ← i @@cmp",
        "  return L.remove(b)           // scanning makes this O(n) @@remove",
      ],
      java: [
        "int removeMin() {",
        "  if (list.isEmpty()) throw new NoSuchElementException(); @@empty",
        "  int b = 0; @@init",
        "  for (int i = 1; i < list.size(); i++) @@loop",
        "    if (list.get(i) < list.get(b)) b = i; @@cmp",
        "  return list.remove(b); @@remove",
        "}",
      ],
      cpp: [
        "int removeMin() {",
        "  if (list.empty()) throw underflow_error(\"empty\"); @@empty",
        "  int b = 0; @@init",
        "  for (int i = 1; i < (int)list.size(); i++) @@loop",
        "    if (list[i] < list[b]) b = i; @@cmp",
        "  int k = list[b];  list.erase(list.begin() + b); @@remove",
        "  return k; @@remove",
        "}",
      ],
      python: [
        "def remove_min(self):",
        "  if not self.list: @@empty",
        "    return None @@empty",
        "  b = 0 @@init",
        "  for i in range(1, len(self.list)): @@loop",
        "    if self.list[i] < self.list[b]: @@cmp",
        "      b = i @@cmp",
        "  return self.list.pop(b) @@remove",
      ],
    },

    /* ---------- sorted list ---------- */
    s_insert: {
      title: "insert(k) — sorted list",
      pseudo: [
        "insert(k):",
        "  i ← size                     // start at the back @@init",
        "  while i > 0 and L[i-1] > k:  // walk left past bigger keys @@cmp",
        "    i ← i - 1 @@walk",
        "  L.add(i, k)                  // L stays sorted; O(n) overall @@add",
      ],
      java: ["void insert(int k) {", "  int i = list.size(); @@init", "  while (i > 0 && list.get(i - 1) > k) @@cmp", "    i--; @@walk", "  list.add(i, k); @@add", "}"],
      cpp: ["void insert(int k) {", "  int i = list.size(); @@init", "  while (i > 0 && list[i - 1] > k) @@cmp", "    i--; @@walk", "  list.insert(list.begin() + i, k); @@add", "}"],
      python: ["def insert(self, k):", "  i = len(self.list) @@init", "  while i > 0 and self.list[i - 1] > k: @@cmp", "    i -= 1 @@walk", "  self.list.insert(i, k) @@add"],
    },
    s_min: {
      title: "min() — sorted list",
      pseudo: ["min():", "  if L is empty: return null @@empty", "  return L[0]                  // always at the front: O(1) @@ret"],
      java: ["int min() {", "  if (list.isEmpty()) throw new NoSuchElementException(); @@empty", "  return list.get(0); @@ret", "}"],
      cpp: ["int min() const {", "  if (list.empty()) throw underflow_error(\"empty\"); @@empty", "  return list.front(); @@ret", "}"],
      python: ["def min(self):", "  if not self.list: @@empty", "    return None @@empty", "  return self.list[0] @@ret"],
    },
    s_removeMin: {
      title: "removeMin() — sorted list",
      pseudo: ["removeMin():", "  if L is empty: return null @@empty", "  return L.removeFirst()       // the min is at the front: O(1) @@remove"],
      java: ["int removeMin() {", "  if (list.isEmpty()) throw new NoSuchElementException(); @@empty", "  return list.removeFirst();   // LinkedList: O(1) @@remove", "}"],
      cpp: ["int removeMin() {              // list is a std::deque", "  if (list.empty()) throw underflow_error(\"empty\"); @@empty", "  int k = list.front();  list.pop_front(); @@remove", "  return k; @@remove", "}"],
      python: ["def remove_min(self):         # self.list is a collections.deque", "  if not self.list: @@empty", "    return None @@empty", "  return self.list.popleft() @@remove"],
    },

    /* ---------- array heap ---------- */
    a_insert: withTail({
      title: "insert(k) — array heap",
      pseudo: ["insert(k):", "  H[n] ← k;  n ← n + 1         // next free slot keeps the tree complete @@append", "  upHeap(n - 1) @@call"],
      java: ["void insert(int k) {", "  heap.add(k);                  // next free slot @@append", "  upHeap(heap.size() - 1); @@call", "}"],
      cpp: ["void insert(int k) {", "  heap.push_back(k);            // next free slot @@append", "  upHeap(heap.size() - 1); @@call", "}"],
      python: ["def insert(self, k):", "  self.heap.append(k)           # next free slot @@append", "  self._up_heap(len(self.heap) - 1) @@call"],
    }, UP_HEAP),
    a_removeMin: withTail({
      title: "removeMin() — array heap",
      pseudo: [
        "removeMin():",
        "  if n == 0: return null @@empty",
        "  min ← H[0] @@save",
        "  H[0] ← H[n-1];  n ← n - 1     // the last leaf moves to the root @@last",
        "  downHeap(0) @@call",
        "  return min @@ret",
      ],
      java: [
        "int removeMin() {",
        "  if (heap.isEmpty()) throw new NoSuchElementException(); @@empty",
        "  int min = heap.get(0); @@save",
        "  int last = heap.remove(heap.size() - 1); @@last",
        "  if (!heap.isEmpty()) { heap.set(0, last);  downHeap(0); } @@call",
        "  return min; @@ret",
        "}",
      ],
      cpp: [
        "int removeMin() {",
        "  if (heap.empty()) throw underflow_error(\"empty\"); @@empty",
        "  int mn = heap[0]; @@save",
        "  heap[0] = heap.back();  heap.pop_back(); @@last",
        "  if (!heap.empty()) downHeap(0); @@call",
        "  return mn; @@ret",
        "}",
      ],
      python: [
        "def remove_min(self):",
        "  if not self.heap: @@empty",
        "    return None @@empty",
        "  mn = self.heap[0] @@save",
        "  last = self.heap.pop() @@last",
        "  if self.heap: @@call",
        "    self.heap[0] = last @@call",
        "    self._down_heap(0) @@call",
        "  return mn @@ret",
      ],
    }, DOWN_HEAP),
    a_min: {
      title: "min() — array heap",
      pseudo: ["min():", "  if n == 0: return null @@empty", "  return H[0]                  // the root: O(1) @@ret"],
      java: ["int min() {", "  if (heap.isEmpty()) throw new NoSuchElementException(); @@empty", "  return heap.get(0); @@ret", "}"],
      cpp: ["int min() const {", "  if (heap.empty()) throw underflow_error(\"empty\"); @@empty", "  return heap[0]; @@ret", "}"],
      python: ["def min(self):", "  if not self.heap: @@empty", "    return None @@empty", "  return self.heap[0] @@ret"],
    },
    a_heapify: withTail({
      title: "heapify(A) — bottom-up construction",
      pseudo: ["heapify(A):", "  H ← A;  n ← length(A) @@init", "  for j ← ⌊n/2⌋ - 1 down to 0:   // the leaves are heaps already @@loop", "    downHeap(j) @@call"],
      java: ["void heapify(int[] a) {", "  heap.clear();  for (int x : a) heap.add(x); @@init", "  for (int j = heap.size() / 2 - 1; j >= 0; j--) @@loop", "    downHeap(j); @@call", "}"],
      cpp: ["void heapify(const vector<int>& a) {", "  heap = a; @@init", "  for (int j = (int)heap.size() / 2 - 1; j >= 0; j--) @@loop", "    downHeap(j); @@call", "}"],
      python: ["def heapify(self, a):", "  self.heap = list(a) @@init", "  for j in range(len(a) // 2 - 1, -1, -1): @@loop", "    self._down_heap(j) @@call"],
    }, DOWN_HEAP),
    a_build: withTail({
      title: "build by repeated insertion",
      pseudo: ["buildByInsertion(A):", "  H ← empty heap @@init", "  for each x in A: @@loop", "    insert(x)                  // append + upHeap: O(log n) each @@call"],
      java: ["void buildByInsertion(int[] a) {", "  heap.clear(); @@init", "  for (int x : a) @@loop", "    insert(x); @@call", "}"],
      cpp: ["void buildByInsertion(const vector<int>& a) {", "  heap.clear(); @@init", "  for (int x : a) @@loop", "    insert(x); @@call", "}"],
      python: ["def build_by_insertion(self, a):", "  self.heap = [] @@init", "  for x in a: @@loop", "    self.insert(x) @@call"],
    }, UP_HEAP),

    /* ---------- tree heap (linked nodes) ---------- */
    t_insert: withTail({
      title: "insert(k) — linked tree heap",
      pseudo: [
        "insert(k):",
        "  node ← new Node(k);  n ← n + 1 @@alloc",
        "  if n == 1: root ← node; return @@empty",
        "  parent ← nodeAt(⌊n/2⌋)             // walk down to where the new leaf hangs @@walk",
        "  if n is even: parent.left ← node   else: parent.right ← node @@attachL,attachR",
        "  node.parent ← parent @@attachL,attachR",
        "  while node.parent ≠ null and node.key < node.parent.key: @@ucmp",
        "    swap keys of node and node.parent;  node ← node.parent @@uswap",
      ],
      java: [
        "void insert(int k) {",
        "  Node node = new Node(k);  n++; @@alloc",
        "  if (n == 1) { root = node; return; } @@empty",
        "  Node parent = nodeAt(n / 2); @@walk",
        "  if (n % 2 == 0) parent.left = node; else parent.right = node; @@attachL,attachR",
        "  node.parent = parent; @@attachL,attachR",
        "  while (node.parent != null && node.key < node.parent.key) { @@ucmp",
        "    swapKeys(node, node.parent);  node = node.parent; @@uswap",
        "  }",
        "}",
      ],
      cpp: [
        "void insert(int k) {",
        "  Node* node = new Node(k);  n++; @@alloc",
        "  if (n == 1) { root = node; return; } @@empty",
        "  Node* parent = nodeAt(n / 2); @@walk",
        "  if (n % 2 == 0) parent->left = node; else parent->right = node; @@attachL,attachR",
        "  node->parent = parent; @@attachL,attachR",
        "  while (node->parent && node->key < node->parent->key) { @@ucmp",
        "    swap(node->key, node->parent->key);  node = node->parent; @@uswap",
        "  }",
        "}",
      ],
      python: [
        "def insert(self, k):",
        "  node = Node(k) @@alloc",
        "  self.n += 1 @@alloc",
        "  if self.n == 1: @@empty",
        "    self.root = node @@empty",
        "    return @@empty",
        "  parent = self._node_at(self.n // 2) @@walk",
        "  if self.n % 2 == 0: @@attachL,attachR",
        "    parent.left = node @@attachL",
        "  else: @@attachR",
        "    parent.right = node @@attachR",
        "  node.parent = parent @@attachL,attachR",
        "  while node.parent and node.key < node.parent.key: @@ucmp",
        "    node.key, node.parent.key = node.parent.key, node.key @@uswap",
        "    node = node.parent @@uswap",
      ],
    }, NODE_AT),
    t_removeMin: withTail({
      title: "removeMin() — linked tree heap",
      pseudo: [
        "removeMin():",
        "  if n == 0: return null @@empty",
        "  min ← root.key @@save",
        "  last ← nodeAt(n)                  // the rightmost leaf of the bottom level @@walk",
        "  root.key ← last.key @@move",
        "  unlink last from its parent;  n ← n - 1 @@detach1,detachL,detachR",
        "  cur ← root @@start",
        "  while cur.left ≠ null: @@dloop",
        "    c ← whichever child of cur has the smaller key @@child",
        "    if c.key ≥ cur.key: break @@dcmp",
        "    swap keys of cur and c;  cur ← c @@dswap",
        "  return min @@ret",
      ],
      java: [
        "int removeMin() {",
        "  if (n == 0) throw new NoSuchElementException(); @@empty",
        "  int min = root.key; @@save",
        "  Node last = nodeAt(n); @@walk",
        "  root.key = last.key; @@move",
        "  if (n == 1) root = null; @@detach1,detachL,detachR",
        "  else if (n % 2 == 0) last.parent.left = null; else last.parent.right = null; @@detachL,detachR",
        "  n--; @@detach1,detachL,detachR",
        "  Node cur = root; @@start",
        "  while (cur != null && cur.left != null) { @@dloop",
        "    Node c = cur.left; @@child",
        "    if (cur.right != null && cur.right.key < c.key) c = cur.right; @@child",
        "    if (c.key >= cur.key) break; @@dcmp",
        "    swapKeys(cur, c);  cur = c; @@dswap",
        "  }",
        "  return min; @@ret",
        "}",
      ],
      cpp: [
        "int removeMin() {",
        "  if (n == 0) throw underflow_error(\"empty\"); @@empty",
        "  int mn = root->key; @@save",
        "  Node* last = nodeAt(n); @@walk",
        "  root->key = last->key; @@move",
        "  if (n == 1) root = nullptr; @@detach1,detachL,detachR",
        "  else if (n % 2 == 0) last->parent->left = nullptr; else last->parent->right = nullptr; @@detachL,detachR",
        "  delete last;  n--; @@detach1,detachL,detachR",
        "  Node* cur = root; @@start",
        "  while (cur && cur->left) { @@dloop",
        "    Node* c = cur->left; @@child",
        "    if (cur->right && cur->right->key < c->key) c = cur->right; @@child",
        "    if (c->key >= cur->key) break; @@dcmp",
        "    swap(cur->key, c->key);  cur = c; @@dswap",
        "  }",
        "  return mn; @@ret",
        "}",
      ],
      python: [
        "def remove_min(self):",
        "  if self.n == 0: @@empty",
        "    return None @@empty",
        "  mn = self.root.key @@save",
        "  last = self._node_at(self.n) @@walk",
        "  self.root.key = last.key @@move",
        "  if self.n == 1: @@detach1,detachL,detachR",
        "    self.root = None @@detach1",
        "  elif self.n % 2 == 0: @@detachL,detachR",
        "    last.parent.left = None @@detachL",
        "  else: @@detachR",
        "    last.parent.right = None @@detachR",
        "  self.n -= 1 @@detach1,detachL,detachR",
        "  cur = self.root @@start",
        "  while cur and cur.left: @@dloop",
        "    c = cur.left @@child",
        "    if cur.right and cur.right.key < c.key: @@child",
        "      c = cur.right @@child",
        "    if c.key >= cur.key: @@dcmp",
        "      break @@dcmp",
        "    cur.key, c.key = c.key, cur.key @@dswap",
        "    cur = c @@dswap",
        "  return mn @@ret",
      ],
    }, NODE_AT),
    t_min: {
      title: "min() — linked tree heap",
      pseudo: ["min():", "  if root == null: return null @@empty", "  return root.key @@ret"],
      java: ["int min() {", "  if (root == null) throw new NoSuchElementException(); @@empty", "  return root.key; @@ret", "}"],
      cpp: ["int min() const {", "  if (!root) throw underflow_error(\"empty\"); @@empty", "  return root->key; @@ret", "}"],
      python: ["def min(self):", "  if self.root is None: @@empty", "    return None @@empty", "  return self.root.key @@ret"],
    },
  };
  /* PQ-sort: one generic algorithm, three priority queues */
  function sortCode(title, insCost, remCost) {
    return {
      title: title,
      pseudo: [
        "pqSort(S):                     // P is " + title.split(" = ")[1],
        "  P ← new PriorityQueue @@init",
        "  while S is not empty:          // phase 1 @@p1",
        "    P.insert(S.removeFirst())    // " + insCost + " each @@insert",
        "  while P is not empty:          // phase 2 @@p2",
        "    S.addLast(P.removeMin())     // " + remCost + " each @@remove",
      ],
      java: [
        "void pqSort(Deque<Integer> s, PQ p) { @@init",
        "  while (!s.isEmpty()) @@p1",
        "    p.insert(s.removeFirst());   // " + insCost + " @@insert",
        "  while (!p.isEmpty()) @@p2",
        "    s.addLast(p.removeMin());    // " + remCost + " @@remove",
        "}",
      ],
      cpp: [
        "void pqSort(deque<int>& s, PQ& p) { @@init",
        "  while (!s.empty()) { @@p1",
        "    p.insert(s.front());  s.pop_front();   // " + insCost + " @@insert",
        "  }",
        "  while (!p.empty()) @@p2",
        "    s.push_back(p.removeMin());   // " + remCost + " @@remove",
        "}",
      ],
      python: [
        "def pq_sort(s, p): @@init",
        "  while s: @@p1",
        "    p.insert(s.popleft())        # " + insCost + " @@insert",
        "  while not p.is_empty(): @@p2",
        "    s.append(p.remove_min())     # " + remCost + " @@remove",
      ],
    };
  }
  CODE.sort_selection = sortCode("selection sort = pqSort with an unsorted list", "O(1)", "O(n)");
  CODE.sort_insertion = sortCode("insertion sort = pqSort with a sorted list", "O(n)", "O(1)");
  CODE.sort_heap = sortCode("heap sort = pqSort with a heap", "O(log n)", "O(log n)");

  /* ============================================================
     SPECS
     ============================================================ */
  const M = (t) => "<span class='mono'>" + t + "</span>";
  const pqSortSpec = (how, p1, p2, cls, py) => ({ does: "Sorts S by inserting every key into a priority queue P, then removing the minimum n times. With " + how + ".", params: M("S") + " — the sequence to sort · " + M("P") + " — an empty priority queue", returns: "nothing — S ends up in ascending order", errors: "none", cost: "phase 1 " + p1 + " · phase 2 " + p2, callVals: { s: "s", p: { java: "new " + cls + "()", cpp: "pq", python: py + "()" } } });
  D.specs(CODE, {
    u_insert: { does: "Adds key " + M("k") + " anywhere — an unsorted list just appends.", params: M("k") + " — the key", returns: "nothing", errors: "none", cost: "O(1)" },
    u_min: { does: "Finds the smallest key by scanning the whole list.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(n)" },
    u_removeMin: { does: "Scans for the smallest key, removes it and returns it.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(n)" },
    s_insert: { does: "Walks the sorted list to " + M("k") + "'s place and inserts it there, keeping the list sorted.", params: M("k") + " — the key", returns: "nothing", errors: "none", cost: "O(n) worst case (a key smaller than everything walks the whole list)" },
    s_min: { does: "Returns the first element — the list is kept sorted, so it is the minimum.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(1)" },
    s_removeMin: { does: "Removes and returns the first element.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(1)" },
    a_insert: { does: "Appends " + M("k") + " at the end of the heap array, then up-heaps it past larger parents.", params: M("k") + " — the key", returns: "nothing", errors: "none", cost: "O(log n)" },
    a_removeMin: { does: "Returns the root, moves the last element to the root, then down-heaps it past smaller children.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(log n)" },
    a_min: { does: "Returns the root of the heap — always the minimum.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(1)" },
    a_heapify: { does: "Turns an arbitrary array into a heap bottom-up: down-heap every internal node from the last one back to the root.", params: M("A") + " — the keys", returns: "nothing — the heap now holds A", errors: "none", cost: "Θ(n) — most nodes are near the bottom and barely move", callVals: { A: "A", a: "a" } },
    a_build: { does: "Builds a heap by inserting the keys one at a time.", params: M("A") + " — the keys", returns: "nothing", errors: "none", cost: "O(n log n) — compare with bottom-up heapify" },
    t_insert: { does: "Hangs a new node at the next free position (found by reading n in binary), then up-heaps it.", params: M("k") + " — the key", returns: "nothing", errors: "none", cost: "O(log n) for the walk plus O(log n) for up-heap" },
    t_removeMin: { does: "Returns the root's key, moves the last node's key to the root, unlinks the last node, then down-heaps.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(log n)" },
    t_min: { does: "Returns the root's key.", params: "none", returns: "the minimum key", errors: "empty priority queue", cost: "O(1)" },
    sort_selection: pqSortSpec("an <b>unsorted list</b> as P this is selection sort", "O(n)", "O(n²)", "UnsortedListPQ", "UnsortedListPQ"),
    sort_insertion: pqSortSpec("a <b>sorted list</b> as P this is insertion sort", "O(n²) (O(n) if already sorted)", "O(n)", "SortedListPQ", "SortedListPQ"),
    sort_heap: pqSortSpec("a <b>heap</b> as P this is heap sort", "O(n log n)", "O(n log n)", "HeapPQ", "HeapPQ"),
  });

  /* ============================================================
     STATE
     ============================================================ */
  const U = { a: [] };      /* unsorted list */
  const S = { a: [] };      /* sorted list */
  const H = { a: [] };      /* array heap */
  const T = { a: [] };      /* tree heap — keys kept in level order; the tree is linked */
  let tab = "unsorted", player, dock;
  let cmp = 0, swaps = 0;

  const P = (i) => Math.floor((i - 1) / 2);

  /* ============================================================
     LIST-BASED PQs
     ============================================================ */
  const listRec = (L, sorted) => D.Rec(() => ({ kind: "list", sorted: sorted, a: L.a.slice(), marks: {}, ptrs: {}, cmp: cmp }));

  const unsorted = {
    insert(k) {
      const r = listRec(U, false).code("u_insert");
      r.snap({ note: "<b>insert(" + k + ")</b> — an unsorted list doesn't care where keys go." });
      U.a.push(k);
      r.at("add").snap({ marks: { [U.a.length - 1]: "done" }, note: "Append " + k + " at the end. <b>O(1)</b>. All the work is postponed until someone asks for the minimum." });
      return r;
    },
    scan(r, remove) {
      r.code(remove ? "u_removeMin" : "u_min");
      r.snap({ note: "<b>" + (remove ? "removeMin()" : "min()") + "</b> — nothing is ordered, so every key must be checked." });
      if (!U.a.length) { r.at("empty").snap({ note: "Empty — return null." }); return; }
      r.at("empty^").snap({ note: "Not empty." });
      let b = 0;
      r.at("init").snap({ marks: { 0: "target" }, ptrs: { 0: "best" }, note: "Assume L[0] = " + U.a[0] + " is the smallest." });
      for (let i = 1; i < U.a.length; i++) {
        cmp++;
        r.at("loop").snap({ marks: { [b]: "target", [i]: "active" }, ptrs: { [b]: "best", [i]: "i" }, note: "Next key: L[" + i + "] = " + U.a[i] + "." });
        const less = U.a[i] < U.a[b];
        const old = U.a[b];
        if (less) b = i;
        r.at("cmp").snap({ marks: { [b]: "target", [i]: less ? "target" : "cmp" }, ptrs: { [b]: "best", [i]: less ? "best / i" : "i" }, note: "Is " + U.a[i] + " &lt; the best so far, " + old + "? " + (less ? "<b>Yes</b>: the best is now " + U.a[b] + "." : "No.") });
      }
      if (!remove) { r.at("ret").snap({ marks: { [b]: "done" }, ptrs: { [b]: "min" }, note: "min = <b>" + U.a[b] + "</b> after " + (U.a.length - 1) + " comparisons: <b>O(n)</b>." }); return; }
      const v = U.a[b];
      r.at("remove").snap({ marks: { [b]: "swap" }, ptrs: { [b]: "min" }, note: "The minimum is " + v + " at index " + b + ". Remove it." });
      U.a.splice(b, 1);
      r.at("remove").snap({ note: "Return <b>" + v + "</b>. Every removeMin rescans the whole list: <b>O(n)</b>." });
    },
    min() { const r = listRec(U, false); this.scan(r, false); return r; },
    removeMin() { const r = listRec(U, false); this.scan(r, true); return r; },
  };

  const sorted = {
    insert(k) {
      const r = listRec(S, true).code("s_insert");
      r.snap({ note: "<b>insert(" + k + ")</b> — keep the list sorted, so find " + k + "'s place." });
      let i = S.a.length;
      r.at("init").snap({ ptrs: { [i]: "i" }, gap: i, note: "Start at the back: i = " + i + "." });
      while (i > 0) {
        cmp++;
        r.at("cmp").snap({ marks: { [i - 1]: "cmp" }, ptrs: { [i]: "i" }, gap: i, note: "Is L[" + (i - 1) + "] = " + S.a[i - 1] + " &gt; " + k + "?" });
        if (!(S.a[i - 1] > k)) break;
        i--;
        r.at("walk").snap({ marks: { [i]: "visit" }, ptrs: { [i]: "i" }, gap: i, note: "Yes — step left. i = " + i + "." });
      }
      S.a.splice(i, 0, k);
      r.at("add").snap({ marks: { [i]: "done" }, note: "Insert " + k + " at index " + i + ". The walk makes insert <b>O(n)</b> in the worst case." });
      return r;
    },
    min() {
      const r = listRec(S, true).code("s_min");
      r.snap({ note: "<b>min()</b>." });
      if (!S.a.length) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      r.at("ret").snap({ marks: { 0: "target" }, note: "The smallest key is always first: <b>" + S.a[0] + "</b>. <b>O(1)</b>." });
      return r;
    },
    removeMin() {
      const r = listRec(S, true).code("s_removeMin");
      r.snap({ note: "<b>removeMin()</b>." });
      if (!S.a.length) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      const v = S.a[0];
      r.at("remove").snap({ marks: { 0: "swap" }, note: "Take the front: " + v + "." });
      S.a.shift();
      r.at("remove").snap({ note: "Return <b>" + v + "</b>. <b>O(1)</b> on a linked list, because the insert already did the work." });
      return r;
    },
  };

  /* ============================================================
     HEAPS  (shared sift routines; `kind` picks the view)
     ============================================================ */
  function heapRec(Hs, kind, limit) {
    return D.Rec(() => ({ kind: kind, a: Hs.a.slice(), marks: {}, cmp: cmp, swaps: swaps, path: null }), limit || 3000);
  }
  function upHeap(Hs, r, j, tree) {
    if (tree) return upHeapTree(Hs, r, j);
    const L = { loop: "uloop", par: "parent", cmp: "ucmp", swap: "uswap", up: "up" };
    while (j > 0) {
      const p = P(j);
      r.at(L.loop).snap({ marks: { [j]: "active" }, note: "j = " + j + " is not the root." });
      r.at(L.par).snap({ marks: { [j]: "active", [p]: "cmp" }, note: tree ? "Follow node.parent up to the node holding " + Hs.a[p] + "." : "parent(j) = ⌊(" + j + " − 1)/2⌋ = " + p + ", holding " + Hs.a[p] + "." });
      cmp++;
      if (Hs.a[j] >= Hs.a[p]) {
        r.at(L.cmp).snap({ marks: { [j]: "done", [p]: "visit" }, note: Hs.a[j] + " ≥ " + Hs.a[p] + ": heap order holds, so <b>stop</b>." });
        return;
      }
      r.at(L.cmp).snap({ marks: { [j]: "active", [p]: "cmp" }, note: Hs.a[j] + " &lt; " + Hs.a[p] + ": the child is smaller than its parent. That violates heap order." });
      [Hs.a[j], Hs.a[p]] = [Hs.a[p], Hs.a[j]];
      swaps++;
      r.at(L.swap).snap({ marks: { [j]: "swap", [p]: "swap" }, note: "Swap them. " + Hs.a[p] + " moves up a level." });
      j = p;
      if (!tree) r.at(L.up).snap({ marks: { [j]: "active" }, note: "j ← " + j + "." });
    }
    r.at(L.loop).snap({ marks: { 0: "done" }, note: "Reached the root: " + Hs.a[0] + " is the new minimum. At most ⌊log₂n⌋ swaps." });
  }
  /* the linked heap runs the same comparisons, but the code follows pointers, so the captions do too */
  function upHeapTree(Hs, r, j) {
    while (j > 0) {
      const p = P(j);
      cmp++;
      const less = Hs.a[j] < Hs.a[p];
      r.at("ucmp").snap({ marks: { [j]: "active", [p]: "cmp" }, note: "node.parent holds " + Hs.a[p] + ". Is node.key = " + Hs.a[j] + " &lt; " + Hs.a[p] + "? " + (less ? "<b>Yes</b>: heap order is broken." : "No: heap order holds, so the loop stops.") });
      if (!less) return;
      [Hs.a[j], Hs.a[p]] = [Hs.a[p], Hs.a[j]];
      swaps++;
      r.at("uswap").snap({ marks: { [j]: "swap", [p]: "swap" }, note: "Swap the two keys (the nodes stay put), then node ← node.parent." });
      j = p;
    }
    r.at("ucmp").snap({ marks: { 0: "done" }, note: "node.parent is null: we reached the root, so " + Hs.a[0] + " is the new minimum." });
  }
  function downHeapTree(Hs, r, j, n) {
    for (;;) {
      const l = 2 * j + 1, rr = 2 * j + 2;
      if (l >= n) { r.at("dloop").snap({ marks: { [j]: "done" }, note: "cur.left is null: cur is a leaf, so the loop ends." }); return; }
      r.at("dloop").snap({ marks: { [j]: "active" }, note: "cur (key " + Hs.a[j] + ") has a left child." });
      let c = l;
      if (rr < n) { cmp++; if (Hs.a[rr] < Hs.a[l]) c = rr; }
      r.at("child").snap({ marks: { [j]: "active", [l]: "cmp", ...(rr < n ? { [rr]: "cmp" } : {}) }, note: rr < n
        ? "Children hold " + Hs.a[l] + " (left) and " + Hs.a[rr] + " (right). c ← the " + (c === l ? "left" : "right") + " child, key " + Hs.a[c] + "."
        : "Only a left child, key " + Hs.a[l] + ". c ← cur.left." });
      cmp++;
      if (Hs.a[c] >= Hs.a[j]) { r.at("dcmp").snap({ marks: { [j]: "done", [c]: "visit" }, note: "c.key = " + Hs.a[c] + " ≥ cur.key = " + Hs.a[j] + ": order restored, <b>break</b>." }); return; }
      r.at("dcmp").snap({ marks: { [j]: "active", [c]: "cmp" }, note: "c.key = " + Hs.a[c] + " &lt; cur.key = " + Hs.a[j] + ": keep going." });
      [Hs.a[j], Hs.a[c]] = [Hs.a[c], Hs.a[j]];
      swaps++;
      r.at("dswap").snap({ marks: { [j]: "swap", [c]: "swap" }, note: "Swap the keys of cur and c, then cur ← c." });
      j = c;
    }
  }
  function downHeap(Hs, r, j, n, tree) {
    if (tree) return downHeapTree(Hs, r, j, n);
    const L = { loop: "dloop", left: "left", right: "right", cmp: "dcmp", swap: "dswap", down: "down" };
    for (;;) {
      const l = 2 * j + 1, rr = 2 * j + 2;
      if (l >= n) { r.at(L.loop).snap({ marks: { [j]: "done" }, note: "Index " + j + " is a leaf (2j + 1 = " + l + " ≥ n = " + n + "). Done." }); return; }
      r.at(L.loop).snap({ marks: { [j]: "active" }, note: "j = " + j + " has at least one child." });
      let c = l;
      r.at(L.left).snap({ marks: { [j]: "active", [l]: "cmp" }, note: "Left child: index " + l + " (" + Hs.a[l] + ")." });
      if (rr < n) {
        cmp++;
        if (Hs.a[rr] < Hs.a[l]) c = rr;
        r.at(L.right).snap({ marks: { [j]: "active", [l]: "cmp", [rr]: "cmp" }, note: "Right child " + Hs.a[rr] + " vs left " + Hs.a[l] + " → the smaller child is <b>" + Hs.a[c] + "</b>." });
      }
      cmp++;
      if (Hs.a[c] >= Hs.a[j]) { r.at(L.cmp).snap({ marks: { [j]: "done", [c]: "visit" }, note: Hs.a[c] + " ≥ " + Hs.a[j] + ": order restored, <b>stop</b>." }); return; }
      r.at(L.cmp).snap({ marks: { [j]: "active", [c]: "cmp" }, note: Hs.a[c] + " &lt; " + Hs.a[j] + " — the child should be on top." });
      [Hs.a[j], Hs.a[c]] = [Hs.a[c], Hs.a[j]];
      swaps++;
      r.at(L.swap).snap({ marks: { [j]: "swap", [c]: "swap" }, note: "Swap with the <b>smaller</b> child. If we swapped with the larger one, it would end up above a smaller key." });
      j = c;
      if (!tree) r.at(L.down).snap({ marks: { [j]: "active" }, note: "j ← " + j + "." });
    }
  }

  const aheap = {
    insert(k) {
      const r = heapRec(H, "aheap").code("a_insert");
      if (H.a.length >= MAXN) { r.snap({ note: "This demo caps the heap at " + MAXN + " keys so the tree fits." }); return r; }
      r.snap({ note: "<b>insert(" + k + ")</b> into a heap of " + H.a.length + "." });
      H.a.push(k);
      r.at("append").snap({ marks: { [H.a.length - 1]: "active" }, note: "Put " + k + " in the next free slot, index " + (H.a.length - 1) + ". The tree stays <b>complete</b>, but heap order may now be broken." });
      r.at("call").snap({ marks: { [H.a.length - 1]: "active" }, note: "upHeap(" + (H.a.length - 1) + ")." });
      upHeap(H, r, H.a.length - 1, false);
      return r;
    },
    removeMin() {
      const r = heapRec(H, "aheap").code("a_removeMin");
      r.snap({ note: "<b>removeMin()</b>." });
      if (!H.a.length) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "n = " + H.a.length + "." });
      const v = H.a[0];
      r.at("save").snap({ marks: { 0: "target" }, note: "min = H[0] = <b>" + v + "</b> — the root." });
      const last = H.a.length - 1;
      r.at("last").snap({ marks: { 0: "swap", [last]: "swap" }, note: "Move the last leaf (H[" + last + "] = " + H.a[last] + ") to the root. Removing the last slot is the only removal that keeps the tree complete." });
      H.a[0] = H.a[last];
      H.a.pop();
      if (!H.a.length) { r.at("ret").snap({ note: "The heap is now empty. Return " + v + "." }); return r; }
      r.at("call").snap({ marks: { 0: "active" }, note: "downHeap(0)." });
      downHeap(H, r, 0, H.a.length, false);
      r.at("ret").snap({ note: "Return <b>" + v + "</b>. <b>O(log n)</b>." });
      return r;
    },
    min() {
      const r = heapRec(H, "aheap").code("a_min");
      r.snap({ note: "<b>min()</b>." });
      if (!H.a.length) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      r.at("ret").snap({ marks: { 0: "target" }, note: "Return the root, <b>" + H.a[0] + "</b>. <b>O(1)</b>." });
      return r;
    },
    heapify(vals) {
      const r = heapRec(H, "aheap").code("a_heapify");
      H.a = vals.slice();
      r.at("init").snap({ note: "<b>Bottom-up heapify</b> of " + H.a.length + " arbitrary keys. Right now this is not a heap." });
      const start = Math.floor(H.a.length / 2) - 1;
      for (let j = start; j >= 0; j--) {
        r.at("loop").snap({ marks: { [j]: "active" }, note: "j = " + j + ". Indices ≥ " + Math.floor(H.a.length / 2) + " are leaves, and a leaf is already a heap. Both subtrees of " + j + " are valid heaps." });
        r.at("call").snap({ marks: { [j]: "active" }, note: "downHeap(" + j + ")." });
        downHeap(H, r, j, H.a.length, false);
      }
      r.at("loop").snap({ marks: { 0: "target" }, note: "Done: a valid heap in <b>Θ(n)</b>. Most nodes are near the bottom and can only sink a level or two. Σ h·n/2<sup>h+1</sup> &lt; n, so at most about 2n comparisons whatever the input." });
      return r;
    },
    build(vals) {
      const r = heapRec(H, "aheap").code("a_build");
      H.a = [];
      r.at("init").snap({ note: "<b>Build by repeated insertion</b> of the same " + vals.length + " keys." });
      vals.forEach((v) => {
        H.a.push(v);
        r.at("loop").snap({ marks: { [H.a.length - 1]: "active" }, note: "insert(" + v + ")." });
        r.at("call").snap({ marks: { [H.a.length - 1]: "active" }, note: "Append at index " + (H.a.length - 1) + ", then upHeap." });
        upHeap(H, r, H.a.length - 1, false);
      });
      r.at("loop").snap({ marks: { 0: "target" }, note: "A valid heap too, but the worst case is <b>Θ(n log n)</b>: each insert may climb the whole height. Compare the comparisons counter with bottom-up heapify on the same keys." });
      return r;
    },
  };

  const theap = {
    walkTo(r, pos, why) {
      /* pos is 1-based. Emit one frame per bit. */
      const bits = pos.toString(2).slice(1);
      let i = 0;
      const path = [0];
      r.snap({ marks: { 0: "active" }, path: path.slice(), bits: { pos: pos, done: 0 }, note: why + " Position " + pos + " in binary is <b>" + pos.toString(2) + "</b>. Drop the leading 1; each remaining bit is a turn: 0 = left, 1 = right." });
      for (let b = 0; b < bits.length; b++) {
        i = 2 * i + 1 + (bits[b] === "1" ? 1 : 0);
        path.push(i);
        r.at("bit").snap({ marks: { [i]: "active" }, path: path.slice(), bits: { pos: pos, done: b + 1 }, note: "Bit " + (b + 1) + " of " + bits.length + " is " + bits[b] + " → go <b>" + (bits[b] === "1" ? "right" : "left") + "</b>, to the node holding " + T.a[i] + "." });
      }
      return i;
    },
    insert(k) {
      const r = heapRec(T, "theap").code("t_insert");
      if (T.a.length >= MAXN) { r.snap({ note: "Capped at " + MAXN + " keys." }); return r; }
      r.snap({ note: "<b>insert(" + k + ")</b> into a linked heap of " + T.a.length + " nodes. There is no array, so we can't just say “slot n”: we have to <em>find</em> where the new leaf goes." });
      const n = T.a.length + 1;
      r.at("alloc").snap({ note: "Allocate a node; n becomes " + n + "." });
      if (n === 1) { T.a.push(k); r.at("empty").snap({ marks: { 0: "done" }, note: "The heap was empty: the node becomes the root." }); return r; }
      r.at("empty^").snap({ note: "n ≠ 1." });
      r.at("walk");
      const par = this.walkTo(r, Math.floor(n / 2), "The new node is position " + n + ". Its parent is position ⌊" + n + "/2⌋ = " + Math.floor(n / 2) + ".");
      T.a.push(k);
      r.at(n % 2 === 0 ? "attachL" : "attachR").snap({ marks: { [n - 1]: "done", [par]: "active" }, path: null, note: "Hang it as the <b>" + (n % 2 === 0 ? "left" : "right") + "</b> child (" + n + " is " + (n % 2 === 0 ? "even" : "odd") + "), and set node.parent. The walk cost O(log n) pointer hops." });
      upHeap(T, r, n - 1, true);
      return r;
    },
    removeMin() {
      const r = heapRec(T, "theap").code("t_removeMin");
      r.snap({ note: "<b>removeMin()</b>." });
      if (!T.a.length) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "n = " + T.a.length + "." });
      const v = T.a[0], n = T.a.length;
      r.at("save").snap({ marks: { 0: "target" }, note: "min = root.key = <b>" + v + "</b>." });
      r.at("walk");
      const last = this.walkTo(r, n, "Find the last node, position n = " + n + ".");
      r.at("move").snap({ marks: { 0: "swap", [last]: "swap" }, path: null, note: "Copy its key (" + T.a[last] + ") into the root." });
      T.a[0] = T.a[last];
      T.a.pop();
      if (!T.a.length) { r.at("detach1").snap({ note: "That was the only node. The heap is empty." }); r.at("ret").snap({ note: "Return " + v + "." }); return r; }
      r.at(n % 2 === 0 ? "detachL" : "detachR").snap({ marks: { 0: "active" }, note: "Unlink the last node from its parent. The tree is still complete." });
      r.at("start").snap({ marks: { 0: "active" }, note: "cur ← root; sift down along child pointers." });
      downHeap(T, r, 0, T.a.length, true);
      r.at("ret").snap({ note: "Return <b>" + v + "</b>. Two O(log n) walks, so O(log n) overall. Same bound as the array heap, but with three pointers per node and no index arithmetic." });
      return r;
    },
    min() {
      const r = heapRec(T, "theap").code("t_min");
      r.snap({ note: "<b>min()</b>." });
      if (!T.a.length) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      r.at("ret").snap({ marks: { 0: "target" }, note: "root.key = <b>" + T.a[0] + "</b>. O(1)." });
      return r;
    },
  };

  /* ============================================================
     PQ-SORT
     ============================================================ */
  const SORT = { algo: "selection", input: [] };
  function pqSort(vals, algo) {
    const seq = vals.slice(), pq = [];
    let c1 = 0, c2 = 0, phase = 1, hand = null;   /* hand: the key in transit between S and P */
    const r = D.Rec(() => ({ kind: "sort", algo: algo, seq: seq.slice(), pq: pq.slice(), hand: hand, marks: {}, pmarks: {}, phase: phase, c1: c1, c2: c2 }), 5000);
    r.code("sort_" + algo);
    r.at("init").snap({ note: "<b>" + CODE["sort_" + algo].title + "</b>. Phase 1 moves every key from S into P. Phase 2 moves them back with removeMin, so they come out in order." });
    const tick = () => { if (phase === 1) c1++; else c2++; };
    /* phase 1 */
    while (seq.length) {
      r.at("p1").snap({ marks: { 0: "active" }, note: "Phase 1: S still has " + seq.length + " key(s)." });
      const k = seq.shift();
      hand = k;
      r.at("insert").snap({ note: "Take " + k + " off the front of S and insert it into P." });
      if (algo === "selection") {
        pq.push(k); hand = null;
        r.at("insert").snap({ pmarks: { [pq.length - 1]: "done" }, note: "Unsorted list: just append. <b>No comparisons.</b>" });
      } else if (algo === "insertion") {
        let i = pq.length;
        while (i > 0) {
          tick();
          r.at("insert").snap({ pmarks: { [i - 1]: "cmp" }, pgap: i, note: "Compare " + k + " with P[" + (i - 1) + "] = " + pq[i - 1] + "." });
          if (!(pq[i - 1] > k)) break;
          i--;
        }
        pq.splice(i, 0, k); hand = null;
        r.at("insert").snap({ pmarks: { [i]: "done" }, note: "Insert at index " + i + " so P stays sorted." });
      } else {
        pq.push(k); hand = null;
        let j = pq.length - 1;
        r.at("insert").snap({ pmarks: { [j]: "active" }, note: "Append at index " + j + ", then up-heap." });
        while (j > 0) {
          const p = P(j);
          tick();
          if (pq[j] >= pq[p]) { r.at("insert").snap({ pmarks: { [j]: "done", [p]: "visit" }, note: pq[j] + " ≥ parent " + pq[p] + ": stop." }); break; }
          [pq[j], pq[p]] = [pq[p], pq[j]];
          r.at("insert").snap({ pmarks: { [j]: "swap", [p]: "swap" }, note: pq[p] + " is smaller than its parent " + pq[j] + ": swap up to index " + p + "." });
          j = p;
        }
      }
    }
    phase = 2;
    r.at("p2").snap({ note: "<b>Phase 2.</b> S is empty and P holds everything. Repeatedly remove the minimum." });
    while (pq.length) {
      r.at("p2").snap({ note: "P still has " + pq.length + " key(s)." });
      let v;
      if (algo === "selection") {
        let b = 0;
        r.at("remove").snap({ pmarks: { 0: "target" }, note: "removeMin must scan all of P." });
        for (let i = 1; i < pq.length; i++) {
          tick();
          if (pq[i] < pq[b]) b = i;
          r.at("remove").snap({ pmarks: { [b]: "target", [i]: "cmp" }, note: "Compare P[" + i + "] = " + pq[i] + " — smallest so far is " + pq[b] + "." });
        }
        v = pq.splice(b, 1)[0];
      } else if (algo === "insertion") {
        r.at("remove").snap({ pmarks: { 0: "target" }, note: "P is sorted, so the minimum is at the front. <b>No comparisons.</b>" });
        v = pq.shift();
      } else {
        r.at("remove").snap({ pmarks: { 0: "target" }, note: "The minimum is the root. Move the last leaf up and sift down." });
        v = pq[0]; hand = v;
        pq[0] = pq[pq.length - 1];
        pq.pop();
        let j = 0;
        for (;;) {
          const l = 2 * j + 1;
          if (l >= pq.length) break;
          let c = l;
          if (l + 1 < pq.length) { tick(); if (pq[l + 1] < pq[l]) c = l + 1; }
          tick();
          if (pq[c] >= pq[j]) { r.at("remove").snap({ pmarks: { [j]: "done" }, note: "Heap order restored." }); break; }
          [pq[j], pq[c]] = [pq[c], pq[j]];
          r.at("remove").snap({ pmarks: { [j]: "swap", [c]: "swap" }, note: pq[c] + " is bigger than its smaller child " + pq[j] + ": swap down to index " + c + "." });
          j = c;
        }
      }
      seq.push(v); hand = null;
      r.at("remove").snap({ marks: { [seq.length - 1]: "done" }, note: "Append " + v + " to S. " + seq.length + " key(s) are now in final order." });
    }
    r.at("p2").snap({ marks: allDone(seq.length), note: "Sorted. Comparisons were <b>" + c1 + "</b> in phase 1 and <b>" + c2 + "</b> in phase 2. " + ({
      selection: "All the work happened in phase 2, as selection sort: Θ(n²) always.",
      insertion: "All the work happened in phase 1, as insertion sort: Θ(n²) worst case, but only O(n) on already-sorted input.",
      heap: "The work is shared between the phases, and each is O(n log n), so O(n log n) overall.",
    })[algo] });
    return r;
  }
  const allDone = (n) => { const m = {}; for (let i = 0; i < n; i++) m[i] = "done"; return m; };

  /* ============================================================
     RENDERING
     ============================================================ */
  function render(f) {
    const st = q("stage");
    st.innerHTML = "";
    if (f.kind === "list") {
      st.appendChild(D.cells(f.a, { marks: f.marks, ptrs: f.ptrs, roomBelow: true, label: f.sorted ? "sorted list — smallest first" : "unsorted list — keys in arrival order" }));
      D.stats("#stats", [["size", f.a.length], ["min is at", f.a.length ? (f.sorted ? "the front" : "anywhere") : "–"], ["comparisons (total)", f.cmp]]);
    } else if (f.kind === "aheap") {
      st.appendChild(D.cells(f.a, { marks: f.marks, ptrs: f.a.length ? { 0: "root" } : {}, roomBelow: true, w: 42, h: 38, label: "array H[] — the actual storage" }));
      st.appendChild(D.el("div", { class: "cells-cap", text: "the same array read as a complete binary tree (children of i at 2i+1, 2i+2)", style: "margin-top:.4rem" }));
      st.appendChild(D.heapTree(f.a.length, { label: (i) => f.a[i], marks: f.marks }));
      heapStats(f);
    } else if (f.kind === "theap") {
      const onPath = new Set(f.path || []);
      st.appendChild(D.el("div", { class: "cells-cap", html: "linked nodes — each has <span class='mono'>key, left, right, parent</span>. Labels show each node's level-order position in binary." + (f.bits ? "   <b style='color:var(--c-cmp)'>walking to " + f.bits.pos + " = " + f.bits.pos.toString(2) + "₂</b>" : "") }));
      st.appendChild(D.heapTree(f.a.length, {
        label: (i) => f.a[i], marks: f.marks,
        sub: (i) => (i + 1).toString(2),
        edge: (i) => (onPath.has(i) && onPath.has(P(i)) ? "on" : ""),
      }));
      heapStats(f);
    } else if (f.kind === "sort") {
      st.appendChild(D.cells(f.seq, { marks: f.marks, label: "S — the sequence" + (f.phase === 1 ? " (being emptied into P)" : " (filling up, in order)"), w: 40, h: 36 }));
      st.appendChild(D.cells(f.hand == null ? [null] : [f.hand], { index: false, marks: f.hand == null ? {} : { 0: "active" }, label: f.hand == null ? "in transit: —" : "in transit: " + (f.phase === 1 ? "S → P" : "P → S"), w: 40, h: 36 }));
      const lab = "P — " + { selection: "unsorted list", insertion: "sorted list", heap: "heap (array + tree)" }[f.algo];
      st.appendChild(D.cells(f.pq, { marks: f.pmarks, label: lab, w: 40, h: 36 }));
      if (f.algo === "heap" && f.pq.length) st.appendChild(D.heapTree(f.pq.length, { label: (i) => f.pq[i], marks: f.pmarks }));
      D.stats("#stats", [["phase", f.phase], ["phase-1 comparisons", f.c1], ["phase-2 comparisons", f.c2], ["total", f.c1 + f.c2]]);
    }
  }
  function heapStats(f) {
    const n = f.a.length;
    D.stats("#stats", [["size n", n], ["height", n ? Math.floor(Math.log2(n)) : 0], ["min (root)", n ? f.a[0] : "–"], ["comparisons (total)", f.cmp], ["swaps (total)", f.swaps]]);
  }

  /* ============================================================
     TABS / EXAMPLES / INIT
     ============================================================ */
  const NOTES = {
    unsorted: "<b>Unsorted list.</b> insert just appends, so it is O(1). The price is paid at the other end: min and removeMin must look at every key, so they are O(n). Good when you insert far more often than you remove.",
    sorted: "<b>Sorted list.</b> insert walks to the right position, which is O(n), so the minimum is always at the front and min and removeMin are O(1). This is the mirror image of the unsorted list.",
    aheap: "<b>Array-based heap.</b> A complete binary tree stored level by level in an array, so there are no pointers: parent(i) = ⌊(i−1)/2⌋ and children are 2i+1 and 2i+2. Every node is ≤ its children. insert and removeMin each fix one root-to-leaf path, so both are O(log n). Bottom-up heapify builds a heap from n keys in O(n).",
    theap: "<b>Tree-based (linked) heap.</b> The same heap, built from nodes with left, right and parent pointers. Without an array there is no “slot n”. To find the last position, write n in binary, drop the leading 1, and read the remaining bits as left (0) or right (1) turns from the root. That walk is O(log n), so the bounds match the array heap, but every node carries three pointers.",
    sort: "<b>PQ-sort</b> is one algorithm with a pluggable priority queue: insert everything, then removeMin everything. Plug in an <b>unsorted list</b> and you get <b>selection sort</b>, with all the work in phase 2. A <b>sorted list</b> gives <b>insertion sort</b>, with all the work in phase 1. A <b>heap</b> gives <b>heap sort</b>, with O(n log n) split between the phases.",
  };
  const EXAMPLES = {
    unsorted: [
      { label: "insert 3, removeMin", desc: "insert is free, removeMin scans", run: () => { U.a = [42, 17, 58, 9, 33]; chain([() => unsorted.insert(21), () => unsorted.insert(5), () => unsorted.insert(40), unsorted.removeMin.bind(unsorted)]); } },
      { label: "min scans everything", run: () => { U.a = [42, 17, 58, 9, 33, 71, 26]; load(unsorted.min()); } },
    ],
    sorted: [
      { label: "insert a small key", desc: "Walks all the way to the front", run: () => { S.a = [9, 17, 26, 33, 42, 58]; load(sorted.insert(4)); } },
      { label: "insert a large key", desc: "Stops immediately", run: () => { S.a = [9, 17, 26, 33, 42, 58]; load(sorted.insert(90)); } },
      { label: "removeMin is free", run: () => { S.a = [9, 17, 26, 33, 42, 58]; load(sorted.removeMin()); } },
    ],
    aheap: [
      { label: "insert climbs to the root", run: () => { H.a = [10, 20, 30, 40, 50, 60, 70]; load(aheap.insert(5)); } },
      { label: "removeMin sifts down", run: () => { H.a = [5, 12, 8, 30, 25, 14, 9, 41]; load(aheap.removeMin()); } },
      { label: "heapify vs insertion (worst case)", desc: "Same 15 keys in decreasing order: compare comparisons", run: () => {
        const vals = []; for (let i = 15; i >= 1; i--) vals.push(i * 3);
        cmp = 0; swaps = 0;
        const a = aheap.build(vals).frames;
        const c1 = cmp;
        cmp = 0; swaps = 0;
        const b = aheap.heapify(vals).frames;
        b[b.length - 1] = Object.assign({}, b[b.length - 1], { note: b[b.length - 1].note + " <br><b>Result:</b> build-by-insertion used " + c1 + " comparisons, bottom-up heapify used " + cmp + "." });
        player.load(a.concat(b), true);
      } },
    ],
    theap: [
      { label: "insert: walk the bits", desc: "Find the new leaf's parent by its binary position", run: () => { T.a = [4, 9, 6, 12, 15, 8, 20, 30, 18]; load(theap.insert(3)); } },
      { label: "removeMin: find the last node", run: () => { T.a = [4, 9, 6, 12, 15, 8, 20, 30, 18, 22, 17]; load(theap.removeMin()); } },
    ],
    sort: [
      { label: "selection sort", run: () => runSort("selection") },
      { label: "insertion sort", run: () => runSort("insertion") },
      { label: "heap sort", run: () => runSort("heap") },
      { label: "insertion sort, sorted input", desc: "Best case for insertion sort", run: () => { q("sort-input").value = "5, 12, 19, 23, 31, 44, 58, 62"; runSort("insertion"); } },
    ],
  };
  function load(r) { if (r.overflow) D.toast("Step limit reached.", true); player.load(r.frames, true); }
  function chain(fns) { let all = []; fns.forEach((fn) => { all = all.concat(fn().frames); }); player.load(all, true); }
  function runSort(algo) {
    SORT.algo = algo;
    q("sort-algo").value = algo;
    let v = D.parseNums(q("sort-input").value).slice(0, 14);
    if (v.length < 2) { v = D.randArray(8, 1, 99); q("sort-input").value = v.join(", "); }
    load(pqSort(v, algo));
  }
  function still(note) {
    let r;
    if (tab === "unsorted") r = listRec(U, false);
    else if (tab === "sorted") r = listRec(S, true);
    else if (tab === "aheap") r = heapRec(H, "aheap");
    else if (tab === "theap") r = heapRec(T, "theap");
    else { const v = D.parseNums(q("sort-input").value); r = D.Rec(() => ({ kind: "sort", algo: SORT.algo, seq: v, pq: [], marks: {}, pmarks: {}, phase: 1, c1: 0, c2: 0 })); }
    r.snap({ note: note });
    player.load(r.frames, false);
  }

  function selectTab(id) {
    tab = id;
    D.showFor(id);
    D.practiceShow(id);
    q("notes").innerHTML = "<p class='blurb'>" + NOTES[id] + "</p>";
    D.Examples("#examples", EXAMPLES[id]);
    dock.show({ unsorted: "u_removeMin", sorted: "s_insert", aheap: "a_insert", theap: "t_insert", sort: "sort_" + SORT.algo }[id]);
    still({
      unsorted: "A priority queue as an <b>unsorted list</b>.",
      sorted: "A priority queue as a <b>sorted list</b>.",
      aheap: "A priority queue as an <b>array-based min-heap</b>. Array on top, the same data as a tree below.",
      theap: "A priority queue as a <b>linked tree</b> heap. The binary label under each node is its position.",
      sort: "Pick a PQ-sort variant, or use your own numbers.",
    }[id]);
  }

  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "unsorted": {
    "label": "Unsorted-list PQ",
    "items": [
     [
      1046,
      "Last Stone Weight",
      "last-stone-weight",
      "Easy",
      "Repeatedly remove the largest two — try it with a scan first, then a heap."
     ],
     [
      215,
      "Kth Largest Element in an Array",
      "kth-largest-element-in-an-array",
      "Medium",
      "Compare O(n·k) scanning with a heap."
     ]
    ]
   },
   "sorted": {
    "label": "Sorted-list PQ",
    "items": [
     [
      703,
      "Kth Largest Element in a Stream",
      "kth-largest-element-in-a-stream",
      "Easy",
      "Keep the best k in order as values arrive."
     ],
     [
      1046,
      "Last Stone Weight",
      "last-stone-weight",
      "Easy",
      "removeMax is O(1) on a sorted list; insert is not."
     ]
    ]
   },
   "aheap": {
    "label": "Array-based heap",
    "items": [
     [
      1046,
      "Last Stone Weight",
      "last-stone-weight",
      "Easy",
      "The standard heap warm-up."
     ],
     [
      703,
      "Kth Largest Element in a Stream",
      "kth-largest-element-in-a-stream",
      "Easy",
      "A min-heap of size k."
     ],
     [
      347,
      "Top K Frequent Elements",
      "top-k-frequent-elements",
      "Medium",
      "Heap + hash map."
     ],
     [
      973,
      "K Closest Points to Origin",
      "k-closest-points-to-origin",
      "Medium",
      "A heap ordered by a computed key."
     ],
     [
      23,
      "Merge k Sorted Lists",
      "merge-k-sorted-lists",
      "Hard",
      "Always removeMin across k lists."
     ]
    ]
   },
   "theap": {
    "label": "Tree-based heap",
    "items": [
     [
      958,
      "Check Completeness of a Binary Tree",
      "check-completeness-of-a-binary-tree",
      "Medium",
      "The shape a linked heap must keep."
     ],
     [
      222,
      "Count Complete Tree Nodes",
      "count-complete-tree-nodes",
      "Medium",
      "Reasoning about positions in a complete tree."
     ],
     [
      1046,
      "Last Stone Weight",
      "last-stone-weight",
      "Easy",
      "Same ADT — try it with your own linked heap."
     ]
    ]
   },
   "sort": {
    "label": "PQ-sort",
    "items": [
     [
      912,
      "Sort an Array",
      "sort-an-array",
      "Medium",
      "Submit heap sort — then selection and insertion sort, and watch them time out."
     ],
     [
      215,
      "Kth Largest Element in an Array",
      "kth-largest-element-in-an-array",
      "Medium",
      "Stop PQ-sort early: only k removeMins."
     ],
     [
      1985,
      "Find the Kth Largest Integer in the Array",
      "find-the-kth-largest-integer-in-the-array",
      "Medium",
      "Same idea with a custom comparator."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    dock = D.CodeDock("#code", CODE, { recv: "pq" });
    player = new D.Player({ mount: "#player", render: render, code: dock });
    const val = () => { const v = parseInt(q("val").value, 10); return isNaN(v) ? D.randInt(1, 99) : v; };
    const impl = () => ({ unsorted: unsorted, sorted: sorted, aheap: aheap, theap: theap })[tab];
    const store = () => ({ unsorted: U, sorted: S, aheap: H, theap: T })[tab];

    q("op-insert").onclick = () => load(impl().insert(val()));
    q("op-remove").onclick = () => load(impl().removeMin());
    q("op-min").onclick = () => load(impl().min());
    q("op-rand").onclick = () => {
      const vals = D.randArray(D.randInt(7, 10), 1, 99);
      if (tab === "sorted") vals.sort((a, b) => a - b);
      if (tab === "aheap" || tab === "theap") {
        const tmp = { a: vals.slice() };
        for (let j = Math.floor(vals.length / 2) - 1; j >= 0; j--) downHeap(tmp, D.Rec(), j, vals.length, false);
        store().a = tmp.a;
      } else store().a = vals;
      cmp = 0; swaps = 0;
      still("Filled with " + vals.length + " random keys.");
    };
    q("op-clear").onclick = () => { store().a = []; cmp = 0; swaps = 0; still("Cleared."); };
    q("op-heapify").onclick = () => {
      let v = D.parseNums(q("heap-input").value).slice(0, MAXN);
      if (v.length < 2) { v = D.randArray(12, 1, 99); q("heap-input").value = v.join(", "); }
      cmp = 0; swaps = 0;
      load(aheap.heapify(v));
    };
    q("op-build").onclick = () => {
      let v = D.parseNums(q("heap-input").value).slice(0, MAXN);
      if (v.length < 2) { v = D.randArray(12, 1, 99); q("heap-input").value = v.join(", "); }
      cmp = 0; swaps = 0;
      load(aheap.build(v));
    };
    q("sort-run").onclick = () => runSort(q("sort-algo").value);
    q("sort-algo").onchange = (e) => { SORT.algo = e.target.value; dock.show("sort_" + SORT.algo); still("Switched to " + CODE["sort_" + SORT.algo].title + "."); };
    q("sort-rand").onclick = () => { q("sort-input").value = D.randArray(8, 1, 99).join(", "); still("New input."); };

    D.legend("#legend", [
      { color: "var(--c-active)", label: "current node / position" },
      { color: "var(--c-cmp)", label: "being compared" },
      { color: "var(--c-swap)", label: "swapped / removed" },
      { color: "var(--c-done)", label: "settled" },
      { color: "var(--c-target)", label: "the minimum" },
    ]);

    U.a = [42, 17, 58, 9, 33];
    S.a = [9, 17, 33, 42, 58];
    H.a = [5, 9, 8, 17, 12, 26, 14];
    T.a = [5, 9, 8, 17, 12, 26, 14];

    D.Tabs("#tabs", [
      { id: "unsorted", label: "Unsorted list" },
      { id: "sorted", label: "Sorted list" },
      { id: "aheap", label: "Array-based heap" },
      { id: "theap", label: "Tree-based heap" },
      { id: "sort", label: "PQ-Sort" },
    ], selectTab);
  });
})();
