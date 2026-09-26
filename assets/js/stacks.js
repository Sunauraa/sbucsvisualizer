/* ============================================================
   stacks.js — array stack, plain array queue, circular queue,
   circular deque, a side-by-side "why circular?" comparison,
   and two stack applications (brackets, postfix).
   ============================================================ */
(function () {
  "use strict";
  const D = window.DSA;
  const q = (id) => D.$("#" + id);
  const CAP = 8;

  /* ============================================================
     CODE LISTINGS
     ============================================================ */
  const CODE = {
    st_push: {
      title: "push(x) — ArrayStack",
      pseudo: [
        "push(x):                      // t = index of the top, -1 when empty",
        "  if t == capacity - 1: error \"stack is full\" @@full",
        "  t ← t + 1 @@inc",
        "  S[t] ← x @@write",
      ],
      java: [
        "void push(int x) {",
        "  if (t == data.length - 1) throw new IllegalStateException(\"full\"); @@full",
        "  t++; @@inc",
        "  data[t] = x; @@write",
        "}",
      ],
      cpp: [
        "void push(int x) {",
        "  if (t == CAP - 1) throw overflow_error(\"full\"); @@full",
        "  t++; @@inc",
        "  data[t] = x; @@write",
        "}",
      ],
      python: [
        "def push(self, x):",
        "  if self.t == len(self.data) - 1: @@full",
        "    raise OverflowError('full') @@full",
        "  self.t += 1 @@inc",
        "  self.data[self.t] = x @@write",
      ],
    },
    st_pop: {
      title: "pop() — ArrayStack",
      pseudo: [
        "pop():",
        "  if t == -1: error \"stack is empty\" @@empty",
        "  x ← S[t] @@save",
        "  S[t] ← null                 // let the element be collected @@clear",
        "  t ← t - 1 @@dec",
        "  return x @@ret",
      ],
      java: [
        "int pop() {",
        "  if (t == -1) throw new EmptyStackException(); @@empty",
        "  int x = data[t]; @@save",
        "  data[t] = 0; @@clear",
        "  t--; @@dec",
        "  return x; @@ret",
        "}",
      ],
      cpp: [
        "int pop() {",
        "  if (t == -1) throw underflow_error(\"empty\"); @@empty",
        "  int x = data[t]; @@save",
        "  data[t] = 0; @@clear",
        "  t--; @@dec",
        "  return x; @@ret",
        "}",
      ],
      python: [
        "def pop(self):",
        "  if self.t == -1: @@empty",
        "    raise IndexError('empty') @@empty",
        "  x = self.data[self.t] @@save",
        "  self.data[self.t] = None @@clear",
        "  self.t -= 1 @@dec",
        "  return x @@ret",
      ],
    },
    st_top: {
      title: "top() — ArrayStack",
      pseudo: ["top():", "  if t == -1: error \"stack is empty\" @@empty", "  return S[t]            // look, don't remove @@ret"],
      java: ["int top() {", "  if (t == -1) throw new EmptyStackException(); @@empty", "  return data[t]; @@ret", "}"],
      cpp: ["int top() const {", "  if (t == -1) throw underflow_error(\"empty\"); @@empty", "  return data[t]; @@ret", "}"],
      python: ["def top(self):", "  if self.t == -1: @@empty", "    raise IndexError('empty') @@empty", "  return self.data[self.t] @@ret"],
    },

    aq_enqueue: {
      title: "enqueue(x) — plain array, front pinned at 0",
      pseudo: ["enqueue(x):", "  if n == capacity: error \"queue is full\" @@full", "  Q[n] ← x @@write", "  n ← n + 1 @@size"],
      java: ["void enqueue(int x) {", "  if (n == data.length) throw new IllegalStateException(\"full\"); @@full", "  data[n] = x; @@write", "  n++; @@size", "}"],
      cpp: ["void enqueue(int x) {", "  if (n == CAP) throw overflow_error(\"full\"); @@full", "  data[n] = x; @@write", "  n++; @@size", "}"],
      python: ["def enqueue(self, x):", "  if self.n == len(self.data): @@full", "    raise OverflowError('full') @@full", "  self.data[self.n] = x @@write", "  self.n += 1 @@size"],
    },
    aq_dequeue: {
      title: "dequeue() — plain array, front pinned at 0",
      pseudo: [
        "dequeue():",
        "  if n == 0: error \"queue is empty\" @@empty",
        "  x ← Q[0] @@save",
        "  for k ← 1 to n-1:           // everyone shuffles forward: O(n) @@shift",
        "    Q[k-1] ← Q[k] @@shift",
        "  n ← n - 1;  Q[n] ← null @@size",
        "  return x @@ret",
      ],
      java: [
        "int dequeue() {",
        "  if (n == 0) throw new NoSuchElementException(); @@empty",
        "  int x = data[0]; @@save",
        "  for (int k = 1; k < n; k++)   // O(n) @@shift",
        "    data[k - 1] = data[k]; @@shift",
        "  n--;  data[n] = 0; @@size",
        "  return x; @@ret",
        "}",
      ],
      cpp: [
        "int dequeue() {",
        "  if (n == 0) throw underflow_error(\"empty\"); @@empty",
        "  int x = data[0]; @@save",
        "  for (int k = 1; k < n; k++)   // O(n) @@shift",
        "    data[k - 1] = data[k]; @@shift",
        "  n--;  data[n] = 0; @@size",
        "  return x; @@ret",
        "}",
      ],
      python: [
        "def dequeue(self):",
        "  if self.n == 0: @@empty",
        "    raise IndexError('empty') @@empty",
        "  x = self.data[0] @@save",
        "  for k in range(1, self.n):   # O(n) @@shift",
        "    self.data[k - 1] = self.data[k] @@shift",
        "  self.n -= 1 @@size",
        "  self.data[self.n] = None @@size",
        "  return x @@ret",
      ],
    },
    dr_enqueue: {
      title: "enqueue(x) — plain array, no wrap-around",
      pseudo: ["enqueue(x):", "  if rear == capacity: error \"full\"     // even if front > 0! @@full", "  Q[rear] ← x @@write", "  rear ← rear + 1 @@size"],
      java: ["void enqueue(int x) {", "  if (rear == data.length) throw new IllegalStateException(\"full\"); @@full", "  data[rear] = x; @@write", "  rear++; @@size", "}"],
      cpp: ["void enqueue(int x) {", "  if (rear == CAP) throw overflow_error(\"full\"); @@full", "  data[rear] = x; @@write", "  rear++; @@size", "}"],
      python: ["def enqueue(self, x):", "  if self.rear == len(self.data): @@full", "    raise OverflowError('full') @@full", "  self.data[self.rear] = x @@write", "  self.rear += 1 @@size"],
    },
    dr_dequeue: {
      title: "dequeue() — plain array, no wrap-around",
      pseudo: [
        "dequeue():",
        "  if front == rear: error \"queue is empty\" @@empty",
        "  x ← Q[front];  Q[front] ← null @@save",
        "  front ← front + 1           // that slot is never used again @@adv",
        "  return x @@ret",
      ],
      java: ["int dequeue() {", "  if (front == rear) throw new NoSuchElementException(); @@empty", "  int x = data[front];  data[front] = 0; @@save", "  front++; @@adv", "  return x; @@ret", "}"],
      cpp: ["int dequeue() {", "  if (front == rear) throw underflow_error(\"empty\"); @@empty", "  int x = data[front];  data[front] = 0; @@save", "  front++; @@adv", "  return x; @@ret", "}"],
      python: [
        "def dequeue(self):",
        "  if self.front == self.rear: @@empty",
        "    raise IndexError('empty') @@empty",
        "  x = self.data[self.front] @@save",
        "  self.data[self.front] = None @@save",
        "  self.front += 1 @@adv",
        "  return x @@ret",
      ],
    },

    cq_enqueue: {
      title: "enqueue(x) — circular array",
      pseudo: [
        "enqueue(x):",
        "  if size == capacity: error \"queue is full\" @@full",
        "  avail ← (front + size) mod capacity     // wraps past the end @@avail",
        "  Q[avail] ← x @@write",
        "  size ← size + 1 @@size",
      ],
      java: [
        "void enqueue(int x) {",
        "  if (size == data.length) throw new IllegalStateException(\"full\"); @@full",
        "  int avail = (front + size) % data.length; @@avail",
        "  data[avail] = x; @@write",
        "  size++; @@size",
        "}",
      ],
      cpp: [
        "void enqueue(int x) {",
        "  if (size == CAP) throw overflow_error(\"full\"); @@full",
        "  int avail = (front + size) % CAP; @@avail",
        "  data[avail] = x; @@write",
        "  size++; @@size",
        "}",
      ],
      python: [
        "def enqueue(self, x):",
        "  if self.size == len(self.data): @@full",
        "    raise OverflowError('full') @@full",
        "  avail = (self.front + self.size) % len(self.data) @@avail",
        "  self.data[avail] = x @@write",
        "  self.size += 1 @@size",
      ],
    },
    cq_dequeue: {
      title: "dequeue() — circular array",
      pseudo: [
        "dequeue():",
        "  if size == 0: error \"queue is empty\" @@empty",
        "  x ← Q[front];  Q[front] ← null @@save",
        "  front ← (front + 1) mod capacity        // wrap around @@adv",
        "  size ← size - 1 @@size",
        "  return x @@ret",
      ],
      java: [
        "int dequeue() {",
        "  if (size == 0) throw new NoSuchElementException(); @@empty",
        "  int x = data[front];  data[front] = 0; @@save",
        "  front = (front + 1) % data.length; @@adv",
        "  size--; @@size",
        "  return x; @@ret",
        "}",
      ],
      cpp: [
        "int dequeue() {",
        "  if (size == 0) throw underflow_error(\"empty\"); @@empty",
        "  int x = data[front];  data[front] = 0; @@save",
        "  front = (front + 1) % CAP; @@adv",
        "  size--; @@size",
        "  return x; @@ret",
        "}",
      ],
      python: [
        "def dequeue(self):",
        "  if self.size == 0: @@empty",
        "    raise IndexError('empty') @@empty",
        "  x = self.data[self.front] @@save",
        "  self.data[self.front] = None @@save",
        "  self.front = (self.front + 1) % len(self.data) @@adv",
        "  self.size -= 1 @@size",
        "  return x @@ret",
      ],
    },
    cq_first: {
      title: "first() — circular array",
      pseudo: ["first():", "  if size == 0: return null @@empty", "  return Q[front] @@ret"],
      java: ["Integer first() {", "  if (size == 0) return null; @@empty", "  return data[front]; @@ret", "}"],
      cpp: ["optional<int> first() const {", "  if (size == 0) return nullopt; @@empty", "  return data[front]; @@ret", "}"],
      python: ["def first(self):", "  if self.size == 0: @@empty", "    return None @@empty", "  return self.data[self.front] @@ret"],
    },

    dq_addFirst: {
      title: "addFirst(x) — circular deque",
      pseudo: [
        "addFirst(x):",
        "  if size == capacity: error \"full\" @@full",
        "  front ← (front - 1 + capacity) mod capacity   // + capacity keeps it ≥ 0 @@idx",
        "  D[front] ← x @@write",
        "  size ← size + 1 @@size",
      ],
      java: [
        "void addFirst(int x) {",
        "  if (size == data.length) throw new IllegalStateException(\"full\"); @@full",
        "  front = (front - 1 + data.length) % data.length; @@idx",
        "  data[front] = x; @@write",
        "  size++; @@size",
        "}",
      ],
      cpp: [
        "void addFirst(int x) {",
        "  if (size == CAP) throw overflow_error(\"full\"); @@full",
        "  front = (front - 1 + CAP) % CAP; @@idx",
        "  data[front] = x; @@write",
        "  size++; @@size",
        "}",
      ],
      python: [
        "def add_first(self, x):",
        "  if self.size == len(self.data): @@full",
        "    raise OverflowError('full') @@full",
        "  self.front = (self.front - 1) % len(self.data)  # Python % is never negative @@idx",
        "  self.data[self.front] = x @@write",
        "  self.size += 1 @@size",
      ],
    },
    dq_addLast: {
      title: "addLast(x) — circular deque",
      pseudo: ["addLast(x):", "  if size == capacity: error \"full\" @@full", "  avail ← (front + size) mod capacity @@idx", "  D[avail] ← x @@write", "  size ← size + 1 @@size"],
      java: [
        "void addLast(int x) {",
        "  if (size == data.length) throw new IllegalStateException(\"full\"); @@full",
        "  int avail = (front + size) % data.length; @@idx",
        "  data[avail] = x; @@write",
        "  size++; @@size",
        "}",
      ],
      cpp: ["void addLast(int x) {", "  if (size == CAP) throw overflow_error(\"full\"); @@full", "  int avail = (front + size) % CAP; @@idx", "  data[avail] = x; @@write", "  size++; @@size", "}"],
      python: [
        "def add_last(self, x):",
        "  if self.size == len(self.data): @@full",
        "    raise OverflowError('full') @@full",
        "  avail = (self.front + self.size) % len(self.data) @@idx",
        "  self.data[avail] = x @@write",
        "  self.size += 1 @@size",
      ],
    },
    dq_removeFirst: {
      title: "removeFirst() — circular deque",
      pseudo: [
        "removeFirst():",
        "  if size == 0: error \"empty\" @@empty",
        "  x ← D[front];  D[front] ← null @@save",
        "  front ← (front + 1) mod capacity @@adv",
        "  size ← size - 1 @@size",
        "  return x @@ret",
      ],
      java: [
        "int removeFirst() {",
        "  if (size == 0) throw new NoSuchElementException(); @@empty",
        "  int x = data[front];  data[front] = 0; @@save",
        "  front = (front + 1) % data.length; @@adv",
        "  size--; @@size",
        "  return x; @@ret",
        "}",
      ],
      cpp: [
        "int removeFirst() {",
        "  if (size == 0) throw underflow_error(\"empty\"); @@empty",
        "  int x = data[front];  data[front] = 0; @@save",
        "  front = (front + 1) % CAP; @@adv",
        "  size--; @@size",
        "  return x; @@ret",
        "}",
      ],
      python: [
        "def remove_first(self):",
        "  if self.size == 0: @@empty",
        "    raise IndexError('empty') @@empty",
        "  x = self.data[self.front] @@save",
        "  self.data[self.front] = None @@save",
        "  self.front = (self.front + 1) % len(self.data) @@adv",
        "  self.size -= 1 @@size",
        "  return x @@ret",
      ],
    },
    dq_removeLast: {
      title: "removeLast() — circular deque",
      pseudo: [
        "removeLast():",
        "  if size == 0: error \"empty\" @@empty",
        "  back ← (front + size - 1) mod capacity @@idx",
        "  x ← D[back];  D[back] ← null @@save",
        "  size ← size - 1             // front does not move @@size",
        "  return x @@ret",
      ],
      java: [
        "int removeLast() {",
        "  if (size == 0) throw new NoSuchElementException(); @@empty",
        "  int back = (front + size - 1) % data.length; @@idx",
        "  int x = data[back];  data[back] = 0; @@save",
        "  size--; @@size",
        "  return x; @@ret",
        "}",
      ],
      cpp: [
        "int removeLast() {",
        "  if (size == 0) throw underflow_error(\"empty\"); @@empty",
        "  int back = (front + size - 1) % CAP; @@idx",
        "  int x = data[back];  data[back] = 0; @@save",
        "  size--; @@size",
        "  return x; @@ret",
        "}",
      ],
      python: [
        "def remove_last(self):",
        "  if self.size == 0: @@empty",
        "    raise IndexError('empty') @@empty",
        "  back = (self.front + self.size - 1) % len(self.data) @@idx",
        "  x = self.data[back] @@save",
        "  self.data[back] = None @@save",
        "  self.size -= 1 @@size",
        "  return x @@ret",
      ],
    },

    brackets: {
      title: "isBalanced(s)",
      pseudo: [
        "isBalanced(s):",
        "  S ← empty stack @@init",
        "  for each character c in s: @@loop",
        "    if c is an opener ( [ {: S.push(c) @@push",
        "    else if c is a closer ) ] }: @@closer",
        "      if S is empty: return false          // nothing to close @@emptyfail",
        "      if S.pop() does not match c: return false @@match,mismatch",
        "  return S is empty                        // anything left was never closed @@end",
      ],
      java: [
        "boolean isBalanced(String s) {",
        "  Deque<Character> st = new ArrayDeque<>(); @@init",
        "  for (char c : s.toCharArray()) { @@loop",
        "    if (\"([{\".indexOf(c) >= 0) st.push(c); @@push",
        "    else if (\")]}\".indexOf(c) >= 0) { @@closer",
        "      if (st.isEmpty()) return false; @@emptyfail",
        "      if (\"([{\".indexOf(st.pop()) != \")]}\".indexOf(c)) return false; @@match,mismatch",
        "    }",
        "  }",
        "  return st.isEmpty(); @@end",
        "}",
      ],
      cpp: [
        "bool isBalanced(const string& s) {",
        "  stack<char> st; @@init",
        "  const string open = \"([{\", close = \")]}\";",
        "  for (char c : s) { @@loop",
        "    if (open.find(c) != string::npos) st.push(c); @@push",
        "    else if (close.find(c) != string::npos) { @@closer",
        "      if (st.empty()) return false; @@emptyfail",
        "      char top = st.top();  st.pop(); @@match",
        "      if (open.find(top) != close.find(c)) return false; @@match,mismatch",
        "    }",
        "  }",
        "  return st.empty(); @@end",
        "}",
      ],
      python: [
        "def is_balanced(s):",
        "  st = [] @@init",
        "  for c in s: @@loop",
        "    if c in '([{': @@push",
        "      st.append(c) @@push",
        "    elif c in ')]}': @@closer",
        "      if not st: @@emptyfail",
        "        return False @@emptyfail",
        "      if '([{'.index(st.pop()) != ')]}'.index(c): @@match",
        "        return False @@mismatch",
        "  return not st @@end",
      ],
    },
    postfix: {
      title: "evalPostfix(tokens)",
      pseudo: [
        "evalPostfix(tokens):",
        "  S ← empty stack @@init",
        "  for each token t: @@loop",
        "    if t is a number: S.push(t) @@push",
        "    else:                              // t is an operator @@op",
        "      b ← S.pop();  a ← S.pop()          // b comes off first! @@pop",
        "      S.push(a t b) @@apply",
        "  return S.pop()                       // exactly one value should remain @@end",
      ],
      java: [
        "double evalPostfix(String[] tokens) {",
        "  Deque<Double> st = new ArrayDeque<>(); @@init",
        "  for (String t : tokens) { @@loop",
        "    if (isNumber(t)) st.push(Double.parseDouble(t)); @@push",
        "    else { @@op",
        "      double b = st.pop(), a = st.pop(); @@pop",
        "      st.push(apply(t, a, b)); @@apply",
        "    }",
        "  }",
        "  return st.pop(); @@end",
        "}",
      ],
      cpp: [
        "double evalPostfix(const vector<string>& tokens) {",
        "  stack<double> st; @@init",
        "  for (const string& t : tokens) { @@loop",
        "    if (isNumber(t)) st.push(stod(t)); @@push",
        "    else { @@op",
        "      double b = st.top();  st.pop(); @@pop",
        "      double a = st.top();  st.pop(); @@pop",
        "      st.push(apply(t, a, b)); @@apply",
        "    }",
        "  }",
        "  return st.top(); @@end",
        "}",
      ],
      python: [
        "def eval_postfix(tokens):",
        "  st = [] @@init",
        "  for t in tokens: @@loop",
        "    if is_number(t): @@push",
        "      st.append(float(t)) @@push",
        "    else: @@op",
        "      b, a = st.pop(), st.pop() @@pop",
        "      st.append(apply(t, a, b)) @@apply",
        "  return st.pop() @@end",
      ],
    },
  };

  /* ============================================================
     SPECS
     ============================================================ */
  const M = (t) => "<span class='mono'>" + t + "</span>";
  D.specs(CODE, {
    st_push: { does: "Pushes " + M("x") + " onto the top of an array-backed stack.", params: M("x") + " — the value", returns: "nothing", errors: "stack overflow when the array is full (t == capacity − 1)", cost: "O(1)" },
    st_pop: { does: "Removes and returns the top element — the one pushed most recently (LIFO).", params: "none", returns: "the former top", errors: "stack underflow when empty (t == −1)", cost: "O(1)" },
    st_top: { does: "Returns the top element without removing it (also called peek).", params: "none", returns: "the top element", errors: "empty-stack error when t == −1", cost: "O(1)" },
    aq_enqueue: { does: "Adds " + M("x") + " at the rear of a queue whose front is pinned at index 0.", params: M("x") + " — the value", returns: "nothing", errors: "queue is full when n == capacity", cost: "O(1)" },
    aq_dequeue: { does: "Removes and returns the front, then shifts every other element one slot forward so the front stays at 0.", params: "none", returns: "the former front (FIFO)", errors: "queue is empty when n == 0", cost: "O(n) — the shifting is the problem a circular array solves" },
    dr_enqueue: { does: "Adds " + M("x") + " at the rear; front and rear only ever move right.", params: M("x") + " — the value", returns: "nothing", errors: "reports full once rear reaches the end, even if the front has freed slots", cost: "O(1)" },
    dr_dequeue: { does: "Removes and returns the front by moving the front index right — no shifting.", params: "none", returns: "the former front", errors: "queue is empty when front == rear", cost: "O(1), but freed slots are never reused" },
    cq_enqueue: { does: "Adds " + M("x") + " at the rear of a circular array, at " + M("(front + size) mod capacity") + ".", params: M("x") + " — the value", returns: "nothing", errors: "queue is full when size == capacity", cost: "O(1)" },
    cq_dequeue: { does: "Removes and returns the front, then advances front with wrap-around.", params: "none", returns: "the former front (FIFO)", errors: "queue is empty when size == 0", cost: "O(1), and every slot gets reused" },
    cq_first: { does: "Returns the front element without removing it.", params: "none", returns: "the front, or null if the queue is empty", errors: "none (null when empty)", cost: "O(1)" },
    dq_addFirst: { does: "Adds " + M("x") + " at the front of a circular deque by stepping front back one slot (mod capacity).", params: M("x") + " — the value", returns: "nothing", errors: "deque is full when size == capacity", cost: "O(1)" },
    dq_addLast: { does: "Adds " + M("x") + " at the back, at " + M("(front + size) mod capacity") + ".", params: M("x") + " — the value", returns: "nothing", errors: "deque is full when size == capacity", cost: "O(1)" },
    dq_removeFirst: { does: "Removes and returns the front element and advances front.", params: "none", returns: "the former front", errors: "deque is empty when size == 0", cost: "O(1)" },
    dq_removeLast: { does: "Removes and returns the back element; front does not move.", params: "none", returns: "the former back", errors: "deque is empty when size == 0", cost: "O(1)" },
    brackets: { does: "Checks that every (, [ and { is closed by the matching bracket in the right order, using a stack of open brackets.", params: M("s") + " — any string; other characters are ignored", returns: "true if balanced, false otherwise", errors: "none — mismatches return false", cost: "O(n) time, O(n) stack space in the worst case", callVals: { s: '"{[()()]}"' } },
    postfix: { does: "Evaluates a postfix (reverse Polish) expression with a stack of operands.", params: M("tokens") + " — numbers and operators + − × ÷ % ^", returns: "the value of the expression", errors: "malformed if an operator finds fewer than 2 operands, or more than one value is left; division by zero", cost: "O(n)", callVals: { tokens: { pseudo: "[5, 1, 2, +, 4, *, +, 3, −]", java: 'new String[]{"5", "1", "2", "+"}', cpp: '{"5", "1", "2", "+"}', python: '["5", "1", "2", "+"]' } } },
  });

  /* ============================================================
     STATE
     ============================================================ */
  const fresh = () => new Array(CAP).fill(null);
  const S = { a: fresh(), t: -1 };                          /* ArrayStack */
  const AQ = { a: fresh(), n: 0, shifts: 0 };               /* front pinned at 0 */
  const CQ = { a: fresh(), front: 0, size: 0 };             /* circular queue */
  const DQ = { a: fresh(), front: 0, size: 0 };             /* circular deque */
  const CL = { a: fresh(), n: 0, front: 0, rear: 0, shifts: 0, mode: "shift" };   /* compare: left */
  const CR = { a: fresh(), front: 0, size: 0, shifts: 0 };                          /* compare: right */
  let tab = "stack", player, dock, dockL, dockR;

  /* ============================================================
     STACK
     ============================================================ */
  const stRec = () => D.Rec(() => ({ kind: "stack", a: S.a.slice(), t: S.t, marks: {} }));
  const stack = {
    push(v) {
      const r = stRec().code("st_push");
      r.snap({ note: "<b>push(" + v + ")</b>. t = " + S.t + "." });
      if (S.t === CAP - 1) { r.at("full").snap({ marks: range(0, S.t, "swap"), note: "<b>Stack overflow</b>: t = " + S.t + " = capacity − 1. A growable stack would double the array here." }); return r; }
      r.at("full^").snap({ note: "t = " + S.t + " &lt; " + (CAP - 1) + " — there is room." });
      S.t++;
      r.at("inc").snap({ marks: { [S.t]: "cmp" }, note: "t ← " + S.t + ". The top of the stack is simply the highest used index." });
      S.a[S.t] = v;
      r.at("write").snap({ marks: { [S.t]: "done" }, note: "data[" + S.t + "] ← " + v + ". <b>O(1)</b>, and nothing else moved." });
      return r;
    },
    pop() {
      const r = stRec().code("st_pop");
      r.snap({ note: "<b>pop()</b>." });
      if (S.t < 0) { r.at("empty").snap({ note: "<b>Stack underflow</b>: t = −1, nothing to pop." }); return r; }
      r.at("empty^").snap({ note: "t = " + S.t + " ≥ 0 — not empty." });
      const v = S.a[S.t];
      r.at("save").snap({ marks: { [S.t]: "target" }, note: "x = data[" + S.t + "] = " + v + "." });
      S.a[S.t] = null;
      r.at("clear").snap({ marks: { [S.t]: "swap" }, note: "Null out the slot so the old element can be garbage-collected." });
      S.t--;
      r.at("dec").snap({ note: "t ← " + S.t + "." });
      r.at("ret").snap({ note: "Return " + v + ". <b>LIFO</b>: the last element pushed is the first to leave. <b>O(1)</b>." });
      return r;
    },
    top() {
      const r = stRec().code("st_top");
      r.snap({ note: "<b>top()</b>." });
      if (S.t < 0) { r.at("empty").snap({ note: "Empty stack — error." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      r.at("ret").snap({ marks: { [S.t]: "target" }, note: "Return data[t] = " + S.a[S.t] + " and leave t alone. The stack is unchanged." });
      return r;
    },
  };

  /* ============================================================
     QUEUES
     ============================================================ */
  /* ---- plain array, front pinned at 0 (shared by the tab and the comparison) ---- */
  function aqEnqueue(Q, r, v) {
    r.code("aq_enqueue");
    if (Q.n === CAP) { r.at("full").snap({ marks: range(0, CAP - 1, "swap"), note: "<b>Full</b>: all " + CAP + " slots are in use." }); return; }
    r.at("full^").snap({ note: "n = " + Q.n + " &lt; " + CAP + "." });
    Q.a[Q.n] = v;
    r.at("write").snap({ marks: { [Q.n]: "done" }, note: "Q[" + Q.n + "] ← " + v + "." });
    Q.n++;
    r.at("size").snap({ marks: { [Q.n - 1]: "done" }, note: "n = " + Q.n + ". Enqueue is <b>O(1)</b>." });
  }
  function aqDequeue(Q, r) {
    r.code("aq_dequeue");
    if (!Q.n) { r.at("empty").snap({ note: "The queue is empty." }); return; }
    r.at("empty^").snap({ note: "n = " + Q.n + " — not empty." });
    const v = Q.a[0];
    r.at("save").snap({ marks: { 0: "target" }, note: "x = Q[0] = " + v + ". The front is always index 0 in this design." });
    for (let k = 1; k < Q.n; k++) {
      Q.a[k - 1] = Q.a[k];
      Q.shifts++;
      r.at("shift").snap({ marks: { [k - 1]: "swap", [k]: "cmp" }, note: "Shift Q[" + k + "] = " + Q.a[k] + " forward to slot " + (k - 1) + ". Shifts so far: <b>" + Q.shifts + "</b>." });
    }
    Q.n--;
    Q.a[Q.n] = null;
    r.at("size").snap({ note: "n = " + Q.n + "." });
    r.at("ret").snap({ note: "Return " + v + ". That dequeue cost " + Q.n + " shift(s) — one for every element left behind. With n elements that is n − 1 shifts, so dequeue is <b>O(n)</b>." });
  }
  /* ---- plain array, front moves, no wrap ---- */
  function drEnqueue(Q, r, v) {
    r.code("dr_enqueue");
    if (Q.rear === CAP) {
      r.at("full").snap({ marks: range(0, Q.front - 1, "swap"), note: "<b>“Full”</b> — rear has hit the end of the array, although " + Q.front + " slot(s) at the front are empty. They can never be reused." });
      return;
    }
    r.at("full^").snap({ note: "rear = " + Q.rear + " &lt; " + CAP + "." });
    Q.a[Q.rear] = v;
    r.at("write").snap({ marks: { [Q.rear]: "done" }, note: "Q[" + Q.rear + "] ← " + v + "." });
    Q.rear++;
    Q.n++;
    r.at("size").snap({ marks: { [Q.rear - 1]: "done" }, note: "rear = " + Q.rear + ". O(1)." });
  }
  function drDequeue(Q, r) {
    r.code("dr_dequeue");
    if (Q.front === Q.rear) { r.at("empty").snap({ note: "Empty." }); return; }
    r.at("empty^").snap({ note: "front ≠ rear — not empty." });
    const v = Q.a[Q.front];
    Q.a[Q.front] = null;
    r.at("save").snap({ marks: { [Q.front]: "target" }, note: "x = Q[" + Q.front + "] = " + v + "." });
    Q.front++;
    Q.n--;
    r.at("adv").snap({ marks: range(0, Q.front - 1, "ghost"), note: "front ← " + Q.front + ". O(1), with no shifting. But slot " + (Q.front - 1) + " is now dead space." });
    r.at("ret").snap({ note: "Return " + v + "." });
  }
  /* ---- circular ---- */
  function cqEnqueue(Q, r, v) {
    r.code("cq_enqueue");
    if (Q.size === CAP) { r.at("full").snap({ marks: range(0, CAP - 1, "swap"), note: "<b>Full</b>: size = capacity = " + CAP + ". Every slot really is in use." }); return; }
    r.at("full^").snap({ note: "size = " + Q.size + " &lt; " + CAP + "." });
    const at = (Q.front + Q.size) % CAP;
    r.at("avail").snap({ marks: { [at]: "cmp" }, note: "avail = (front + size) mod " + CAP + " = (" + Q.front + " + " + Q.size + ") mod " + CAP + " = <b>" + at + "</b>" + (Q.front + Q.size >= CAP ? " — <b>wrapped</b> round to the start." : ".") });
    Q.a[at] = v;
    r.at("write").snap({ marks: { [at]: "done" }, note: "Q[" + at + "] ← " + v + "." });
    Q.size++;
    r.at("size").snap({ marks: { [at]: "done" }, note: "size = " + Q.size + ". <b>O(1)</b>." });
  }
  function cqDequeue(Q, r) {
    r.code("cq_dequeue");
    if (!Q.size) { r.at("empty").snap({ note: "Empty." }); return; }
    r.at("empty^").snap({ note: "size = " + Q.size + " — not empty." });
    const at = Q.front, v = Q.a[at];
    Q.a[at] = null;
    r.at("save").snap({ marks: { [at]: "target" }, note: "x = Q[" + at + "] = " + v + "." });
    Q.front = (Q.front + 1) % CAP;
    r.at("adv").snap({ marks: { [Q.front]: "cmp" }, note: "front ← (" + at + " + 1) mod " + CAP + " = " + Q.front + (at === CAP - 1 ? " — <b>wrapped</b>." : ".") + " Slot " + at + " is free again and will be reused." });
    Q.size--;
    r.at("size").snap({ note: "size = " + Q.size + "." });
    r.at("ret").snap({ note: "Return " + v + ". <b>O(1)</b>, with no shifting and no wasted slots." });
  }

  const aqRec = () => D.Rec(() => ({ kind: "aq", a: AQ.a.slice(), n: AQ.n, shifts: AQ.shifts, marks: {} }));
  const cqRec = (kind, Q) => D.Rec(() => ({ kind: kind, a: Q.a.slice(), front: Q.front, size: Q.size, marks: {} }));

  const queue = {
    enqueue(v) { const r = cqRec("cq", CQ); r.code("cq_enqueue").snap({ note: "<b>enqueue(" + v + ")</b> — new elements join at the rear." }); cqEnqueue(CQ, r, v); return r; },
    dequeue() { const r = cqRec("cq", CQ); r.code("cq_dequeue").snap({ note: "<b>dequeue()</b> — the element at the front leaves." }); cqDequeue(CQ, r); return r; },
    first() {
      const r = cqRec("cq", CQ).code("cq_first");
      r.snap({ note: "<b>first()</b>." });
      if (!CQ.size) { r.at("empty").snap({ note: "Empty — return null." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      r.at("ret").snap({ marks: { [CQ.front]: "target" }, note: "Return Q[front] = Q[" + CQ.front + "] = " + CQ.a[CQ.front] + ". Unchanged." });
      return r;
    },
  };

  /* ============================================================
     DEQUE
     ============================================================ */
  const dqRec = () => cqRec("dq", DQ);
  const deque = {
    addFirst(v) {
      const r = dqRec().code("dq_addFirst");
      r.snap({ note: "<b>addFirst(" + v + ")</b> — grow leftwards from the front." });
      if (DQ.size === CAP) { r.at("full").snap({ note: "<b>Full.</b>" }); return r; }
      r.at("full^").snap({ note: "size = " + DQ.size + " &lt; " + CAP + "." });
      const old = DQ.front;
      DQ.front = (DQ.front - 1 + CAP) % CAP;
      r.at("idx").snap({ marks: { [DQ.front]: "cmp" }, pending: true, note: "front ← (" + old + " − 1 + " + CAP + ") mod " + CAP + " = " + DQ.front + (old === 0 ? " — from 0 it wraps to the <b>last</b> slot." : ".") });
      DQ.a[DQ.front] = v;
      r.at("write").snap({ marks: { [DQ.front]: "done" }, note: "D[" + DQ.front + "] ← " + v + "." });
      DQ.size++;
      r.at("size").snap({ marks: { [DQ.front]: "done" }, note: "size = " + DQ.size + ". <b>O(1)</b> at the front, which an ordinary array cannot do." });
      return r;
    },
    addLast(v) {
      const r = dqRec().code("dq_addLast");
      r.snap({ note: "<b>addLast(" + v + ")</b>." });
      if (DQ.size === CAP) { r.at("full").snap({ note: "<b>Full.</b>" }); return r; }
      r.at("full^").snap({ note: "Room available." });
      const at = (DQ.front + DQ.size) % CAP;
      r.at("idx").snap({ marks: { [at]: "cmp" }, note: "avail = (" + DQ.front + " + " + DQ.size + ") mod " + CAP + " = " + at + "." });
      DQ.a[at] = v;
      r.at("write").snap({ marks: { [at]: "done" }, note: "D[" + at + "] ← " + v + "." });
      DQ.size++;
      r.at("size").snap({ marks: { [at]: "done" }, note: "size = " + DQ.size + ". <b>O(1)</b>." });
      return r;
    },
    removeFirst() {
      const r = dqRec().code("dq_removeFirst");
      r.snap({ note: "<b>removeFirst()</b>." });
      if (!DQ.size) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      const at = DQ.front, v = DQ.a[at];
      DQ.a[at] = null;
      r.at("save").snap({ marks: { [at]: "target" }, note: "x = D[" + at + "] = " + v + "." });
      DQ.front = (DQ.front + 1) % CAP;
      r.at("adv").snap({ note: "front ← " + DQ.front + "." });
      DQ.size--;
      r.at("size").snap({ note: "size = " + DQ.size + "." });
      r.at("ret").snap({ note: "Return " + v + ". <b>O(1)</b>." });
      return r;
    },
    removeLast() {
      const r = dqRec().code("dq_removeLast");
      r.snap({ note: "<b>removeLast()</b>." });
      if (!DQ.size) { r.at("empty").snap({ note: "Empty." }); return r; }
      r.at("empty^").snap({ note: "Not empty." });
      const at = (DQ.front + DQ.size - 1) % CAP, v = DQ.a[at];
      r.at("idx").snap({ marks: { [at]: "cmp" }, note: "back = (" + DQ.front + " + " + DQ.size + " − 1) mod " + CAP + " = " + at + "." });
      DQ.a[at] = null;
      r.at("save").snap({ marks: { [at]: "target" }, note: "x = D[" + at + "] = " + v + "." });
      DQ.size--;
      r.at("size").snap({ note: "size = " + DQ.size + ". front did not move." });
      r.at("ret").snap({ note: "Return " + v + ". <b>O(1)</b>. A singly linked list could not do this in O(1)." });
      return r;
    },
  };

  /* ============================================================
     COMPARISON: plain array queue vs circular queue
     ============================================================ */
  const clRec = () => D.Rec(() => CL.mode === "shift"
    ? { kind: "aq", a: CL.a.slice(), n: CL.n, shifts: CL.shifts, marks: {} }
    : { kind: "dr", a: CL.a.slice(), front: CL.front, rear: CL.rear, n: CL.n, marks: {} });
  const crRec = () => cqRec("cq", CR);
  function cmpOp(kind, v) {
    const L = clRec(), R = crRec();
    const title = kind === "enq" ? "enqueue(" + v + ")" : "dequeue()";
    L.snap({ note: title }); R.snap({ note: title });
    if (kind === "enq") { CL.mode === "shift" ? aqEnqueue(CL, L, v) : drEnqueue(CL, L, v); cqEnqueue(CR, R, v); }
    else { CL.mode === "shift" ? aqDequeue(CL, L) : drDequeue(CL, L); cqDequeue(CR, R); }
    /* the first frames carry no listing yet — give them the op's listing */
    [L, R].forEach((r) => { const k = r.frames.find((f) => f.code); r.frames.forEach((f) => { if (!f.code && k) f.code = k.code; }); });
    return D.zip(L.frames, R.frames, "<b>" + title + "</b> on both queues. Each side runs its own code at its own pace; a side that finishes early waits with a ✓.");
  }
  function cmpRun(ops) {
    let all = [];
    ops.forEach((o) => { all = all.concat(cmpOp(o[0], o[1])); });
    player.load(all, true);
  }
  function cmpReset() {
    CL.a = fresh(); CL.n = 0; CL.front = 0; CL.rear = 0; CL.shifts = 0;
    CR.a = fresh(); CR.front = 0; CR.size = 0;
  }
  function cmpStill(note) {
    const L = clRec(), R = crRec();
    L.snap({ note: "" }); R.snap({ note: "" });
    player.load(D.zip(L.frames, R.frames, note), false);
  }

  /* ============================================================
     APPLICATIONS
     ============================================================ */
  const PAIRS = { ")": "(", "]": "[", "}": "{" };
  function brackets(str) {
    const st = [];
    const r = D.Rec(() => ({ kind: "brackets", toks: str.split(""), stack: st.slice(), marks: {} })).code("brackets");
    r.at("init").snap({ i: -1, note: "Start with an empty stack. Openers get pushed; a closer must match whatever is on top." });
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      r.at("loop").snap({ i: i, note: "Read '" + c + "' (character " + (i + 1) + " of " + str.length + ")." });
      if ("([{".indexOf(c) >= 0) {
        st.push(c);
        r.at("push").snap({ i: i, marks: { [st.length - 1]: "done" }, note: "<b>" + c + "</b> is an opener: push it. The stack holds what is still open, innermost on top." });
      } else if (PAIRS[c]) {
        r.at(["push^", "closer"]).snap({ i: i, note: "<b>" + c + "</b> is not an opener — it is a closer." });
        if (!st.length) { r.at("emptyfail").snap({ i: i, ok: false, note: "The stack is <b>empty</b>: there is nothing open for " + c + " to close. <b>Not balanced.</b>" }); return r; }
        const top = st[st.length - 1];
        r.at(["emptyfail^", "match"]).snap({ i: i, marks: { [st.length - 1]: "cmp" }, note: "The stack is not empty. Pop the top, <b>" + top + "</b>: it must be <b>" + PAIRS[c] + "</b> to match." });
        if (top !== PAIRS[c]) { r.at(["match", "mismatch"]).snap({ i: i, ok: false, marks: { [st.length - 1]: "swap" }, note: "Mismatch: <b>" + top + "</b> cannot be closed by <b>" + c + "</b>. <b>Not balanced.</b>" }); return r; }
        st.pop();
        r.at("match").snap({ i: i, note: "They match. " + (st.length ? "Still open: " + st.join(" ") + "." : "The stack is empty again.") });
      } else {
        r.at(["push^", "closer^"]).snap({ i: i, note: "'" + c + "' is neither an opener nor a closer, so it is ignored." });
      }
    }
    if (st.length) r.at("end").snap({ i: str.length, ok: false, marks: { [st.length - 1]: "swap" }, note: "End of input, but <b>" + st.join(" ") + "</b> was never closed. <b>Not balanced.</b>" });
    else r.at("end").snap({ i: str.length, ok: true, note: "End of input with an empty stack: <b>balanced.</b> ✓" });
    return r;
  }
  /* "3 4+", "3,4,+" and "3 4 ×" all work; "-3" is a negative number, a lone "-" is subtraction */
  function postfixTokens(src) {
    const out = [];
    String(src).replace(/[×✕]/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").split(/[\s,;]+/).forEach((chunk) => {
      const m = chunk.match(/^-?\d+(?:\.\d+)?|\d+(?:\.\d+)?|[+\-*\/%^]|[^\d+\-*\/%^]+/g);
      if (m) m.forEach((t) => out.push(t));
    });
    return out;
  }
  function postfix(src) {
    const toks = postfixTokens(src), st = [];
    const r = D.Rec(() => ({ kind: "postfix", toks: toks, stack: st.slice(), marks: {} })).code("postfix");
    r.at("init").snap({ i: -1, note: "Postfix (reverse Polish) needs no parentheses and no precedence rules. A stack is enough." });
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      r.at("loop").snap({ i: i, note: "Token <b>" + t + "</b>." });
      if (/^-?\d+(\.\d+)?$/.test(t)) {
        st.push(parseFloat(t));
        r.at("push").snap({ i: i, marks: { [st.length - 1]: "done" }, note: t + " is a number: push it." });
      } else if (t.length === 1 && "+-*/%^".indexOf(t) >= 0) {
        r.at(["push^", "op"]).snap({ i: i, note: t + " is not a number, so it is an operator." });
        if (st.length < 2) { r.at("pop").snap({ i: i, bad: true, note: "It needs two operands but the stack holds " + st.length + ". <b>Malformed expression.</b>" }); return r; }
        const b = st.pop(), a = st.pop();
        r.at("pop").snap({ i: i, note: "Pop <b>b = " + b + "</b>, then <b>a = " + a + "</b>. The order matters for − and ÷." });
        if (t === "/" && b === 0) { r.at("apply").snap({ i: i, bad: true, note: "Division by zero." }); return r; }
        let v = t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : t === "/" ? a / b : t === "%" ? a % b : Math.pow(a, b);
        v = Math.round(v * 1000) / 1000;
        st.push(v);
        r.at("apply").snap({ i: i, marks: { [st.length - 1]: "swap" }, note: "Push " + a + " " + t + " " + b + " = <b>" + v + "</b>." });
      } else { r.at(["push^", "op"]).snap({ i: i, bad: true, note: "'" + t + "' is not a number, so the code treats it as an operator — but it is not one of + − × ÷ % ^. <b>Malformed expression.</b>" }); return r; }
    }
    if (st.length === 1) r.at("end").snap({ i: toks.length, marks: { 0: "done" }, note: "Input used up and exactly one value remains: <b>" + st[0] + "</b>. ✓" });
    else r.at("end").snap({ i: toks.length, bad: true, note: "Input used up but " + st.length + " values remain — <b>malformed expression</b>." });
    return r;
  }

  /* ============================================================
     RENDERING
     ============================================================ */
  const range = (a, b, cls) => { const m = {}; for (let i = a; i <= b; i++) m[i] = cls; return m; };

  function render(f) {
    if (f.L) return renderCompare(f);
    const stage = q("stage");
    stage.innerHTML = "";
    stage.appendChild(view(f));
    D.stats("#stats", statsOf(f));
  }

  function view(f) {
    const box = D.el("div");
    if (f.kind === "stack") {
      const row = D.el("div", { style: "display:flex;gap:2rem;flex-wrap:wrap;align-items:flex-end" });
      row.appendChild(D.cells(f.a, { marks: f.marks, live: (v, i) => i <= f.t && v != null, ptrs: f.t >= 0 ? { [f.t]: "t (top)" } : {}, roomBelow: true, label: "data[] — the array implementation (capacity " + CAP + ")" }));
      row.appendChild(vertical(f.a.slice(0, f.t + 1), f.marks, "the same stack, drawn upright"));
      box.appendChild(row);
    } else if (f.kind === "aq") {
      box.appendChild(D.cells(f.a, { marks: f.marks, live: (v) => v != null, ptrs: Object.assign({ 0: "front" }, f.n < CAP ? { [f.n]: "n" } : {}), roomBelow: true, label: "data[] — the front is always index 0" }));
    } else if (f.kind === "dr") {
      const p = {};
      if (f.front < CAP) p[f.front] = "front";
      if (f.rear < CAP) p[f.rear] = (p[f.rear] ? p[f.rear] + "/" : "") + "rear";
      box.appendChild(D.cells(f.a, { marks: f.marks, live: (v, i) => i >= f.front && v != null, ghost: (i) => i < f.front, ptrs: p, roomBelow: true, label: "data[] — slots left of front are dead" }));
    } else if (f.kind === "cq" || f.kind === "dq") {
      const live = liveSet(f);
      const p = {};
      p[f.front] = "front";
      if (f.size) { const rear = rearOf(f); p[rear] = (p[rear] ? p[rear] + "/" : "") + "rear"; }
      const row = D.el("div", { style: "display:flex;gap:1.6rem;flex-wrap:wrap;align-items:center" });
      const left = D.el("div");
      left.appendChild(D.cells(f.a, { marks: f.marks, live: (v, i) => live.has(i), ptrs: p, roomBelow: true, label: "data[] — capacity " + CAP + ", indices wrap with mod " + CAP }));
      const order = logicalOrder(f);
      left.appendChild(D.cells(order, { index: false, w: 40, h: 32, label: "logical order, front first", marks: order.length ? { 0: "target" } : {} }));
      row.appendChild(left);
      row.appendChild(ring(f, live));
      box.appendChild(row);
    } else if (f.kind === "brackets" || f.kind === "postfix") {
      box.appendChild(D.cells(f.toks, {
        index: false, w: 34, h: 36, label: "input",
        marks: f.i >= 0 && f.i < f.toks.length ? { [f.i]: f.ok === false || f.bad ? "swap" : "active" } : {},
        ghost: (i) => i < f.i,
      }));
      box.appendChild(vertical(f.stack, f.marks, f.kind === "brackets" ? "stack of open brackets" : "operand stack"));
    }
    return box;
  }
  /* Where the stored elements start. Mid-addFirst, front has already stepped back to the slot
     about to be written, so for one frame the data still begins one slot later. */
  const dataFront = (f) => (f.pending ? (f.front + 1) % CAP : f.front);
  const rearOf = (f) => (f.size ? (dataFront(f) + f.size - 1) % CAP : null);
  /* every removal clears its slot, so a slot is live exactly when it holds a value — this stays
     true mid-operation (a value written before size++ shows up, a slot cleared before front moves does not) */
  function liveSet(f) {
    const s = new Set();
    f.a.forEach((v, i) => { if (v != null) s.add(i); });
    return s;
  }
  function logicalOrder(f) {
    const out = [], lf = dataFront(f), span = Math.min(f.size + 1, CAP);
    for (let k = 0; k < span; k++) { const v = f.a[(lf + k) % CAP]; if (v != null) out.push(v); }
    return out;
  }

  function vertical(items, marks, label) {
    const box = D.el("div");
    box.appendChild(D.el("div", { class: "cells-cap", text: label }));
    const col = D.el("div", { style: "display:flex;flex-direction:column-reverse;gap:4px;min-height:40px" });
    items.forEach((v, i) => {
      const c = D.el("div", { class: "cell " + (v == null ? "empty " : "filled ") + (marks[i] || ""), text: v == null ? "·" : v, style: "min-width:96px;height:32px" });
      if (i === items.length - 1) c.appendChild(D.el("span", { class: "ptr", style: "left:auto;right:-3.1rem;bottom:auto;top:50%;transform:translateY(-50%)", text: "← top" }));
      col.appendChild(c);
    });
    if (!items.length) col.appendChild(D.el("div", { class: "small muted", text: "(empty)" }));
    box.appendChild(col);
    box.style.paddingRight = "3.4rem";
    return box;
  }

  /* the circular array drawn as an actual ring */
  function ring(f, live) {
    const W = 230, cx = W / 2, cy = W / 2, R = 78;
    const svg = D.svg("svg", { class: "canvas", viewBox: "0 0 " + W + " " + W, width: W, height: W, style: "margin:0" });
    svg.appendChild(D.svg("circle", { cx: cx, cy: cy, r: R, fill: "none", stroke: "#27324f", "stroke-width": 2, "stroke-dasharray": "3 5" }));
    const rear = rearOf(f);
    for (let i = 0; i < CAP; i++) {
      const a = -Math.PI / 2 + (i / CAP) * Math.PI * 2;
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const on = live.has(i);
      svg.appendChild(D.svg("circle", { cx: x, cy: y, r: 19, class: "node-c " + (f.marks[i] || (on ? "visit" : "")), opacity: on || f.marks[i] ? 1 : 0.5 }));
      svg.appendChild(D.sText(x, y, on ? f.a[i] : "", { "font-size": 12 }));
      const lx = cx + (R + 33) * Math.cos(a), ly = cy + (R + 33) * Math.sin(a);
      svg.appendChild(D.sText(lx, ly, i, { class: "lbl-s", "font-size": 10 }));
      if (i === f.front) svg.appendChild(D.sText(cx + (R - 36) * Math.cos(a), cy + (R - 36) * Math.sin(a), "F", { fill: "#22d3ee", "font-size": 12 }));
      if (i === rear) svg.appendChild(D.sText(cx + (R - 36) * Math.cos(a) + (i === f.front ? 12 : 0), cy + (R - 36) * Math.sin(a), "R", { fill: "#ffc14d", "font-size": 12 }));
    }
    svg.appendChild(D.sText(cx, cy - 6, "size " + f.size, { class: "lbl-s", "font-size": 11 }));
    svg.appendChild(D.sText(cx, cy + 10, "F front · R rear", { class: "lbl-s", "font-size": 9 }));
    return svg;
  }

  function statsOf(f) {
    if (f.kind === "stack") return [["size", f.t + 1], ["t (top index)", f.t], ["capacity", CAP]];
    if (f.kind === "aq") return [["size n", f.n], ["capacity", CAP], ["element shifts so far", f.shifts]];
    if (f.kind === "dr") return [["size", f.n], ["front", f.front], ["rear", f.rear], ["dead slots", f.front], ["usable slots left", CAP - f.rear]];
    if (f.kind === "cq" || f.kind === "dq") return [["size", f.size], ["capacity", CAP], ["front", f.front], ["rear", f.size ? rearOf(f) : "–"], ["next free", (dataFront(f) + f.size) % CAP]];
    if (f.kind === "brackets") return [["scanned", Math.max(0, Math.min(f.i + 1, f.toks.length)) + " / " + f.toks.length], ["stack depth", f.stack.length], ["verdict", f.ok == null ? "…" : f.ok ? "balanced" : "not balanced"]];
    if (f.kind === "postfix") return [["token", Math.max(0, Math.min(f.i + 1, f.toks.length)) + " / " + f.toks.length], ["stack depth", f.stack.length]];
    return [];
  }

  function renderCompare(f) {
    [["L", f.L, dockL, f.done[0]], ["R", f.R, dockR, f.done[1]]].forEach((s) => {
      const side = s[0], fr = s[1];
      s[2].sync(fr);
      const st = q(side + "-stage");
      st.innerHTML = "";
      st.appendChild(view(fr));
      q(side + "-note").innerHTML = fr.note || "";
      D.stats("#" + side + "-stats", statsOf(fr).slice(0, 3));
      q("pane-" + side).classList.toggle("finished", !!s[3] && player.index > 0);
    });
    q("L-title").textContent = CL.mode === "shift" ? "Plain array — front pinned at 0" : "Plain array — front moves, no wrap";
    q("L-tag").textContent = CL.mode === "shift" ? "dequeue shifts everything" : "freed slots are lost";
  }

  /* ============================================================
     TABS / EXAMPLES / INIT
     ============================================================ */
  const NOTES = {
    stack: "A <b>stack</b> is LIFO. The array implementation keeps one index, <span class='mono'>t</span>, pointing at the top element (−1 when empty). push, pop and top all touch only <span class='mono'>data[t]</span>, so each is O(1). Nothing ever shifts, because the bottom of the stack never moves.",
    aqueue: "The obvious array queue keeps the front at index 0. Enqueue writes at the end in O(1), but <b>every dequeue has to slide the remaining n − 1 elements forward</b>, which makes dequeue O(n). Watch the <span class='mono'>element shifts</span> counter.",
    cqueue: "A <b>circular array queue</b> never shifts. It keeps <span class='mono'>front</span> and <span class='mono'>size</span>, and computes the rear as <span class='mono'>(front + size) mod N</span>. When an index runs off the end it wraps to 0, so the array behaves like the ring on the right. Enqueue and dequeue are both O(1).",
    deque: "A <b>deque</b> (double-ended queue) is the same circular array, used at both ends. addFirst steps front <em>backwards</em> with <span class='mono'>(front − 1 + N) mod N</span>. Adding N keeps the result non-negative, since in Java and C++ −1 % N is −1. This is how Java's <span class='mono'>ArrayDeque</span> works.",
    compare: "Both queues get exactly the same operations. The left one is a plain array: either every dequeue shifts, or the front drifts right and the freed slots are wasted. The right one is circular. Try <b>steady traffic</b> and watch the shift counter on the left climb. Then switch the left queue to “front moves, no wrap” and see it report full while it still has empty slots.",
    app: "Two classic stack applications. Both work because a stack captures <em>nesting</em>: the most recently opened thing is the first one that has to be resolved.",
  };
  const EXAMPLES = {
    stack: [
      { label: "push 3, pop 1 (LIFO)", run: () => { S.a = fresh(); S.t = -1; chain([() => stack.push(10), () => stack.push(20), () => stack.push(30), stack.pop]); } },
      { label: "overflow", desc: "Push onto a full stack", run: () => { S.a = fresh(); S.t = -1; for (let i = 1; i <= CAP; i++) { S.a[++S.t] = i * 11; } load(stack.push(99)); } },
      { label: "underflow", desc: "Pop an empty stack", run: () => { S.a = fresh(); S.t = -1; load(stack.pop()); } },
    ],
    aqueue: [
      { label: "dequeue a full queue", desc: "7 shifts for one dequeue", run: () => { AQ.a = fresh(); AQ.n = 0; AQ.shifts = 0; [5, 10, 15, 20, 25, 30, 35, 40].forEach((v, i) => (AQ.a[i] = v)); AQ.n = 8; loadQ(aqRec, (r) => aqDequeue(AQ, r)); } },
      { label: "enqueue 3, dequeue 3", run: () => { AQ.a = fresh(); AQ.n = 0; AQ.shifts = 0; chain([10, 20, 30].map((v) => () => opQ(aqRec, (r) => aqEnqueue(AQ, r, v))).concat([0, 1, 2].map(() => () => opQ(aqRec, (r) => aqDequeue(AQ, r))))); } },
    ],
    cqueue: [
      { label: "watch it wrap", desc: "Fill, drain 3, fill again", run: () => {
        CQ.a = fresh(); CQ.front = 0; CQ.size = 0;
        chain([11, 22, 33, 44, 55].map((v) => () => queue.enqueue(v)).concat([0, 1, 2].map(() => queue.dequeue)).concat([66, 77, 88, 99].map((v) => () => queue.enqueue(v))));
      } },
      { label: "full vs empty", desc: "front == next free in both cases", run: () => { CQ.a = fresh(); CQ.front = 3; CQ.size = 0; chain([1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => () => queue.enqueue(v * 10))); } },
    ],
    deque: [
      { label: "addFirst from index 0", desc: "front wraps to the last slot", run: () => { DQ.a = fresh(); DQ.front = 0; DQ.size = 0; chain([() => deque.addLast(1), () => deque.addFirst(2), () => deque.addFirst(3)]); } },
      { label: "palindrome check", desc: "Load 1 2 3 4 3 2 1, then remove from both ends in turn: 1 & 1, 2 & 2, 3 & 3 all match", run: () => {
        DQ.a = fresh(); DQ.front = 0; DQ.size = 0;
        const w = [1, 2, 3, 4, 3, 2, 1];
        chain(w.map((v) => () => deque.addLast(v)).concat([deque.removeFirst, deque.removeLast, deque.removeFirst, deque.removeLast, deque.removeFirst, deque.removeLast]));
      } },
    ],
    compare: [
      { label: "steady traffic", desc: "Enqueue 4 items, then 6 rounds of dequeue + enqueue", run: () => { cmpReset(); const ops = [["enq", 1], ["enq", 2], ["enq", 3], ["enq", 4]]; for (let i = 0; i < 6; i++) ops.push(["deq"], ["enq", 10 + i]); cmpRun(ops); } },
      { label: "fill, drain 3, refill", desc: "The plain array runs out of room at the end", run: () => { cmpReset(); cmpRun([["enq", 11], ["enq", 22], ["enq", 33], ["enq", 44], ["enq", 55], ["deq"], ["deq"], ["deq"], ["enq", 66], ["enq", 77], ["enq", 88], ["enq", 99]]); } },
    ],
    app: [
      { label: "{[()()]}", run: () => { q("bstr").value = "{[()()]}"; load(brackets("{[()()]}")); } },
      { label: "([)]", desc: "Crossed brackets", run: () => { q("bstr").value = "([)]"; load(brackets("([)]")); } },
      { label: "((a)", desc: "Left open", run: () => { q("bstr").value = "((a)"; load(brackets("((a)")); } },
      { label: "5 1 2 + 4 * + 3 −", run: () => { q("pstr").value = "5 1 2 + 4 * + 3 -"; load(postfix("5 1 2 + 4 * + 3 -")); } },
      { label: "2 3 4 * +", run: () => { q("pstr").value = "2 3 4 * +"; load(postfix("2 3 4 * +")); } },
    ],
  };
  function opQ(mk, fn) { const r = mk(); fn(r); return r; }
  function loadQ(mk, fn) { load(opQ(mk, fn)); }
  function load(r) { player.load(r.frames, true); }
  function chain(fns) { let all = []; fns.forEach((fn) => { all = all.concat(fn().frames); }); player.load(all, true); }

  function stillTab(note) {
    if (tab === "compare") return cmpStill(note);
    let r;
    if (tab === "stack") r = stRec();
    else if (tab === "aqueue") r = aqRec();
    else if (tab === "cqueue") r = cqRec("cq", CQ);
    else if (tab === "deque") r = dqRec();
    else { r = brackets(q("bstr").value || ""); player.load([Object.assign({}, r.frames[0], { note: note })], false); return; }
    r.snap({ note: note });
    player.load(r.frames, false);
  }

  function selectTab(id) {
    tab = id;
    D.showFor(id);
    D.practiceShow(id);
    q("notes").innerHTML = "<p class='blurb'>" + NOTES[id] + "</p>";
    D.Examples("#examples", EXAMPLES[id]);
    dock.show({ stack: "st_push", aqueue: "aq_dequeue", cqueue: "cq_enqueue", deque: "dq_addFirst", app: "brackets", compare: "st_push" }[id]);
    stillTab({
      stack: "An array-backed stack holding " + (S.t + 1) + " element(s).",
      aqueue: "A plain array queue with the front pinned at index 0.",
      cqueue: "A circular array queue holding " + CQ.size + " element(s).",
      deque: "A circular array deque holding " + DQ.size + " element(s).",
      compare: "Two queues, the same operations. Press an example or the buttons above.",
      app: "Type an expression, or pick an example.",
    }[id]);
  }

  /* LeetCode practice for each part (numbers, titles and difficulties checked against LeetCode) */
  const PRACTICE = {
   "stack": {
    "label": "Stack",
    "items": [
     [
      155,
      "Min Stack",
      "min-stack",
      "Medium",
      "push, pop, top and getMin all in O(1)."
     ],
     [
      225,
      "Implement Stack using Queues",
      "implement-stack-using-queues",
      "Easy",
      "Rebuild LIFO out of FIFO."
     ],
     [
      1047,
      "Remove All Adjacent Duplicates In String",
      "remove-all-adjacent-duplicates-in-string",
      "Easy",
      "The stack remembers what is still open."
     ],
     [
      739,
      "Daily Temperatures",
      "daily-temperatures",
      "Medium",
      "A monotonic stack."
     ]
    ]
   },
   "aqueue": {
    "label": "Queue (plain array)",
    "items": [
     [
      232,
      "Implement Queue using Stacks",
      "implement-queue-using-stacks",
      "Easy",
      "Amortised O(1) without shifting."
     ],
     [
      933,
      "Number of Recent Calls",
      "number-of-recent-calls",
      "Easy",
      "Enqueue at the back, drop old calls from the front."
     ],
     [
      1700,
      "Number of Students Unable to Eat Lunch",
      "number-of-students-unable-to-eat-lunch",
      "Easy",
      "Simulate a queue."
     ]
    ]
   },
   "cqueue": {
    "label": "Queue (circular array)",
    "items": [
     [
      622,
      "Design Circular Queue",
      "design-circular-queue",
      "Medium",
      "This exact tab: front, size and mod capacity."
     ],
     [
      933,
      "Number of Recent Calls",
      "number-of-recent-calls",
      "Easy",
      "A sliding window is a queue."
     ],
     [
      2073,
      "Time Needed to Buy Tickets",
      "time-needed-to-buy-tickets",
      "Easy",
      "People rejoin at the back: a queue that cycles round."
     ]
    ]
   },
   "deque": {
    "label": "Deque",
    "items": [
     [
      641,
      "Design Circular Deque",
      "design-circular-deque",
      "Medium",
      "This exact tab: add and remove at both ends in O(1)."
     ],
     [
      239,
      "Sliding Window Maximum",
      "sliding-window-maximum",
      "Hard",
      "The classic monotonic-deque problem."
     ],
     [
      125,
      "Valid Palindrome",
      "valid-palindrome",
      "Easy",
      "Compare both ends and move inwards, like the palindrome example."
     ]
    ]
   },
   "compare": {
    "label": "Plain vs circular queue",
    "items": [
     [
      622,
      "Design Circular Queue",
      "design-circular-queue",
      "Medium",
      "Build the right-hand side of this comparison yourself."
     ],
     [
      641,
      "Design Circular Deque",
      "design-circular-deque",
      "Medium",
      "The same wrap-around, at both ends."
     ]
    ]
   },
   "app": {
    "label": "Stack applications",
    "items": [
     [
      20,
      "Valid Parentheses",
      "valid-parentheses",
      "Easy",
      "The bracket checker on this tab."
     ],
     [
      150,
      "Evaluate Reverse Polish Notation",
      "evaluate-reverse-polish-notation",
      "Medium",
      "The postfix evaluator on this tab."
     ],
     [
      1021,
      "Remove Outermost Parentheses",
      "remove-outermost-parentheses",
      "Easy",
      "Track nesting depth."
     ],
     [
      224,
      "Basic Calculator",
      "basic-calculator",
      "Hard",
      "Infix with parentheses, using a stack."
     ]
    ]
   }
  };

  document.addEventListener("DOMContentLoaded", function () {
    D.Practice(PRACTICE);
    dock = D.CodeDock("#code", CODE, { recv: (k) => (/^st_/.test(k) ? "stack" : /^dq_/.test(k) ? "deque" : "queue") });
    dockL = D.CodeDock("#L-code", CODE, { recv: (k) => (/^st_/.test(k) ? "stack" : /^dq_/.test(k) ? "deque" : "queue"), initial: "aq_dequeue", collapsible: false });
    dockR = D.CodeDock("#R-code", CODE, { recv: (k) => (/^st_/.test(k) ? "stack" : /^dq_/.test(k) ? "deque" : "queue"), initial: "cq_dequeue", collapsible: false });
    player = new D.Player({ mount: "#player", render: render, code: dock });
    const val = () => { const v = parseInt(q("val").value, 10); return isNaN(v) ? D.randInt(10, 99) : v; };

    q("s-push").onclick = () => load(stack.push(val()));
    q("s-pop").onclick = () => load(stack.pop());
    q("s-peek").onclick = () => load(stack.top());
    q("s-clear").onclick = () => { S.a = fresh(); S.t = -1; stillTab("Cleared: t = −1."); };

    q("a-enq").onclick = () => { const v = val(); const r = aqRec(); r.code("aq_enqueue").snap({ note: "<b>enqueue(" + v + ")</b>." }); aqEnqueue(AQ, r, v); load(r); };
    q("a-deq").onclick = () => { const r = aqRec(); r.code("aq_dequeue").snap({ note: "<b>dequeue()</b>." }); aqDequeue(AQ, r); load(r); };
    q("a-clear").onclick = () => { AQ.a = fresh(); AQ.n = 0; AQ.shifts = 0; stillTab("Cleared."); };

    q("q-enq").onclick = () => load(queue.enqueue(val()));
    q("q-deq").onclick = () => load(queue.dequeue());
    q("q-peek").onclick = () => load(queue.first());
    q("q-clear").onclick = () => { CQ.a = fresh(); CQ.front = 0; CQ.size = 0; stillTab("Cleared."); };

    q("k-af").onclick = () => load(deque.addFirst(val()));
    q("k-al").onclick = () => load(deque.addLast(val()));
    q("k-rf").onclick = () => load(deque.removeFirst());
    q("k-rl").onclick = () => load(deque.removeLast());
    q("k-clear").onclick = () => { DQ.a = fresh(); DQ.front = 0; DQ.size = 0; stillTab("Cleared."); };

    q("c-enq").onclick = () => player.load(cmpOp("enq", val()), true);
    q("c-deq").onclick = () => player.load(cmpOp("deq"), true);
    q("c-left").onchange = (e) => { CL.mode = e.target.value; cmpReset(); dockL.show(CL.mode === "shift" ? "aq_dequeue" : "dr_enqueue"); cmpStill("Left queue is now “" + e.target.selectedOptions[0].text + "”. Both queues were reset."); };
    q("c-clear").onclick = () => { cmpReset(); cmpStill("Both queues reset."); };

    q("ap-brackets").onclick = () => { const s = q("bstr").value.trim(); if (!s) return D.toast("Type an expression first.", true); load(brackets(s)); };
    q("ap-postfix").onclick = () => { const s = q("pstr").value.trim(); if (!s) return D.toast("Type a postfix expression first.", true); load(postfix(s)); };

    D.legend("#legend", [
      { color: "var(--c-active)", label: "current" },
      { color: "var(--c-cmp)", label: "index being computed / compared" },
      { color: "var(--c-swap)", label: "shifting / removed / error" },
      { color: "var(--c-done)", label: "written" },
      { color: "var(--c-target)", label: "value returned" },
    ]);

    /* seed */
    [12, 45, 7].forEach((v) => (S.a[++S.t] = v));
    [5, 9, 14].forEach((v, i) => (AQ.a[i] = v)); AQ.n = 3;
    CQ.front = 5; [5, 9, 14, 21].forEach((v, k) => (CQ.a[(5 + k) % CAP] = v)); CQ.size = 4;
    [8, 3].forEach((v, k) => (DQ.a[k] = v)); DQ.size = 2;

    D.Tabs("#tabs", [
      { id: "stack", label: "Stack (array)" },
      { id: "aqueue", label: "Queue (plain array)" },
      { id: "cqueue", label: "Queue (circular array)" },
      { id: "deque", label: "Deque (circular array)" },
      { id: "compare", label: "Why circular? plain vs circular" },
      { id: "app", label: "Applications" },
    ], selectTab);
  });
})();
