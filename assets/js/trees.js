/* ============================================================
   trees.js — traversals, BST, AVL, (2,4)-trees and B-trees
   Binary structures use parent pointers so that a snapshot of
   the root is valid at any moment during rebalancing.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const q = (id) => D.$("#" + id);

  let nextId = 1;
  let player, mode = "trav";

  /* ---------------- binary nodes ---------------- */
  const bnode = (v) => ({ id: nextId++, v: v, left: null, right: null, p: null, h: 1 });
  const cloneB = (n) => (n ? { id: n.id, v: n.v, h: n.h, left: cloneB(n.left), right: cloneB(n.right) } : null);
  const hh = (n) => (n ? n.h : 0);
  const fixH = (n) => { if (n) n.h = 1 + Math.max(hh(n.left), hh(n.right)); };
  const bf = (n) => (n ? hh(n.left) - hh(n.right) : 0);

  /* ---------------- multiway nodes ---------------- */
  const mnode = (keys, kids) => ({ id: nextId++, keys: keys || [], kids: kids || [], p: null });
  const cloneM = (n) => (n ? { id: n.id, keys: n.keys.slice(), kids: n.kids.map(cloneM) } : null);

  /* ---------------- per-tab state ---------------- */
  const ST = {
    trav: { root: null },
    bst: { root: null },
    avl: { root: null },
    t24: { root: null, m: 4 },
    btree: { root: null, m: 5 },
  };

  /* ============================================================
     CODE LISTINGS
     ============================================================ */
  const AVL_TAIL = {
    pseudo: [
      "",
      "rebalance(n):",
      "  while n ≠ null:                          // walk back up to the root @@loop",
      "    updateHeight(n);  b ← h(n.left) − h(n.right) @@bf",
      "    if b > 1:                              // left-heavy @@heavyL",
      "      if bf(n.left) < 0: rotateLeft(n.left)      // Left-Right → Left-Left @@doubleL",
      "      n ← rotateRight(n) @@rotR",
      "    else if b < −1:                        // right-heavy @@heavyR",
      "      if bf(n.right) > 0: rotateRight(n.right)   // Right-Left → Right-Right @@doubleR",
      "      n ← rotateLeft(n) @@rotL",
      "    n ← n.parent",
      "",
      "rotateRight(y):                            // y.left rises, y drops to the right",
      "  x ← y.left;  y.left ← x.right;  x.right ← y;  fix parent links @@rotR",
      "  updateHeight(y);  updateHeight(x);  return x @@rotR",
      "rotateLeft(x):                             // the mirror image",
      "  y ← x.right;  x.right ← y.left;  y.left ← x;  fix parent links @@rotL",
      "  updateHeight(x);  updateHeight(y);  return y @@rotL",
    ],
    java: [
      "",
      "void rebalance(Node n) {",
      "  while (n != null) { @@loop",
      "    updateHeight(n);  int b = height(n.left) - height(n.right); @@bf",
      "    if (b > 1) { @@heavyL",
      "      if (bf(n.left) < 0) rotateLeft(n.left);     // Left-Right @@doubleL",
      "      n = rotateRight(n); @@rotR",
      "    } else if (b < -1) { @@heavyR",
      "      if (bf(n.right) > 0) rotateRight(n.right);  // Right-Left @@doubleR",
      "      n = rotateLeft(n); @@rotL",
      "    }",
      "    n = n.parent;",
      "  }",
      "}",
      "",
      "Node rotateRight(Node y) {",
      "  Node x = y.left; @@rotR",
      "  y.left = x.right;  if (x.right != null) x.right.parent = y; @@rotR",
      "  x.parent = y.parent;  replaceChild(y.parent, y, x); @@rotR",
      "  x.right = y;  y.parent = x; @@rotR",
      "  updateHeight(y);  updateHeight(x);  return x; @@rotR",
      "}",
      "// rotateLeft(x) is the mirror image: swap left and right @@rotL",
    ],
    cpp: [
      "",
      "void rebalance(Node* n) {",
      "  while (n) { @@loop",
      "    updateHeight(n);  int b = height(n->left) - height(n->right); @@bf",
      "    if (b > 1) { @@heavyL",
      "      if (bf(n->left) < 0) rotateLeft(n->left);     // Left-Right @@doubleL",
      "      n = rotateRight(n); @@rotR",
      "    } else if (b < -1) { @@heavyR",
      "      if (bf(n->right) > 0) rotateRight(n->right);  // Right-Left @@doubleR",
      "      n = rotateLeft(n); @@rotL",
      "    }",
      "    n = n->parent;",
      "  }",
      "}",
      "",
      "Node* rotateRight(Node* y) {",
      "  Node* x = y->left; @@rotR",
      "  y->left = x->right;  if (x->right) x->right->parent = y; @@rotR",
      "  x->parent = y->parent;  replaceChild(y->parent, y, x); @@rotR",
      "  x->right = y;  y->parent = x; @@rotR",
      "  updateHeight(y);  updateHeight(x);  return x; @@rotR",
      "}",
      "// rotateLeft(x) is the mirror image: swap left and right @@rotL",
    ],
    python: [
      "",
      "def _rebalance(self, n):",
      "  while n is not None: @@loop",
      "    self._update_height(n) @@bf",
      "    b = height(n.left) - height(n.right) @@bf",
      "    if b > 1: @@heavyL",
      "      if bf(n.left) < 0: @@doubleL",
      "        self._rotate_left(n.left)      # Left-Right @@doubleL",
      "      n = self._rotate_right(n) @@rotR",
      "    elif b < -1: @@heavyR",
      "      if bf(n.right) > 0: @@doubleR",
      "        self._rotate_right(n.right)    # Right-Left @@doubleR",
      "      n = self._rotate_left(n) @@rotL",
      "    n = n.parent",
      "",
      "def _rotate_right(self, y):",
      "  x = y.left @@rotR",
      "  y.left = x.right @@rotR",
      "  if x.right: x.right.parent = y @@rotR",
      "  x.parent = y.parent;  self._replace_child(y.parent, y, x) @@rotR",
      "  x.right, y.parent = y, x @@rotR",
      "  self._update_height(y);  self._update_height(x) @@rotR",
      "  return x @@rotR",
      "# _rotate_left(x) is the mirror image @@rotL",
    ],
  };
  const tail = (o, t) => { ["pseudo", "java", "cpp", "python"].forEach((l) => (o[l] = o[l].concat(t[l]))); return o; };

  const CODE = {
    trav_pre: {
      title: "preorder(n)",
      pseudo: ["preorder(n):", "  if n == null: return @@null", "  visit(n)                  // node first @@visit", "  preorder(n.left) @@left", "  preorder(n.right) @@right"],
      java: ["void preorder(Node n) {", "  if (n == null) return; @@null", "  visit(n); @@visit", "  preorder(n.left); @@left", "  preorder(n.right); @@right", "}"],
      cpp: ["void preorder(Node* n) {", "  if (!n) return; @@null", "  visit(n); @@visit", "  preorder(n->left); @@left", "  preorder(n->right); @@right", "}"],
      python: ["def preorder(n):", "  if n is None: @@null", "    return @@null", "  visit(n) @@visit", "  preorder(n.left) @@left", "  preorder(n.right) @@right"],
    },
    trav_in: {
      title: "inorder(n)",
      pseudo: ["inorder(n):", "  if n == null: return @@null", "  inorder(n.left) @@left", "  visit(n)                  // between the subtrees @@visit", "  inorder(n.right) @@right"],
      java: ["void inorder(Node n) {", "  if (n == null) return; @@null", "  inorder(n.left); @@left", "  visit(n); @@visit", "  inorder(n.right); @@right", "}"],
      cpp: ["void inorder(Node* n) {", "  if (!n) return; @@null", "  inorder(n->left); @@left", "  visit(n); @@visit", "  inorder(n->right); @@right", "}"],
      python: ["def inorder(n):", "  if n is None: @@null", "    return @@null", "  inorder(n.left) @@left", "  visit(n) @@visit", "  inorder(n.right) @@right"],
    },
    trav_post: {
      title: "postorder(n)",
      pseudo: ["postorder(n):", "  if n == null: return @@null", "  postorder(n.left) @@left", "  postorder(n.right) @@right", "  visit(n)                  // node last @@visit"],
      java: ["void postorder(Node n) {", "  if (n == null) return; @@null", "  postorder(n.left); @@left", "  postorder(n.right); @@right", "  visit(n); @@visit", "}"],
      cpp: ["void postorder(Node* n) {", "  if (!n) return; @@null", "  postorder(n->left); @@left", "  postorder(n->right); @@right", "  visit(n); @@visit", "}"],
      python: ["def postorder(n):", "  if n is None: @@null", "    return @@null", "  postorder(n.left) @@left", "  postorder(n.right) @@right", "  visit(n) @@visit"],
    },
    trav_level: {
      title: "levelorder(root)",
      pseudo: ["levelorder(root):", "  Q ← [root] @@init", "  while Q is not empty: @@loop", "    n ← Q.dequeue();  visit(n) @@visit", "    if n.left ≠ null: Q.enqueue(n.left) @@visit", "    if n.right ≠ null: Q.enqueue(n.right) @@visit"],
      java: ["void levelorder(Node root) {", "  Queue<Node> q = new ArrayDeque<>();  q.add(root); @@init", "  while (!q.isEmpty()) { @@loop", "    Node n = q.remove();  visit(n); @@visit", "    if (n.left != null) q.add(n.left); @@visit", "    if (n.right != null) q.add(n.right); @@visit", "  }", "}"],
      cpp: ["void levelorder(Node* root) {", "  queue<Node*> q;  q.push(root); @@init", "  while (!q.empty()) { @@loop", "    Node* n = q.front();  q.pop();  visit(n); @@visit", "    if (n->left) q.push(n->left); @@visit", "    if (n->right) q.push(n->right); @@visit", "  }", "}"],
      python: ["def levelorder(root):", "  q = deque([root]) @@init", "  while q: @@loop", "    n = q.popleft() @@visit", "    visit(n) @@visit", "    if n.left: q.append(n.left) @@visit", "    if n.right: q.append(n.right) @@visit"],
    },

    bst_search: {
      title: "search(k) — BST",
      pseudo: ["search(k):", "  n ← root @@start", "  while n ≠ null: @@loop", "    if k == n.key: return n @@found", "    n ← (k < n.key) ? n.left : n.right     // discard the other side @@goL,goR", "  return null @@miss"],
      java: ["Node search(int k) {", "  Node n = root; @@start", "  while (n != null) { @@loop", "    if (k == n.key) return n; @@found", "    n = (k < n.key) ? n.left : n.right; @@goL,goR", "  }", "  return null; @@miss", "}"],
      cpp: ["Node* search(int k) {", "  Node* n = root; @@start", "  while (n) { @@loop", "    if (k == n->key) return n; @@found", "    n = (k < n->key) ? n->left : n->right; @@goL,goR", "  }", "  return nullptr; @@miss", "}"],
      python: ["def search(self, k):", "  n = self.root @@start", "  while n is not None: @@loop", "    if k == n.key: @@found", "      return n @@found", "    n = n.left if k < n.key else n.right @@goL,goR", "  return None @@miss"],
    },
    bst_insert: {
      title: "insert(k) — BST",
      pseudo: [
        "insert(k):",
        "  if root == null: root ← new Node(k);  return @@empty",
        "  n ← root @@start",
        "  while true:",
        "    if k == n.key: return                    // keys are distinct @@found",
        "    if k < n.key: @@goL",
        "      if n.left == null: n.left ← new Node(k);  return    // new leaf @@attachL",
        "      n ← n.left @@goL",
        "    else: @@goR",
        "      if n.right == null: n.right ← new Node(k);  return  // new leaf @@attachR",
        "      n ← n.right @@goR",
      ],
      java: [
        "void insert(int k) {",
        "  if (root == null) { root = new Node(k);  return; } @@empty",
        "  Node n = root; @@start",
        "  while (true) {",
        "    if (k == n.key) return; @@found",
        "    if (k < n.key) { @@goL",
        "      if (n.left == null) { n.left = new Node(k, n);  return; } @@attachL",
        "      n = n.left; @@goL",
        "    } else { @@goR",
        "      if (n.right == null) { n.right = new Node(k, n);  return; } @@attachR",
        "      n = n.right; @@goR",
        "    }",
        "  }",
        "}",
      ],
      cpp: [
        "void insert(int k) {",
        "  if (!root) { root = new Node(k);  return; } @@empty",
        "  Node* n = root; @@start",
        "  while (true) {",
        "    if (k == n->key) return; @@found",
        "    if (k < n->key) { @@goL",
        "      if (!n->left) { n->left = new Node(k, n);  return; } @@attachL",
        "      n = n->left; @@goL",
        "    } else { @@goR",
        "      if (!n->right) { n->right = new Node(k, n);  return; } @@attachR",
        "      n = n->right; @@goR",
        "    }",
        "  }",
        "}",
      ],
      python: [
        "def insert(self, k):",
        "  if self.root is None: @@empty",
        "    self.root = Node(k) @@empty",
        "    return @@empty",
        "  n = self.root @@start",
        "  while True:",
        "    if k == n.key: @@found",
        "      return @@found",
        "    if k < n.key: @@goL",
        "      if n.left is None: @@attachL",
        "        n.left = Node(k, n) @@attachL",
        "        return @@attachL",
        "      n = n.left @@goL",
        "    else: @@goR",
        "      if n.right is None: @@attachR",
        "        n.right = Node(k, n) @@attachR",
        "        return @@attachR",
        "      n = n.right @@goR",
      ],
    },
    bst_delete: {
      title: "delete(k) — BST",
      pseudo: [
        "delete(k):",
        "  n ← search(k);  if n == null: return @@find",
        "  if n has two children: @@two",
        "    s ← leftmost node of n.right             // in-order successor @@succ",
        "    n.key ← s.key;  n ← s                    // now delete s instead @@copy",
        "  child ← (n.left ≠ null) ? n.left : n.right   // n has ≤ 1 child now @@splice",
        "  replace n by child in n's parent @@splice",
      ],
      java: [
        "void delete(int k) {",
        "  Node n = search(k);  if (n == null) return; @@find",
        "  if (n.left != null && n.right != null) { @@two",
        "    Node s = n.right;  while (s.left != null) s = s.left; @@succ",
        "    n.key = s.key;  n = s; @@copy",
        "  }",
        "  Node child = (n.left != null) ? n.left : n.right; @@splice",
        "  replaceChild(n.parent, n, child);   // or root = child @@splice",
        "}",
      ],
      cpp: [
        "void remove(int k) {",
        "  Node* n = search(k);  if (!n) return; @@find",
        "  if (n->left && n->right) { @@two",
        "    Node* s = n->right;  while (s->left) s = s->left; @@succ",
        "    n->key = s->key;  n = s; @@copy",
        "  }",
        "  Node* child = n->left ? n->left : n->right; @@splice",
        "  replaceChild(n->parent, n, child);  delete n; @@splice",
        "}",
      ],
      python: [
        "def delete(self, k):",
        "  n = self.search(k) @@find",
        "  if n is None: return @@find",
        "  if n.left and n.right: @@two",
        "    s = n.right @@succ",
        "    while s.left: s = s.left @@succ",
        "    n.key, n = s.key, s @@copy",
        "  child = n.left if n.left else n.right @@splice",
        "  self._replace_child(n.parent, n, child) @@splice",
      ],
    },
    avl_insert: tail({
      title: "insert(k) — AVL",
      pseudo: ["insert(k):", "  n ← bstInsert(k)          // an ordinary BST insert: a new leaf @@bst", "  rebalance(n.parent) @@call"],
      java: ["void insert(int k) {", "  Node n = bstInsert(k);    // plain BST insert, returns the new leaf @@bst", "  rebalance(n.parent); @@call", "}"],
      cpp: ["void insert(int k) {", "  Node* n = bstInsert(k);   // plain BST insert, returns the new leaf @@bst", "  rebalance(n->parent); @@call", "}"],
      python: ["def insert(self, k):", "  n = self._bst_insert(k)   # plain BST insert, returns the new leaf @@bst", "  self._rebalance(n.parent) @@call"],
    }, AVL_TAIL),
    avl_delete: tail({
      title: "delete(k) — AVL",
      pseudo: ["delete(k):", "  p ← bstDelete(k)          // ordinary BST delete; p = parent of the removed node @@bst", "  rebalance(p) @@call"],
      java: ["void delete(int k) {", "  Node p = bstDelete(k);    // returns the removed node's parent @@bst", "  rebalance(p); @@call", "}"],
      cpp: ["void remove(int k) {", "  Node* p = bstDelete(k);   // returns the removed node's parent @@bst", "  rebalance(p); @@call", "}"],
      python: ["def delete(self, k):", "  p = self._bst_delete(k)   # returns the removed node's parent @@bst", "  self._rebalance(p) @@call"],
    }, AVL_TAIL),

    m_search: {
      title: "search(k) — multiway tree",
      pseudo: [
        "search(k):",
        "  n ← root @@start",
        "  while n ≠ null:",
        "    i ← first index with k ≤ n.keys[i]      // scan the node's keys @@scan",
        "    if i < n.size and n.keys[i] == k: return (n, i) @@found",
        "    if n is a leaf: return null @@leaf",
        "    n ← n.child[i]                           // the gap k falls into @@down",
      ],
      java: [
        "Entry search(int k) {",
        "  BNode n = root; @@start",
        "  while (n != null) {",
        "    int i = 0;  while (i < n.keys.size() && k > n.keys.get(i)) i++; @@scan",
        "    if (i < n.keys.size() && k == n.keys.get(i)) return new Entry(n, i); @@found",
        "    if (n.isLeaf()) return null; @@leaf",
        "    n = n.kids.get(i); @@down",
        "  }",
        "  return null;",
        "}",
      ],
      cpp: [
        "Entry search(int k) {",
        "  BNode* n = root; @@start",
        "  while (n) {",
        "    int i = 0;  while (i < (int)n->keys.size() && k > n->keys[i]) i++; @@scan",
        "    if (i < (int)n->keys.size() && k == n->keys[i]) return {n, i}; @@found",
        "    if (n->isLeaf()) return {nullptr, -1}; @@leaf",
        "    n = n->kids[i]; @@down",
        "  }",
        "  return {nullptr, -1};",
        "}",
      ],
      python: [
        "def search(self, k):",
        "  n = self.root @@start",
        "  while n is not None:",
        "    i = bisect_left(n.keys, k)          # first key ≥ k @@scan",
        "    if i < len(n.keys) and n.keys[i] == k: @@found",
        "      return (n, i) @@found",
        "    if n.is_leaf(): @@leaf",
        "      return None @@leaf",
        "    n = n.kids[i] @@down",
      ],
    },
    m_insert: {
      title: "insert(k) — multiway tree",
      pseudo: [
        "insert(k):",
        "  n ← the leaf where search(k) ends @@find",
        "  insert k into n.keys in sorted order @@put",
        "  while n has more than m − 1 keys:             // overflow @@over",
        "    split n: left half stays, right half → new sibling @@split",
        "    the middle key moves up into n.parent @@split",
        "    if n was the root: new root ← [middle]      // the tree grows taller @@root",
        "    n ← n.parent @@split",
      ],
      java: [
        "void insert(int k) {",
        "  BNode n = findLeaf(k); @@find",
        "  n.keys.add(sortedPos(n.keys, k), k); @@put",
        "  while (n.keys.size() > M - 1) { @@over",
        "    int mid = n.keys.size() / 2,  up = n.keys.get(mid); @@split",
        "    BNode right = n.splitAfter(mid);        // keys & kids after mid @@split",
        "    if (n.parent == null) { root = new BNode(up, n, right);  return; } @@root",
        "    n.parent.insertKeyAndChild(up, right); @@split",
        "    n = n.parent; @@split",
        "  }",
        "}",
      ],
      cpp: [
        "void insert(int k) {",
        "  BNode* n = findLeaf(k); @@find",
        "  n->keys.insert(upper_bound(n->keys.begin(), n->keys.end(), k), k); @@put",
        "  while ((int)n->keys.size() > M - 1) { @@over",
        "    int mid = n->keys.size() / 2,  up = n->keys[mid]; @@split",
        "    BNode* right = n->splitAfter(mid); @@split",
        "    if (!n->parent) { root = new BNode(up, n, right);  return; } @@root",
        "    n->parent->insertKeyAndChild(up, right); @@split",
        "    n = n->parent; @@split",
        "  }",
        "}",
      ],
      python: [
        "def insert(self, k):",
        "  n = self._find_leaf(k) @@find",
        "  insort(n.keys, k) @@put",
        "  while len(n.keys) > M - 1: @@over",
        "    mid = len(n.keys) // 2 @@split",
        "    up, right = n.keys[mid], n.split_after(mid) @@split",
        "    if n.parent is None: @@root",
        "      self.root = BNode([up], [n, right]) @@root",
        "      return @@root",
        "    n.parent.insert_key_and_child(up, right) @@split",
        "    n = n.parent @@split",
      ],
    },
    m_delete: {
      title: "delete(k) — multiway tree",
      pseudo: [
        "delete(k):",
        "  (n, i) ← search(k);  if not found: return @@find",
        "  if n is internal: swap k with its in-order predecessor (in a leaf) @@pred",
        "  remove k from its leaf;  n ← that leaf @@remove",
        "  while n ≠ root and n has < ⌈m/2⌉ − 1 keys:    // underflow @@under",
        "    if a sibling has a spare key: transfer through the parent;  stop @@transfer",
        "    else: fuse n + separator + sibling;  n ← n.parent @@fusion",
        "  if root has no keys: root ← its only child      // the tree shrinks @@shrink",
      ],
      java: [
        "void delete(int k) {",
        "  Entry e = search(k);  if (e == null) return; @@find",
        "  BNode n = e.node;  int i = e.i;",
        "  if (!n.isLeaf()) { BNode p = maxLeaf(n.kids.get(i));  n.keys.set(i, p.lastKey());  n = p;  i = p.keys.size() - 1; } @@pred",
        "  n.keys.remove(i); @@remove",
        "  while (n != root && n.keys.size() < MIN) { @@under",
        "    if (n.canBorrowFromSibling()) { n.transfer();  break; } @@transfer",
        "    n = n.fuseWithSibling();              // returns the parent @@fusion",
        "  }",
        "  if (root.keys.isEmpty() && !root.isLeaf()) root = root.kids.get(0); @@shrink",
        "}",
      ],
      cpp: [
        "void remove(int k) {",
        "  auto [n, i] = search(k);  if (!n) return; @@find",
        "  if (!n->isLeaf()) { BNode* p = maxLeaf(n->kids[i]);  n->keys[i] = p->keys.back();  n = p;  i = p->keys.size() - 1; } @@pred",
        "  n->keys.erase(n->keys.begin() + i); @@remove",
        "  while (n != root && (int)n->keys.size() < MIN) { @@under",
        "    if (n->canBorrowFromSibling()) { n->transfer();  break; } @@transfer",
        "    n = n->fuseWithSibling(); @@fusion",
        "  }",
        "  if (root->keys.empty() && !root->isLeaf()) root = root->kids[0]; @@shrink",
        "}",
      ],
      python: [
        "def delete(self, k):",
        "  found = self.search(k) @@find",
        "  if found is None: return @@find",
        "  n, i = found",
        "  if not n.is_leaf(): @@pred",
        "    p = max_leaf(n.kids[i]) @@pred",
        "    n.keys[i], n, i = p.keys[-1], p, len(p.keys) - 1 @@pred",
        "  del n.keys[i] @@remove",
        "  while n is not self.root and len(n.keys) < MIN: @@under",
        "    if n.can_borrow_from_sibling(): @@transfer",
        "      n.transfer();  break @@transfer",
        "    n = n.fuse_with_sibling() @@fusion",
        "  if not self.root.keys and not self.root.is_leaf(): @@shrink",
        "    self.root = self.root.kids[0] @@shrink",
      ],
    },
  };

  /* ---------------- specs, shown above each listing ---------------- */
  const M = (t) => "<span class='mono'>" + t + "</span>";
  const travSpec = (when, use) => ({ does: "Visits every node of the subtree rooted at " + M("n") + ", reporting a node " + when + ".", params: M("n") + " — the subtree's root (null for an empty tree)", returns: "nothing (visits each node)", errors: "none — null simply returns", cost: "Θ(n) time, O(h) stack space for the recursion. Typical use: " + use, callVals: { n: "root" } });
  D.specs(CODE, {
    trav_pre: travSpec("<b>before</b> its subtrees", "copying a tree or printing its structure."),
    trav_in: travSpec("<b>between</b> its left and right subtrees", "listing a BST's keys in sorted order."),
    trav_post: travSpec("<b>after</b> both subtrees", "freeing a tree or evaluating an expression tree."),
    trav_level: { does: "Visits the nodes level by level, left to right, using a queue.", params: M("root") + " — the tree's root", returns: "nothing (visits each node)", errors: "none", cost: "Θ(n) time, O(width) queue space" },
    bst_search: { does: "Looks for key " + M("k") + " by going left or right at each node — the BST property discards the other side.", params: M("k") + " — the key", returns: "the node holding k, or null", errors: "none", cost: "O(h): O(log n) when balanced, O(n) when degenerate" },
    bst_insert: { does: "Walks down as if searching for " + M("k") + " and hangs it as a new leaf where the search falls off.", params: M("k") + " — the key (keys are distinct)", returns: "nothing (a duplicate is ignored)", errors: "none", cost: "O(h)" },
    bst_delete: { does: "Removes key " + M("k") + ". A node with two children is replaced by its in-order successor first, so only a node with ≤ 1 child is ever cut out.", params: M("k") + " — the key", returns: "nothing (a missing key is ignored)", errors: "none", cost: "O(h)" },
    avl_insert: { does: "Does a BST insert, then walks back up fixing heights and rotating the first unbalanced node.", params: M("k") + " — the key", returns: "nothing", errors: "none", cost: "O(log n); at most one (single or double) rotation" },
    avl_delete: { does: "Does a BST delete, then walks back up fixing heights and rotating wherever a node is unbalanced.", params: M("k") + " — the key", returns: "nothing", errors: "none", cost: "O(log n); may rotate at every level on the way up" },
    m_search: { does: "Scans each node's sorted keys and follows the child whose range contains " + M("k") + ".", params: M("k") + " — the key", returns: "the node and index holding k, or null", errors: "none", cost: "O(log n) nodes visited, O(m) keys scanned per node" },
    m_insert: { does: "Inserts " + M("k") + " into the right leaf; a node with too many keys splits and pushes its middle key up.", params: M("k") + " — the key", returns: "nothing (a duplicate is ignored)", errors: "none", cost: "O(log n); the tree only grows taller when the root splits" },
    m_delete: { does: "Removes " + M("k") + " (from a leaf, swapping with its predecessor if needed) and fixes underflow by a transfer from a sibling or a fusion.", params: M("k") + " — the key", returns: "nothing (a missing key is ignored)", errors: "none", cost: "O(log n); fusions can cascade up to the root" },
  });

  /* ============================================================
     recorder
     ============================================================ */
  function Ctx(limit) {
    const R = new D.Recorder(limit || 900);
    return {
      cmp: 0, rot: 0, splits: 0, fusions: 0, transfers: 0,
      frames: R.frames,
      codeKey: null, lineKey: null, alias: null,
      /* alias maps anchors of a shared helper (e.g. the BST walk) onto the running listing */
      code(k, alias) { this.codeKey = k; this.alias = alias || null; this.lineKey = null; return this; },
      at(l) {
        const map = (a) => {
          const base = typeof a === "string" && a.endsWith("^") ? a.slice(0, -1) : a;
          return this.alias && this.alias[base] !== undefined ? this.alias[base] : a;
        };
        if (Array.isArray(l)) {
          const out = [];
          l.map(map).forEach((a) => { if (a != null && out.indexOf(a) < 0) out.push(a); });
          this.lineKey = out.length ? (out.length === 1 ? out[0] : out) : null;
        } else this.lineKey = map(l);
        return this;
      },
      bin(st, marks, note, extra) {
        R.push(Object.assign({ kind: "bin", root: cloneB(st.root), marks: marks || {}, note: note, cmp: this.cmp, rot: this.rot, code: this.codeKey, line: this.lineKey }, extra || {}));
      },
      multi(st, marks, note, extra) {
        R.push(Object.assign({ kind: "multi", root: cloneM(st.root), m: st.m, marks: marks || {}, note: note, cmp: this.cmp, splits: this.splits, fusions: this.fusions, transfers: this.transfers, code: this.codeKey, line: this.lineKey }, extra || {}));
      },
    };
  }

  /* ============================================================
     BINARY SEARCH TREE
     ============================================================ */
  function bstFind(st, v, c, forInsert) {
    let n = st.root, path = [];
    while (n) {
      c.cmp++;
      path.push(n.id);
      const marks = {};
      path.forEach((id) => (marks[id] = "visit"));
      marks[n.id] = "active";
      if (v === n.v) { marks[n.id] = "done"; c.at("found").bin(st, marks, "Compare " + v + " with " + n.v + " — <b>equal, found it</b> after " + c.cmp + " comparison(s)."); return { node: n, path: path }; }
      const goLeft = v < n.v;
      const hasChild = !!n[goLeft ? "left" : "right"];
      const side = goLeft ? "L" : "R";
      /* k ≠ key, then the direction test; when the child exists the "is it null?" test fails and we step down */
      c.at(hasChild ? ["found^", "go" + side, "attach" + side + "^"] : ["found^", "go" + side + "^"]).bin(st, marks, "Compare " + v + " with " + n.v + ": " + v + " " + (goLeft ? "&lt;" : "&gt;") + " " + n.v + ", so it can only be in the <b>" + (goLeft ? "left" : "right") + "</b> subtree. Everything on the other side is discarded — that is the whole BST property.");
      if (!n[goLeft ? "left" : "right"]) return { node: null, parent: n, goLeft: goLeft, path: path };
      n = n[goLeft ? "left" : "right"];
    }
    return { node: null, parent: null, path: path };
  }

  function bstSearch(st, v) {
    const c = Ctx(1000).code("bst_search");
    c.at("start").bin(st, st.root ? { [st.root.id]: "active" } : {}, "<b>search(" + v + ")</b> — n ← root" + (st.root ? " (" + st.root.v + ")." : ", which is null: the tree is empty."));
    let n = st.root;
    const path = [];
    while (n) {
      c.cmp++;
      path.push(n.id);
      const marks = {};
      path.forEach((id) => (marks[id] = "visit"));
      if (v === n.v) {
        marks[n.id] = "done";
        c.at(["loop", "found"]).bin(st, marks, "n = " + n.v + " is not null. " + v + " == " + n.v + ": <b>found it</b> after " + c.cmp + " comparison(s). Return n.");
        return c;
      }
      marks[n.id] = "active";
      const goLeft = v < n.v, next = n[goLeft ? "left" : "right"];
      c.at(["loop", "found^", goLeft ? "goL" : "goR"]).bin(st, marks, "n = " + n.v + " is not null. " + v + " ≠ " + n.v + ", and " + v + " " + (goLeft ? "&lt;" : "&gt;") + " " + n.v + ", so it can only be in the <b>" + (goLeft ? "left" : "right") + "</b> subtree: n ← n." + (goLeft ? "left" : "right") + (next ? " (" + next.v + ")." : ", which is null."));
      n = next;
    }
    const marks = {};
    path.forEach((id) => (marks[id] = "visit"));
    c.at("loop").bin(st, marks, "n is null, so the loop ends.");
    c.at("miss").bin(st, marks, "We ran off the bottom of the tree, so <b>" + v + " is not present</b>. Return null. Cost was " + c.cmp + " comparison(s) — at most one per level.");
    return c;
  }

  function bstInsert(st, v, c, rebalance) {
    if (rebalance) c.code("avl_insert", { empty: "bst", start: "bst", found: "bst", goL: "bst", goR: "bst", attachL: "bst", attachR: "bst" });
    else c.code("bst_insert");
    if (!st.root) {
      st.root = bnode(v);
      c.at("empty").bin(st, { [st.root.id]: "done" }, "The tree was empty, so " + v + " becomes the <b>root</b>.");
      return;
    }
    c.at(["empty^", "start"]).bin(st, {}, "<b>insert(" + v + ")</b> — the tree is not empty, so walk down from the root as if searching for " + v + ".");
    const r = bstFind(st, v, c);
    if (r.node) { c.at("found").bin(st, { [r.node.id]: "swap" }, v + " is already in the tree — a BST holds distinct keys, so nothing changes."); return; }
    const n = bnode(v);
    n.p = r.parent;
    r.parent[r.goLeft ? "left" : "right"] = n;
    c.at(r.goLeft ? "attachL" : "attachR").bin(st, { [n.id]: "done", [r.parent.id]: "visit" }, "We fell off the tree at " + r.parent.v + "'s empty <b>" + (r.goLeft ? "left" : "right") + "</b> slot, so that is where " + v + " goes. A new key is always inserted as a <b>leaf</b>.");
    if (rebalance) avlRetrace(st, n.p, c, "insert");
    else {
      for (let a = n.p; a; a = a.p) fixH(a);
      c.at(null).bin(st, {}, "Plain BSTs never rebalance — so if you insert sorted data the tree degenerates into a linked list and search becomes O(n). Try inserting 1, 2, 3, 4, 5 in order.");
    }
  }

  function bstDelete(st, v, c, rebalance) {
    const findAlias = { found: "find", goL: "find", goR: "find", attachL: null, attachR: null };
    if (rebalance) c.code("avl_delete", { found: "bst", goL: "bst", goR: "bst", attachL: null, attachR: null, find: "bst", two: "bst", succ: "bst", copy: "bst", splice: "bst" });
    else c.code("bst_delete", findAlias);
    c.at("find").bin(st, {}, "<b>delete(" + v + ")</b> — first find it.");
    const r = bstFind(st, v, c);
    if (!r.node) { c.at("find").bin(st, {}, v + " is not in the tree — nothing to delete."); return; }
    let n = r.node;
    if (!(n.left && n.right)) c.at("two^").bin(st, { [n.id]: "active" }, "Found " + v + ". It has " + (n.left || n.right ? "only one child" : "no children") + ", so no successor is needed.");
    if (n.left && n.right) {
      c.at("two").bin(st, { [n.id]: "active" }, "Node " + n.v + " has <b>two children</b>, so it cannot simply be cut out. Replace its value with its <b>in-order successor</b>: the smallest key in the right subtree.");
      let s = n.right;
      while (s.left) {
        c.at("succ").bin(st, { [n.id]: "active", [s.id]: "cmp" }, "Go left from " + s.v + " looking for the minimum of the right subtree.");
        s = s.left;
      }
      c.at("succ").bin(st, { [n.id]: "active", [s.id]: "target" }, "<b>" + s.v + "</b> is the successor — it is the next key in sorted order, and it has no left child by construction.");
      n.v = s.v;
      c.at("copy").bin(st, { [n.id]: "done", [s.id]: "swap" }, "Copy " + s.v + " up into the node we are deleting. Now the duplicate down at " + s.v + " has to go — but it has at most one child, so it is an easy case.");
      n = s;
    }
    const child = n.left || n.right;
    const par = n.p;
    if (child) child.p = par;
    if (!par) st.root = child;
    else if (par.left === n) par.left = child;
    else par.right = child;
    if (!rebalance) for (let a = par; a; a = a.p) fixH(a);
    c.at("splice").bin(st, par ? { [par.id]: "visit" } : {}, child
      ? "Node " + n.v + " had <b>one child</b>, so promote that child into its place. The subtree stays a valid BST because all of it was already on the same side."
      : "Node " + n.v + " was a <b>leaf</b> — just detach it.");
    if (rebalance) avlRetrace(st, par, c, "delete");
  }

  /* ============================================================
     AVL rotations
     ============================================================ */
  function rotL(st, x, c) {
    const y = x.right;
    x.right = y.left; if (y.left) y.left.p = x;
    y.p = x.p;
    if (!x.p) st.root = y; else if (x.p.left === x) x.p.left = y; else x.p.right = y;
    y.left = x; x.p = y;
    fixH(x); fixH(y);
    c.rot++;
    return y;
  }
  function rotR(st, y, c) {
    const x = y.left;
    y.left = x.right; if (x.right) x.right.p = y;
    x.p = y.p;
    if (!y.p) st.root = x; else if (y.p.left === y) y.p.left = x; else y.p.right = x;
    x.right = y; y.p = x;
    fixH(y); fixH(x);
    c.rot++;
    return x;
  }

  function avlRetrace(st, from, c, why) {
    c.alias = null;
    c.at("call").bin(st, from ? { [from.id]: "active" } : {}, "Now walk back up to the root, recomputing heights and checking the <b>balance factor</b> (height of left − height of right) at each ancestor.");
    let n = from;
    while (n) {
      const before = n.h;
      fixH(n);
      const b = bf(n);
      const marks = { [n.id]: Math.abs(b) > 1 ? "swap" : "cmp" };
      const head = "At " + n.v + ": height " + (before !== n.h ? "changes to " : "stays ") + n.h + ", balance factor = " + hh(n.left) + " − " + hh(n.right) + " = <b>" + b + "</b>. ";
      if (Math.abs(b) <= 1) {
        c.at(["loop", "bf", "heavyL^", "heavyR^"]).bin(st, marks, head + "Within {−1, 0, 1}, so neither rotation test fires. Move up to the parent" + (n.p ? " (" + n.p.v + ")." : ", which is null."));
        n = n.p;
        continue;
      }
      c.at(["loop", "bf"]).bin(st, marks, head + "That is outside {−1, 0, 1} — this node is <b>unbalanced</b> and must be rotated.");
      if (b > 1) {
        if (bf(n.left) < 0) {
          c.at(["heavyL", "doubleL"]).bin(st, { [n.id]: "swap", [n.left.id]: "active", [n.left.right.id]: "target" }, "b &gt; 1: <b>Left-Right case</b>. Heavy on the left, but the left child leans right, so a single rotation would not fix it. First rotate the <b>left child left</b>, turning this into a Left-Left case.");
          rotL(st, n.left, c);
          c.at("doubleL").bin(st, { [n.id]: "swap" }, "Now it is Left-Left.");
        } else {
          c.at(["heavyL", "doubleL^"]).bin(st, { [n.id]: "swap", [n.left.id]: "active" }, "b &gt; 1: <b>Left-Left case</b>. The left child leans left (or is balanced), so the double-rotation test fails. One <b>right rotation</b> at " + n.v + " fixes it.");
        }
        n = rotR(st, n, c);
        c.at("rotR").bin(st, { [n.id]: "done" }, "Rotated: <b>" + n.v + "</b> is now the subtree root, its old parent became its right child. The subtree's height drops by one and the in-order sequence is unchanged — rotations never break the BST property.");
      } else {
        if (bf(n.right) > 0) {
          c.at(["heavyL^", "heavyR", "doubleR"]).bin(st, { [n.id]: "swap", [n.right.id]: "active", [n.right.left.id]: "target" }, "b &lt; −1: <b>Right-Left case</b>. Heavy on the right, but the right child leans left. First rotate the <b>right child right</b> to turn this into Right-Right.");
          rotR(st, n.right, c);
          c.at("doubleR").bin(st, { [n.id]: "swap" }, "Now it is Right-Right.");
        } else {
          c.at(["heavyL^", "heavyR", "doubleR^"]).bin(st, { [n.id]: "swap", [n.right.id]: "active" }, "b &lt; −1: <b>Right-Right case</b>. The right child leans right (or is balanced). One <b>left rotation</b> at " + n.v + " fixes it.");
        }
        n = rotL(st, n, c);
        c.at("rotL").bin(st, { [n.id]: "done" }, "Rotated: <b>" + n.v + "</b> takes over the subtree. Height restored.");
      }
      n = n.p;
    }
    c.at("loop").bin(st, {}, "n is null — we have passed the root, so the loop ends.");
    c.at(null).bin(st, {}, "Every node is balanced again. " + (why === "insert"
      ? "An AVL insert needs <b>at most one</b> rotation (single or double), so it is O(log n) overall."
      : "An AVL delete may need a rotation at <b>every</b> level on the way up — still O(log n).") +
      " The height of an AVL tree with n nodes is at most 1.44·log₂n.");
  }

  /* ============================================================
     TRAVERSALS
     ============================================================ */
  function traverse(st, kind) {
    const c = Ctx(1200).code("trav_" + kind);
    const out = [];
    const seen = {};
    const marks = () => { const m = {}; Object.keys(seen).forEach((id) => (m[id] = seen[id])); return m; };
    const NAMES = { pre: "Pre-order (node, left, right)", in: "In-order (left, node, right)", post: "Post-order (left, right, node)", level: "Level-order (breadth-first)" };
    c.bin(st, {}, "<b>" + NAMES[kind] + "</b> on " + count(st.root) + " nodes.", { output: [] });
    if (!st.root) { c.bin(st, {}, "Empty tree.", { output: [] }); return c; }

    if (kind === "level") {
      const Q = [st.root];
      let level = 0, inLevel = 1;
      c.at("init").bin(st, { [st.root.id]: "cmp" }, "Level-order uses a <b>queue</b>, not recursion. Start by enqueueing the root.", { output: [], queue: [st.root.v] });
      while (Q.length) {
        c.at("loop").bin(st, Object.assign(marks(), { [Q[0].id]: "cmp" }), "The queue holds " + Q.length + " node" + (Q.length === 1 ? "" : "s") + " — not empty, so take the next one.", { output: out.slice(), queue: Q.map((x) => x.v) });
        const n = Q.shift();
        inLevel--;
        seen[n.id] = "done";
        out.push(n.v);
        const kids = [n.left, n.right].filter(Boolean);
        kids.forEach((k) => Q.push(k));
        c.at("visit").bin(st, Object.assign(marks(), { [n.id]: "active" }), "Dequeue <b>" + n.v + "</b> and visit it, then " + (kids.length ? "enqueue its child" + (kids.length === 1 ? " " : "ren ") + kids.map((k) => k.v).join(" and ") : "check both children: " + n.v + " has none, so nothing is enqueued") + ". Nodes come out strictly level by level.",
          { output: out.slice(), queue: Q.map((x) => x.v) });
        if (inLevel === 0) { level++; inLevel = Q.length; }
      }
      c.at("loop").bin(st, marks(), "The queue is empty, so the loop ends.", { output: out.slice(), queue: [] });
      c.at(null).bin(st, marks(), "Done: <b>" + out.join(" ") + "</b>. Level-order needs O(width) space — up to n/2 nodes for the bottom level of a complete tree.", { output: out.slice(), queue: [] });
      return c;
    }

    const WHY = {
      pre: "pre-order outputs a node <em>before</em> its subtrees, which is why it can rebuild the exact shape of a tree.",
      in: "the whole left subtree is done. On a BST, in-order output is <b>sorted</b>.",
      post: "post-order waits for both subtrees, which is what you want for freeing memory or evaluating an expression tree.",
    };
    const fn = { pre: "preorder", in: "inorder", post: "postorder" }[kind];
    const visit = (n, back) => {
      out.push(n.v); seen[n.id] = "done";
      c.at("visit").bin(st, Object.assign(marks(), { [n.id]: "done" }), (back ? "Back in " + n.v + ". " : "") + "<b>Visit " + n.v + "</b> — " + WHY[kind], { output: out.slice() });
    };
    /* one recursive call on child `ch` of `n` (side "left"/"right"); returns after the callee is done */
    const call = (n, side, depth, back) => {
      const ch = n[side];
      const lead = back ? "Back in " + n.v + ". " : "";
      if (!ch) {
        c.at(side).bin(st, Object.assign(marks(), { [n.id]: "active" }), lead + "Call " + fn + "(" + n.v + "." + side + ") — but " + n.v + " has no " + side + " child, so the argument is null.", { output: out.slice() });
        c.at("null").bin(st, Object.assign(marks(), { [n.id]: "active" }), "Inside that call: n is null, so it <b>returns immediately</b> to " + n.v + ". This check is the base case that stops the recursion.", { output: out.slice() });
        return;
      }
      c.at(side).bin(st, Object.assign(marks(), { [n.id]: "active", [ch.id]: "cmp" }), lead + "Call " + fn + "(" + n.v + "." + side + ") — go down to <b>" + ch.v + "</b>. " + n.v + " waits on the call stack until that whole subtree is finished.", { output: out.slice() });
      go(ch, depth + 1);
    };
    const go = (n, depth) => {
      seen[n.id] = "visit";
      c.at("null^").bin(st, Object.assign(marks(), { [n.id]: "active" }), "Enter " + fn + "(<b>" + n.v + "</b>) at depth " + depth + ". n is not null, so carry on.", { output: out.slice() });
      if (kind === "pre") visit(n, false);
      call(n, "left", depth, false);
      if (kind === "in") visit(n, true);
      call(n, "right", depth, kind !== "in");
      if (kind === "post") visit(n, true);
      seen[n.id] = "done";
    };
    go(st.root, 0);
    c.at(null).bin(st, marks(), "Done: <b>" + out.join(" ") + "</b>. Every node is entered and left exactly once, so all four traversals are <b>Θ(n)</b>; the recursive ones use O(h) stack space.", { output: out.slice() });
    return c;
  }

  /* ============================================================
     MULTIWAY: (2,4)-trees and B-trees
     ============================================================ */
  const maxKeys = (st) => st.m - 1;
  const minKeys = (st) => Math.ceil(st.m / 2) - 1;

  function mDescribe(st) {
    return st.m === 4
      ? "a <b>(2,4)-tree</b>: every internal node has 2, 3 or 4 children and 1, 2 or 3 keys"
      : "a <b>B-tree of order " + st.m + "</b>: up to " + st.m + " children and " + (st.m - 1) + " keys per node, at least " + minKeys(st) + " keys in every non-root node";
  }

  function mFind(st, k, c) {
    let n = st.root, depth = 0;
    while (n) {
      let i = 0;
      while (i < n.keys.length && k > n.keys[i]) {
        c.cmp++;
        c.at("scan").multi(st, { [n.id]: "active" }, "At this node scan the keys left to right: " + k + " &gt; " + n.keys[i] + ", keep scanning.", { keyMark: { node: n.id, i: i, cls: "cmp" } });
        i++;
      }
      c.cmp++;
      if (i < n.keys.length && k === n.keys[i]) {
        c.at("found").multi(st, { [n.id]: "done" }, "<b>Found " + k + "</b> at depth " + depth + " after " + c.cmp + " key comparison(s).", { keyMark: { node: n.id, i: i, cls: "done" } });
        return { node: n, i: i };
      }
      if (!n.kids.length) {
        c.at(["found^", "leaf"]).multi(st, { [n.id]: "swap" }, "This is a <b>leaf</b> and " + k + " is not in it — so " + k + " is not in the tree. Every search path ends at a leaf, and all leaves are at the <b>same depth</b>.");
        return { node: null, leaf: n, i: i };
      }
      c.at(["found^", "leaf^", "down"]).multi(st, { [n.id]: "visit" }, i < n.keys.length
        ? "" + k + " &lt; " + n.keys[i] + ", so follow child " + i + " — the subtree holding keys between " + (i ? n.keys[i - 1] : "−∞") + " and " + n.keys[i] + "."
        : "" + k + " is greater than every key here, so follow the <b>rightmost</b> child.");
      n = n.kids[i];
      depth++;
    }
    return { node: null, leaf: null };
  }

  function mSplit(st, n, c) {
    const mid = Math.floor(n.keys.length / 2);
    const up = n.keys[mid];
    const right = mnode(n.keys.slice(mid + 1), n.kids.slice(mid + 1));
    right.kids.forEach((kd) => (kd.p = right));
    n.keys = n.keys.slice(0, mid);
    n.kids = n.kids.slice(0, mid + 1);
    c.splits++;
    if (!n.p) {
      const nr = mnode([up], [n, right]);
      n.p = nr; right.p = nr;
      st.root = nr;
      c.at(["split", "root"]).multi(st, { [nr.id]: "done", [n.id]: "cmp", [right.id]: "cmp" }, "<b>Split the root.</b> The middle key <b>" + up + "</b> becomes a brand-new root with the two halves as its children — this is the <em>only</em> way a B-tree grows taller, and it grows at the top, which is why all leaves stay at the same depth.");
    } else {
      const p = n.p;
      const idx = p.kids.indexOf(n);
      p.keys.splice(idx, 0, up);
      p.kids.splice(idx + 1, 0, right);
      right.p = p;
      c.at(["split", "root^"]).multi(st, { [p.id]: "active", [n.id]: "cmp", [right.id]: "cmp" }, "<b>Split.</b> The node overflowed, so keep the left half here, put the right half in a new sibling, and push the middle key <b>" + up + "</b> up into the parent. The parent may now overflow too — splits cascade upward.", { keyMark: { node: p.id, i: idx, cls: "done" } });
      if (p.keys.length > maxKeys(st)) { c.at("over").multi(st, { [p.id]: "swap" }, "The parent now has " + p.keys.length + " keys: it overflows too, so split it as well."); mSplit(st, p, c); }
    }
  }

  function mInsert(st, k, c) {
    c.code("m_insert", { scan: "find", found: "find", leaf: "find", down: "find" });
    if (!st.root) {
      st.root = mnode([k]);
      c.at("put").multi(st, { [st.root.id]: "done" }, "Empty tree — " + k + " becomes the root, which is also the only leaf.");
      return;
    }
    c.at("find").multi(st, {}, "<b>insert(" + k + ")</b> into " + mDescribe(st) + ". Insertion always happens in a <b>leaf</b>; find it first.");
    const f = mFind(st, k, c);
    if (f.node) { c.at("find").multi(st, { [f.node.id]: "swap" }, k + " is already present — duplicates are not stored."); return; }
    const leaf = f.leaf;
    let i = 0;
    while (i < leaf.keys.length && leaf.keys[i] < k) i++;
    leaf.keys.splice(i, 0, k);
    c.at("put").multi(st, { [leaf.id]: "done" }, "Insert " + k + " into the leaf in sorted position. The leaf now has " + leaf.keys.length + " key(s); the limit is " + maxKeys(st) + ".", { keyMark: { node: leaf.id, i: i, cls: "done" } });
    if (leaf.keys.length > maxKeys(st)) {
      c.at("over").multi(st, { [leaf.id]: "swap" }, "<b>Overflow!</b> " + leaf.keys.length + " keys is one too many, so this node must <b>split</b>.");
      mSplit(st, leaf, c);
    }
    c.at("over").multi(st, {}, "No node is over the limit, so the overflow loop ends.");
    c.at(null).multi(st, {}, "Insert complete. Height is " + mHeight(st.root) + ", and every leaf is still at exactly that depth — a B-tree is <b>perfectly height-balanced by construction</b>. Cost O(log n).");
  }

  function mDelete(st, k, c) {
    c.code("m_delete", { scan: "find", found: "find", leaf: "find", down: "find" });
    c.at("find").multi(st, {}, "<b>delete(" + k + ")</b> — find the key first.");
    const f = mFind(st, k, c);
    if (!f.node) return;
    let n = f.node, i = f.i;
    if (n.kids.length) {
      c.at("pred").multi(st, { [n.id]: "active" }, k + " sits in an <b>internal</b> node, and internal keys are separators — removing one directly would leave a gap between two subtrees. So swap it with its <b>in-order predecessor</b>, which always lives in a leaf.", { keyMark: { node: n.id, i: i, cls: "cmp" } });
      let p = n.kids[i];
      while (p.kids.length) { c.at("pred").multi(st, { [n.id]: "active", [p.id]: "visit" }, "Walk down the rightmost path of the left subtree."); p = p.kids[p.kids.length - 1]; }
      const pred = p.keys[p.keys.length - 1];
      c.at("pred").multi(st, { [n.id]: "active", [p.id]: "target" }, "The predecessor is <b>" + pred + "</b> — the largest key smaller than " + k + ".", { keyMark: { node: p.id, i: p.keys.length - 1, cls: "target" } });
      n.keys[i] = pred;
      p.keys.pop();
      c.at("remove").multi(st, { [n.id]: "done", [p.id]: "cmp" }, "Move " + pred + " up into the separator slot and delete it from the leaf. The problem is now always \"a key was removed from a leaf\".");
      n = p;
    } else {
      n.keys.splice(i, 1);
      c.at("remove").multi(st, { [n.id]: "cmp" }, "It is in a leaf — remove it directly. The leaf now has " + n.keys.length + " key(s); the minimum is " + minKeys(st) + ".");
    }
    const shrunk = mFix(st, n, c);
    if (!shrunk) c.at("shrink^").multi(st, {}, st.root ? "The root still holds " + st.root.keys.length + " key(s), so the tree keeps its height." : "The tree is empty.");
    c.at(null).multi(st, {}, "Delete complete. Height " + mHeight(st.root) + ". O(log n), with at most one transfer-or-fusion per level.");
  }

  function mFix(st, n, c) {
    if (!n.p) {
      if (n.keys.length === 0) {
        if (n.kids.length) {
          st.root = n.kids[0];
          st.root.p = null;
          c.at("shrink").multi(st, { [st.root.id]: "done" }, "The <b>root</b> ran out of keys, so its only child becomes the new root and the tree gets <b>one level shorter</b>. This is the mirror image of a root split.");
        } else { st.root = null; c.at("shrink").multi(st, {}, "The last key is gone — the tree is empty."); }
        return true;
      }
      c.at("under").multi(st, { [n.id]: "cmp" }, "This node is the <b>root</b>, which is allowed to hold fewer keys, so the underflow loop does not run.");
      return false;
    }
    if (n.keys.length >= minKeys(st)) {
      c.at("under").multi(st, { [n.id]: "done" }, "This node still has " + n.keys.length + " key(s) ≥ the minimum " + minKeys(st) + ", so nothing else needs fixing.");
      return;
    }
    c.at("under").multi(st, { [n.id]: "swap" }, "<b>Underflow!</b> This node has " + n.keys.length + " key(s), below the minimum of " + minKeys(st) + ". Look at its immediate siblings for help.");
    const p = n.p, idx = p.kids.indexOf(n);
    const ls = idx > 0 ? p.kids[idx - 1] : null;
    const rs = idx < p.kids.length - 1 ? p.kids[idx + 1] : null;

    if (ls && ls.keys.length > minKeys(st)) {
      c.transfers++;
      c.at("transfer").multi(st, { [n.id]: "swap", [ls.id]: "active", [p.id]: "cmp" }, "The <b>left sibling</b> has " + ls.keys.length + " keys — one to spare. Do a <b>transfer</b> (a rotation through the parent): the parent's separator comes down into this node, and the sibling's largest key goes up to replace it.", { keyMark: { node: p.id, i: idx - 1, cls: "target" } });
      n.keys.unshift(p.keys[idx - 1]);
      p.keys[idx - 1] = ls.keys.pop();
      if (ls.kids.length) { const kd = ls.kids.pop(); kd.p = n; n.kids.unshift(kd); }
      c.at("transfer").multi(st, { [n.id]: "done", [ls.id]: "cmp", [p.id]: "cmp" }, "Transfer done — order is preserved because the borrowed key was the closest one on that side. No further fixing needed: the sibling still meets its minimum.");
      return;
    }
    if (rs && rs.keys.length > minKeys(st)) {
      c.transfers++;
      c.at("transfer").multi(st, { [n.id]: "swap", [rs.id]: "active", [p.id]: "cmp" }, "The <b>right sibling</b> has " + rs.keys.length + " keys — one to spare. <b>Transfer</b> through the parent from the right.", { keyMark: { node: p.id, i: idx, cls: "target" } });
      n.keys.push(p.keys[idx]);
      p.keys[idx] = rs.keys.shift();
      if (rs.kids.length) { const kd = rs.kids.shift(); kd.p = n; n.kids.push(kd); }
      c.at("transfer").multi(st, { [n.id]: "done", [rs.id]: "cmp", [p.id]: "cmp" }, "Transfer done.");
      return;
    }

    /* fusion */
    c.fusions++;
    const left = ls || n, right = ls ? n : rs, sepIdx = ls ? idx - 1 : idx;
    c.at("fusion").multi(st, { [left.id]: "active", [right.id]: "active", [p.id]: "cmp" }, "Both siblings are at their minimum, so nobody can lend a key. Instead <b>fuse</b> (merge): the two nodes plus the parent's separator key <b>" + p.keys[sepIdx] + "</b> become one node.", { keyMark: { node: p.id, i: sepIdx, cls: "target" } });
    left.keys = left.keys.concat([p.keys[sepIdx]], right.keys);
    right.kids.forEach((kd) => { kd.p = left; left.kids.push(kd); });
    p.keys.splice(sepIdx, 1);
    p.kids.splice(p.kids.indexOf(right), 1);
    c.at("fusion").multi(st, { [left.id]: "done", [p.id]: "cmp" }, "Fused into a single node with " + left.keys.length + " key(s). The parent lost a key, so it may now underflow itself — fusions <b>cascade upward</b>, and if they reach the root the tree shrinks by a level.");
    return mFix(st, p, c);
  }

  function mHeight(n) { let h = 0; while (n && n.kids.length) { h++; n = n.kids[0]; } return h; }
  function mCount(n) { return n ? n.keys.length + n.kids.reduce((s, k) => s + mCount(k), 0) : 0; }
  function mNodes(n) { return n ? 1 + n.kids.reduce((s, k) => s + mNodes(k), 0) : 0; }

  /* ============================================================
     RENDERING
     ============================================================ */
  function count(n) { return n ? 1 + count(n.left) + count(n.right) : 0; }
  function height(n) { return n ? 1 + Math.max(height(n.left), height(n.right)) : 0; }

  function renderBinary(f) {
    const root = f.root;
    const n = count(root);
    const gapX = n > 18 ? 34 : n > 12 ? 42 : 52;
    const geo = D.layoutBinary(root, { gapX: gapX, gapY: 66, padX: 30, padY: 34 });
    const W = Math.max(320, geo.width), Hh = Math.max(120, geo.height);
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + W + " " + Hh, width: W, height: Hh });
    const rr = 16;
    (function edges(nd) {
      if (!nd) return;
      [nd.left, nd.right].forEach((k) => {
        if (!k) return;
        svg.appendChild(D.sLine(nd._x, nd._y + rr, k._x, k._y - rr, "edge " + (f.marks[k.id] === "done" || f.marks[nd.id] === "done" ? "" : "")));
        edges(k);
      });
    })(root);
    (function nodes(nd) {
      if (!nd) return;
      const cls = f.marks[nd.id] || "";
      const g = D.svg("g", {});
      g.appendChild(D.svg("circle", { cx: nd._x, cy: nd._y, r: rr, class: "node-c " + cls }));
      g.appendChild(D.sText(nd._x, nd._y, nd.v, { "font-size": String(nd.v).length > 2 ? 10 : 12 }));
      if (mode === "avl") {
        const b = (nd.left ? nd.left.h : 0) - (nd.right ? nd.right.h : 0);
        g.appendChild(D.sText(nd._x + rr + 13, nd._y - 6, "h" + nd.h, { class: "lbl-s", "font-size": 9 }));
        g.appendChild(D.sText(nd._x + rr + 13, nd._y + 6, (b > 0 ? "+" : "") + b, { class: "lbl-s", "font-size": 9, fill: Math.abs(b) > 1 ? "#ff6b9d" : "#6b7997" }));
      }
      svg.appendChild(g);
      nodes(nd.left); nodes(nd.right);
    })(root);
    if (!root) svg.appendChild(D.sText(W / 2, 50, "empty tree", { class: "lbl-s", "font-size": 13 }));
    return { svg: svg, nodes: n, height: height(root) };
  }

  function layoutMulti(root) {
    const gapY = 74, sep = 22, keyW = 30, pad = 18;
    let maxD = 0, right = 0;
    const wOf = (nd) => nd.keys.length * keyW + 12;
    (function walk(nd, depth, xLeft) {
      maxD = Math.max(maxD, depth);
      nd._y = 30 + depth * gapY;
      nd._w = wOf(nd);
      if (!nd.kids.length) { nd._x = xLeft + nd._w / 2; right = Math.max(right, xLeft + nd._w); return nd._w; }
      let x = xLeft, total = 0;
      nd.kids.forEach((k) => { const w = walk(k, depth + 1, x); x += w + sep; total += w + sep; });
      total -= sep;
      nd._x = (nd.kids[0]._x + nd.kids[nd.kids.length - 1]._x) / 2;
      right = Math.max(right, xLeft + Math.max(total, nd._w));
      return Math.max(total, nd._w);
    })(root, 0, pad);
    return { width: right + pad, height: 30 + (maxD + 1) * gapY + 10 };
  }

  function renderMulti(f) {
    const root = f.root;
    if (!root) {
      const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 320 90", width: 320, height: 90 });
      svg.appendChild(D.sText(160, 45, "empty tree", { class: "lbl-s", "font-size": 13 }));
      return { svg: svg, nodes: 0, height: 0, keys: 0 };
    }
    const geo = layoutMulti(root);
    const W = Math.max(340, geo.width), Hh = Math.max(120, geo.height);
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + W + " " + Hh, width: W, height: Hh });
    const NH = 30, keyW = 30;
    (function edges(nd) {
      nd.kids.forEach((k, i) => {
        const x = nd._x - nd._w / 2 + (i / nd.kids.length) * nd._w + nd._w / (2 * nd.kids.length);
        svg.appendChild(D.sLine(x, nd._y + NH / 2, k._x, k._y - NH / 2, "edge"));
        edges(k);
      });
    })(root);
    (function nodes(nd) {
      const cls = f.marks[nd.id] || "";
      const x0 = nd._x - nd._w / 2;
      svg.appendChild(D.svg("rect", { x: x0, y: nd._y - NH / 2, width: nd._w, height: NH, rx: 6, class: "node-c " + cls }));
      nd.keys.forEach((k, i) => {
        const kx = x0 + 6 + i * keyW + keyW / 2;
        if (i > 0) svg.appendChild(D.sLine(x0 + 6 + i * keyW, nd._y - NH / 2 + 3, x0 + 6 + i * keyW, nd._y + NH / 2 - 3, "edge dim"));
        const km = f.keyMark && f.keyMark.node === nd.id && f.keyMark.i === i ? f.keyMark.cls : null;
        if (km) svg.appendChild(D.svg("rect", { x: kx - keyW / 2 + 1, y: nd._y - NH / 2 + 2, width: keyW - 2, height: NH - 4, rx: 4, fill: km === "done" ? "#4ade8033" : km === "target" ? "#22d3ee33" : "#ffc14d33" }));
        svg.appendChild(D.sText(kx, nd._y, k, { "font-size": String(k).length > 2 ? 10 : 12 }));
      });
      nd.kids.forEach(nodes);
    })(root);
    return { svg: svg, nodes: mNodes(root), height: mHeight(root), keys: mCount(root) };
  }

  function render(f) {
    const stage = q("tree-view");
    stage.innerHTML = "";
    if (!f.kind) { stage.appendChild(D.el("p", { class: "small muted", text: "Run an operation." })); return; }
    const out = f.kind === "bin" ? renderBinary(f) : renderMulti(f);
    stage.appendChild(out.svg);

    q("t-nodes").textContent = out.nodes;
    q("t-height").textContent = f.kind === "bin" ? Math.max(0, out.height - 1) : out.height;
    q("t-cmp").textContent = f.cmp == null ? "–" : f.cmp;
    if (f.kind === "bin") {
      q("t-extra-k").textContent = "rotations";
      q("t-extra").textContent = f.rot == null ? "–" : f.rot;
      q("t-extra2-k").textContent = "min possible height";
      q("t-extra2").textContent = out.nodes ? Math.floor(Math.log2(out.nodes)) : 0;
    } else {
      q("t-extra-k").textContent = "splits / fusions";
      q("t-extra").textContent = (f.splits || 0) + " / " + (f.fusions || 0);
      q("t-extra2-k").textContent = "keys / transfers";
      q("t-extra2").textContent = out.keys + " / " + (f.transfers || 0);
    }

    /* traversal output + queue */
    const ov = q("output");
    ov.innerHTML = "";
    if (f.output) {
      ov.appendChild(D.el("div", { class: "small muted", text: "visit order", style: "margin-bottom:.3rem" }));
      const row = D.el("div", { class: "cells" });
      f.output.forEach((v) => row.appendChild(D.el("div", { class: "cell filled done", text: v, style: "min-width:36px;height:30px;font-size:.76rem" })));
      ov.appendChild(f.output.length ? row : D.el("span", { class: "small muted", text: "(nothing yet)" }));
      if (f.queue) {
        ov.appendChild(D.el("div", { class: "small muted", text: "queue", style: "margin:.6rem 0 .3rem" }));
        const qr = D.el("div", { class: "cells" });
        f.queue.forEach((v) => qr.appendChild(D.el("div", { class: "cell filled cmp", text: v, style: "min-width:36px;height:30px;font-size:.76rem" })));
        ov.appendChild(f.queue.length ? qr : D.el("span", { class: "small muted", text: "(empty)" }));
      }
    }
  }

  /* ============================================================
     wiring
     ============================================================ */
  const BLURB = {
    trav:
      "All four traversals do the same Θ(n) walk — they differ only in <em>when</em> a node is reported. Pre-order " +
      "reports on the way in, in-order between the two subtrees, post-order on the way out, and level-order abandons " +
      "recursion for a queue. On a BST, in-order is the sorted sequence.",
    bst:
      "A binary search tree keeps every key in the left subtree smaller and every key in the right subtree larger. " +
      "That makes search, insert and delete <b>O(h)</b> — which is O(log n) for a bushy tree but <b>O(n)</b> for a " +
      "degenerate one. Nothing in the BST rules prevents degeneracy, which is the entire motivation for AVL trees.",
    avl:
      "An AVL tree is a BST that additionally keeps every node's balance factor in {−1, 0, +1}. Any insert or delete " +
      "that breaks this is repaired by one or two <b>rotations</b>, which preserve in-order sequence while reducing " +
      "height. Height stays ≤ 1.44·log₂n, so every operation is guaranteed O(log n).",
    t24:
      "A (2,4)-tree stores 1–3 keys per node and keeps <b>every leaf at the same depth</b>. Overflow on insert is fixed " +
      "by a <b>split</b> that pushes the middle key up; underflow on delete is fixed by a <b>transfer</b> from a sibling " +
      "or a <b>fusion</b> with one. Height is between log₄n and log₂n, so operations are O(log n) with no rotations at all.",
    btree:
      "A B-tree is the same idea with a bigger fan-out, chosen so one node fills one disk block or memory page. With " +
      "order 100 a tree of a million keys is only 3 levels deep, so a lookup costs 3 block reads. This is why every " +
      "database index and filesystem in the world is a B-tree or B⁺-tree.",
  };

  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "trav": {
    "label": "Traversals",
    "items": [
     [
      144,
      "Binary Tree Preorder Traversal",
      "binary-tree-preorder-traversal",
      "Easy",
      "Recursive, then with an explicit stack."
     ],
     [
      94,
      "Binary Tree Inorder Traversal",
      "binary-tree-inorder-traversal",
      "Easy",
      "The sorted order of a BST."
     ],
     [
      145,
      "Binary Tree Postorder Traversal",
      "binary-tree-postorder-traversal",
      "Easy",
      "Children before the parent."
     ],
     [
      102,
      "Binary Tree Level Order Traversal",
      "binary-tree-level-order-traversal",
      "Medium",
      "The queue-based walk."
     ],
     [
      104,
      "Maximum Depth of Binary Tree",
      "maximum-depth-of-binary-tree",
      "Easy",
      "Height, recursively."
     ]
    ]
   },
   "bst": {
    "label": "Binary search tree",
    "items": [
     [
      700,
      "Search in a Binary Search Tree",
      "search-in-a-binary-search-tree",
      "Easy",
      "search(k) from this tab."
     ],
     [
      701,
      "Insert into a Binary Search Tree",
      "insert-into-a-binary-search-tree",
      "Medium",
      "insert(k): a new leaf where the search falls off."
     ],
     [
      450,
      "Delete Node in a BST",
      "delete-node-in-a-bst",
      "Medium",
      "delete(k), including the two-children case."
     ],
     [
      98,
      "Validate Binary Search Tree",
      "validate-binary-search-tree",
      "Medium",
      "The BST property is about whole subtrees."
     ],
     [
      230,
      "Kth Smallest Element in a BST",
      "kth-smallest-element-in-a-bst",
      "Medium",
      "In-order traversal, stopped early."
     ]
    ]
   },
   "avl": {
    "label": "AVL tree",
    "items": [
     [
      110,
      "Balanced Binary Tree",
      "balanced-binary-tree",
      "Easy",
      "Check |height(left) − height(right)| ≤ 1 everywhere."
     ],
     [
      108,
      "Convert Sorted Array to Binary Search Tree",
      "convert-sorted-array-to-binary-search-tree",
      "Easy",
      "Build a height-balanced BST."
     ],
     [
      1382,
      "Balance a Binary Search Tree",
      "balance-a-binary-search-tree",
      "Medium",
      "Rebalance a degenerate BST."
     ]
    ]
   },
   "t24": {
    "label": "(2,4)-tree",
    "note": "LeetCode has no (2,4)-tree or B-tree problems. These practise the same ideas: sorted keys inside a node and balanced height.",
    "items": [
     [
      1382,
      "Balance a Binary Search Tree",
      "balance-a-binary-search-tree",
      "Medium",
      "Why balance matters for search cost."
     ],
     [
      108,
      "Convert Sorted Array to Binary Search Tree",
      "convert-sorted-array-to-binary-search-tree",
      "Easy",
      "Pick the middle key to keep height low — like a split."
     ],
     [
      35,
      "Search Insert Position",
      "search-insert-position",
      "Easy",
      "Finding the gap a key falls into inside a sorted node."
     ]
    ]
   },
   "btree": {
    "label": "B-tree",
    "note": "LeetCode has no B-tree problems. These practise the same ideas: searching within sorted keys and keeping every leaf at one depth.",
    "items": [
     [
      35,
      "Search Insert Position",
      "search-insert-position",
      "Easy",
      "Which child to follow inside a B-tree node."
     ],
     [
      1382,
      "Balance a Binary Search Tree",
      "balance-a-binary-search-tree",
      "Medium",
      "Balanced height, the goal of every B-tree operation."
     ],
     [
      108,
      "Convert Sorted Array to Binary Search Tree",
      "convert-sorted-array-to-binary-search-tree",
      "Easy",
      "Build a tree with all leaves at similar depth."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    const dock = D.CodeDock("#code", CODE, { recv: "tree" });
    player = new D.Player({ mount: "#player", render: render, delay: 660, code: dock });
    const PANELS = ["tools-trav", "tools-bst", "tools-avl", "tools-t24", "tools-btree"];
    const st = () => ST[mode];
    const val = () => { const v = parseInt(q("val").value, 10); return isNaN(v) ? D.randInt(1, 99) : v; };
    const show = (c) => player.load(c.frames, true);

    function still(note) {
      const c = Ctx();
      if (mode === "t24" || mode === "btree") c.multi(st(), {}, note);
      else c.bin(st(), {}, note);
      player.load(c.frames, false);
    }

    function buildBinary(target, vals, balanced) {
      const s = ST[target];
      s.root = null;
      const c = Ctx(6000);
      vals.forEach((v) => bstInsert(s, v, c, balanced));
      return c;
    }

    const setTree = (target, vals, balanced) => { ST[target].root = null; const c0 = Ctx(9000); vals.forEach((v) => bstInsert(ST[target], v, c0, balanced)); };
    const setMulti = (target, vals) => { ST[target].root = null; const c0 = Ctx(9000); vals.forEach((v) => mInsert(ST[target], v, c0)); };
    const one = (fn) => () => { const c = Ctx(3000); fn(c); show(c); };
    const EXAMPLES = {
      trav: ["pre", "in", "post", "level"].map((k) => ({
        label: { pre: "pre-order", in: "in-order = sorted", post: "post-order", level: "level-order" }[k] + " on a perfect tree",
        run: () => { setTree("trav", [50, 25, 75, 12, 37, 62, 87], false); show(traverse(ST.trav, k)); },
      })),
      bst: [
        { label: "delete a node with two children", run: () => { setTree("bst", [50, 30, 70, 20, 40, 60, 80, 65], false); one((c) => bstDelete(ST.bst, 50, c, false))(); } },
        { label: "sorted input degenerates", run: () => show(buildBinary("bst", [10, 20, 30, 40, 50, 60], false)) },
        { label: "search that misses", run: () => { setTree("bst", [50, 30, 70, 20, 40, 60, 80], false); q("val").value = 45; q("bst-search").click(); } },
      ],
      avl: [
        { label: "Left-Left: one right rotation", run: () => { setTree("avl", [30, 20], true); one((c) => bstInsert(ST.avl, 10, c, true))(); } },
        { label: "Left-Right: double rotation", run: () => { setTree("avl", [30, 10], true); one((c) => bstInsert(ST.avl, 20, c, true))(); } },
        { label: "Right-Left: double rotation", run: () => { setTree("avl", [10, 30], true); one((c) => bstInsert(ST.avl, 20, c, true))(); } },
        { label: "same sorted input, stays balanced", run: () => show(buildBinary("avl", [10, 20, 30, 40, 50, 60], true)) },
      ],
      t24: [
        { label: "overflow → split", run: () => { setMulti("t24", [10, 20, 30]); one((c) => mInsert(ST.t24, 40, c))(); } },
        { label: "cascading split: grows taller", desc: "A leaf split pushes up into a full root", run: () => { setMulti("t24", [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]); one((c) => mInsert(ST.t24, 130, c))(); } },
        { label: "underflow → transfer", desc: "The left sibling lends a key through the parent", run: () => { setMulti("t24", [10, 20, 30, 40]); one((c) => mDelete(ST.t24, 40, c))(); } },
        { label: "underflow → fusion", run: () => { setMulti("t24", [10, 20, 30, 40]); mDelete(ST.t24, 20, Ctx(3000)); one((c) => mDelete(ST.t24, 40, c))(); } },
      ],
      btree: [
        { label: "insert 1…12 (order " + ST.btree.m + ")", run: () => q("btree-seq").click() },
        { label: "delete from an internal node", run: () => { setMulti("btree", [5, 10, 15, 20, 25, 30, 35, 40, 45]); one((c) => mDelete(ST.btree, ST.btree.root.keys[0], c))(); } },
      ],
    };

    D.Tabs("#tabs", [
      { id: "trav", label: "Traversals" },
      { id: "bst", label: "Binary Search Tree" },
      { id: "avl", label: "AVL (balanced)" },
      { id: "t24", label: "(2,4)-Tree" },
      { id: "btree", label: "B-Tree" },
    ], (id) => {
      mode = id;
      PANELS.forEach((p) => (q(p).style.display = "none"));
      q("tools-" + id).style.display = "flex";
      q("blurb").innerHTML = BLURB[id];
      q("bt-order-wrap").style.display = id === "btree" ? "flex" : "none";
      dock.show({ trav: "trav_in", bst: "bst_insert", avl: "avl_insert", t24: "m_insert", btree: "m_insert" }[id]);
      D.Examples("#examples", EXAMPLES[id]);
      D.practiceShow(id);
      still("Showing the <b>" + (id === "trav" ? "traversal" : id === "bst" ? "BST" : id === "avl" ? "AVL" : id === "t24" ? "(2,4)" : "B-tree") + "</b> demo.");
    });

    /* ---- traversals ---- */
    ["pre", "in", "post", "level"].forEach((k) =>
      q("tr-" + k).addEventListener("click", () => {
        if (!ST.trav.root) return D.toast("Build a tree first.", true);
        show(traverse(ST.trav, k));
      })
    );
    q("tr-rand").addEventListener("click", () => {
      const vals = D.shuffled(D.randArray(9, 10, 99).filter((v, i, a) => a.indexOf(v) === i));
      ST.trav.root = null;
      const c = Ctx(4000);
      vals.forEach((v) => bstInsert(ST.trav, v, c, false));
      still("Built a random BST with " + count(ST.trav.root) + " nodes. Pick a traversal.");
    });
    q("tr-perfect").addEventListener("click", () => {
      ST.trav.root = null;
      const c = Ctx(4000);
      [50, 25, 75, 12, 37, 62, 87, 6, 18, 31, 43, 56, 68, 81, 93].forEach((v) => bstInsert(ST.trav, v, c, false));
      still("A <b>perfect</b> BST of 15 nodes, height 3. In-order will come out sorted; level-order reads it row by row.");
    });
    q("tr-load").addEventListener("click", () => {
      const vals = D.parseNums(q("tr-vals").value).slice(0, 24);
      if (!vals.length) return D.toast("Enter some numbers.", true);
      ST.trav.root = null;
      const c = Ctx(4000);
      vals.forEach((v) => bstInsert(ST.trav, v, c, false));
      still("Inserted " + vals.length + " values in the order you gave them.");
    });

    /* ---- BST / AVL shared ops ---- */
    [["bst", false], ["avl", true]].forEach(function (pair) {
      const pre = pair[0], bal = pair[1];
      q(pre + "-insert").addEventListener("click", () => { const c = Ctx(1500); bstInsert(ST[pre], val(), c, bal); show(c); });
      q(pre + "-search").addEventListener("click", () => {
        show(bstSearch(ST[pre], val()));
      });
      q(pre + "-delete").addEventListener("click", () => { const c = Ctx(1500); bstDelete(ST[pre], val(), c, bal); show(c); });
      q(pre + "-rand").addEventListener("click", () => {
        const vals = D.randArray(9, 10, 99).filter((v, i, a) => a.indexOf(v) === i);
        show(buildBinary(pre, vals, bal));
      });
      q(pre + "-clear").addEventListener("click", () => { ST[pre].root = null; still("Cleared."); });
    });
    q("bst-degenerate").addEventListener("click", () => {
      show(buildBinary("bst", [10, 20, 30, 40, 50, 60], false));
      D.toast("Sorted input → a linked list. Search is now O(n).");
    });
    q("avl-degenerate").addEventListener("click", () => {
      show(buildBinary("avl", [10, 20, 30, 40, 50, 60], true));
      D.toast("Same sorted input — rotations keep it O(log n).");
    });

    /* ---- multiway ops ---- */
    [["t24", 4], ["btree", 5]].forEach(function (pair) {
      const pre = pair[0];
      q(pre + "-insert").addEventListener("click", () => { const c = Ctx(1500); mInsert(ST[pre], val(), c); show(c); });
      q(pre + "-search").addEventListener("click", () => {
        const c = Ctx(1000).code("m_search"), v = val();
        if (!ST[pre].root) { c.at("start").multi(ST[pre], {}, "The tree is empty."); }
        else { c.at("start").multi(ST[pre], {}, "<b>search(" + v + ")</b> — at each node scan its keys, then drop into the right child."); mFind(ST[pre], v, c); }
        show(c);
      });
      q(pre + "-delete").addEventListener("click", () => { const c = Ctx(1800); mDelete(ST[pre], val(), c); show(c); });
      q(pre + "-rand").addEventListener("click", () => {
        const vals = D.shuffled(D.randArray(14, 1, 99).filter((v, i, a) => a.indexOf(v) === i));
        ST[pre].root = null;
        const c = Ctx(8000);
        vals.forEach((v) => mInsert(ST[pre], v, c));
        still("Inserted " + vals.length + " random keys. Height " + mHeight(ST[pre].root) + " — every leaf at the same depth.");
      });
      q(pre + "-seq").addEventListener("click", () => {
        ST[pre].root = null;
        const c = Ctx(8000);
        for (let v = 1; v <= 12; v++) mInsert(ST[pre], v, c);
        show(c);
        D.toast("Sorted input is fine here — splits keep it balanced.");
      });
      q(pre + "-clear").addEventListener("click", () => { ST[pre].root = null; still("Cleared."); });
    });
    q("bt-order").addEventListener("change", (e) => {
      const m = D.clamp(parseInt(e.target.value, 10) || 5, 3, 7);
      e.target.value = m;
      ST.btree.m = m;
      ST.btree.root = null;
      still("Rebuilt as an empty B-tree of order " + m + ": up to " + m + " children, " + (m - 1) + " keys per node, minimum " + (Math.ceil(m / 2) - 1) + " keys outside the root.");
    });

    D.legend("#legend", [
      { color: "var(--c-active)", label: "current node" },
      { color: "var(--c-cmp)", label: "compared / on the path" },
      { color: "var(--c-visit)", label: "already passed through" },
      { color: "var(--c-swap)", label: "problem here (unbalanced / overflow / underflow)" },
      { color: "var(--c-target)", label: "successor / separator key" },
      { color: "var(--c-done)", label: "settled" },
    ]);

    /* seed all five */
    let c0 = Ctx(9000);
    [50, 25, 75, 12, 37, 62, 87].forEach((v) => bstInsert(ST.trav, v, c0, false));
    [50, 30, 70, 20, 40, 60, 80].forEach((v) => bstInsert(ST.bst, v, c0, false));
    [50, 30, 70, 20, 40, 60, 80, 10].forEach((v) => bstInsert(ST.avl, v, c0, true));
    [10, 20, 30, 40, 50, 60, 70].forEach((v) => mInsert(ST.t24, v, c0));
    [5, 10, 15, 20, 25, 30, 35, 40, 45].forEach((v) => mInsert(ST.btree, v, c0));
    still("A BST of 7 nodes. Pick a traversal to see how the four orders differ.");
  });
})();
