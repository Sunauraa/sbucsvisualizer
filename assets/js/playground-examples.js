/* ============================================================
   playground-examples.js: starter programs for the Code playground.
   Each module lists its own; `tabs` picks the one to open on, from
   the tab the student is looking at. They are all real Java: the test
   suite compiles each one with javac and checks that the playground
   prints exactly what the JVM prints.
   ============================================================ */
(function () {
  "use strict";
  const sortProgram = (body, call, data) => `import java.util.Arrays;

public class Main {
${body}
  public static void main(String[] args) {
    int[] data = {${data || "5, 2, 9, 1, 7"}};
    ${call};
    System.out.println(Arrays.toString(data));
  }
}
`;

  window.DSA.PLAYGROUND_EXAMPLES = {
    arrays: [
      { name: "fixed array: insert", tabs: /Fixed/, code: `import java.util.Arrays;

public class Main {
  static int insert(int[] a, int n, int i, int x) {
    if (n == a.length) throw new IllegalStateException("full");
    for (int k = n - 1; k >= i; k--) {
      a[k + 1] = a[k];
    }
    a[i] = x;
    return n + 1;
  }

  public static void main(String[] args) {
    int[] a = new int[6];
    int n = 0;
    n = insert(a, n, 0, 10);
    n = insert(a, n, 1, 30);
    n = insert(a, n, 1, 20);
    System.out.println(Arrays.toString(a) + " n=" + n);
  }
}
` },
      { name: "dynamic array: doubling", tabs: /Dynamic/, code: `class DynamicArray {
  int[] a = new int[1];
  int n = 0;

  void add(int x) {
    if (n == a.length) {
      resize(2 * a.length);
    }
    a[n] = x;
    n++;
  }

  void resize(int newCap) {
    int[] b = new int[newCap];
    for (int k = 0; k < n; k++) {
      b[k] = a[k];
    }
    a = b;
  }
}

public class Main {
  public static void main(String[] args) {
    DynamicArray list = new DynamicArray();
    for (int i = 1; i <= 5; i++) {
      list.add(i * 10);
      System.out.println("size " + list.n + ", capacity " + list.a.length);
    }
  }
}
` },
      { name: "2-D array: row sums", tabs: /2-D/, code: `public class Main {
  static int rowSum(int[][] m, int r) {
    int s = 0;
    for (int c = 0; c < m[r].length; c++) {
      s += m[r][c];
    }
    return s;
  }

  public static void main(String[] args) {
    int[][] grid = {{1, 2, 3}, {4, 5, 6}};
    for (int r = 0; r < grid.length; r++) {
      System.out.println("row " + r + ": " + rowSum(grid, r));
    }
  }
}
` },
      { name: "singly linked list: reverse", tabs: /Singly/, code: `class Node {
  int data;
  Node next;

  Node(int data) {
    this.data = data;
  }
}

public class Main {
  static Node addFirst(Node head, int x) {
    Node node = new Node(x);
    node.next = head;
    return node;
  }

  static Node reverse(Node head) {
    Node prev = null;
    Node cur = head;
    while (cur != null) {
      Node next = cur.next;
      cur.next = prev;
      prev = cur;
      cur = next;
    }
    return prev;
  }

  public static void main(String[] args) {
    Node head = null;
    for (int v : new int[] {3, 2, 1}) {
      head = addFirst(head, v);
    }
    head = reverse(head);
    for (Node c = head; c != null; c = c.next) {
      System.out.print(c.data + " ");
    }
  }
}
` },
      { name: "doubly linked list: remove last", tabs: /Doubly/, code: `class Node {
  int data;
  Node prev, next;

  Node(int data) {
    this.data = data;
  }
}

class DoublyList {
  Node head, tail;

  void addLast(int x) {
    Node node = new Node(x);
    node.prev = tail;
    if (tail != null) {
      tail.next = node;
    } else {
      head = node;
    }
    tail = node;
  }

  int removeLast() {
    int x = tail.data;
    tail = tail.prev;
    if (tail == null) {
      head = null;
    } else {
      tail.next = null;
    }
    return x;
  }
}

public class Main {
  public static void main(String[] args) {
    DoublyList list = new DoublyList();
    list.addLast(1);
    list.addLast(2);
    list.addLast(3);
    System.out.println(list.removeLast());
    System.out.println(list.tail.data);
  }
}
` },
      { name: "circular list: rotate", tabs: /Circular/, code: `class Node {
  int data;
  Node next;

  Node(int data) {
    this.data = data;
  }
}

class CircularList {
  Node tail;

  void addFirst(int x) {
    Node node = new Node(x);
    if (tail == null) {
      tail = node;
      node.next = node;
    } else {
      node.next = tail.next;
      tail.next = node;
    }
  }

  void rotate() {
    if (tail != null) {
      tail = tail.next;
    }
  }
}

public class Main {
  public static void main(String[] args) {
    CircularList ring = new CircularList();
    ring.addFirst(3);
    ring.addFirst(2);
    ring.addFirst(1);
    ring.rotate();
    System.out.println("first is now " + ring.tail.next.data);
  }
}
` },
    ],

    recursion: [
      { name: "factorial", tabs: /factorial/, code: `public class Main {
  static long factorial(int n) {
    if (n <= 1) {
      return 1;
    }
    return n * factorial(n - 1);
  }

  public static void main(String[] args) {
    System.out.println(factorial(5));
  }
}
` },
      { name: "fibonacci: naive", tabs: /naive/, code: `public class Main {
  static int fib(int n) {
    if (n <= 1) {
      return n;
    }
    return fib(n - 1) + fib(n - 2);
  }

  public static void main(String[] args) {
    System.out.println(fib(5));
  }
}
` },
      { name: "fibonacci: memoised", tabs: /memo/, code: `import java.util.*;

public class Main {
  static long fib(int n, Map<Integer, Long> memo) {
    if (memo.containsKey(n)) {
      return memo.get(n);
    }
    if (n <= 1) {
      return n;
    }
    long v = fib(n - 1, memo) + fib(n - 2, memo);
    memo.put(n, v);
    return v;
  }

  public static void main(String[] args) {
    System.out.println(fib(8, new HashMap<>()));
  }
}
` },
      { name: "gcd: Euclid", tabs: /gcd/, code: `public class Main {
  static int gcd(int a, int b) {
    if (b == 0) {
      return a;
    }
    return gcd(b, a % b);
  }

  public static void main(String[] args) {
    System.out.println(gcd(84, 30));
  }
}
` },
      { name: "power: fast", tabs: /power/, code: `public class Main {
  static double power(double x, int n) {
    if (n < 0) {
      return 1 / power(x, -n);
    }
    if (n == 0) {
      return 1;
    }
    double half = power(x, n / 2);
    double r = half * half;
    if (n % 2 == 1) {
      r *= x;
    }
    return r;
  }

  public static void main(String[] args) {
    System.out.println(power(2, 10));
    System.out.println(power(2, -2));
  }
}
` },
      { name: "towers of Hanoi", tabs: /Hanoi/, code: `public class Main {
  static void hanoi(int n, char from, char to, char via) {
    if (n == 0) {
      return;
    }
    hanoi(n - 1, from, via, to);
    System.out.println(from + " -> " + to);
    hanoi(n - 1, via, to, from);
  }

  public static void main(String[] args) {
    hanoi(3, 'A', 'C', 'B');
  }
}
` },
      { name: "binary search", tabs: /binarySearch/, code: `public class Main {
  static int search(int[] a, int target, int lo, int hi) {
    if (lo > hi) {
      return -1;
    }
    int mid = (lo + hi) / 2;
    if (a[mid] == target) {
      return mid;
    }
    if (target < a[mid]) {
      return search(a, target, lo, mid - 1);
    }
    return search(a, target, mid + 1, hi);
  }

  public static void main(String[] args) {
    int[] data = {2, 5, 8, 12, 16, 23, 38};
    System.out.println(search(data, 23, 0, data.length - 1));
    System.out.println(search(data, 7, 0, data.length - 1));
  }
}
` },
      { name: "permutations", tabs: /permutations/, code: `public class Main {
  static void permute(String chosen, String rest) {
    if (rest.isEmpty()) {
      System.out.println(chosen);
      return;
    }
    for (int i = 0; i < rest.length(); i++) {
      permute(chosen + rest.charAt(i), rest.substring(0, i) + rest.substring(i + 1));
    }
  }

  public static void main(String[] args) {
    permute("", "abc");
  }
}
` },
    ],

    "stacks-queues": [
      { name: "array stack", tabs: /^Stack/, code: `class ArrayStack {
  int[] data = new int[4];
  int t = -1;

  void push(int x) {
    if (t == data.length - 1) throw new IllegalStateException("full");
    t++;
    data[t] = x;
  }

  int pop() {
    if (t == -1) throw new RuntimeException("empty");
    int x = data[t];
    t--;
    return x;
  }
}

public class Main {
  public static void main(String[] args) {
    ArrayStack stack = new ArrayStack();
    stack.push(1);
    stack.push(2);
    stack.push(3);
    System.out.println(stack.pop());
    System.out.println(stack.pop());
  }
}
` },
      { name: "queue: plain array", tabs: /plain array/, code: `class ArrayQueue {
  int[] data = new int[4];
  int n = 0;

  void enqueue(int x) {
    data[n] = x;
    n++;
  }

  int dequeue() {
    int x = data[0];
    for (int k = 1; k < n; k++) {
      data[k - 1] = data[k];
    }
    n--;
    return x;
  }
}

public class Main {
  public static void main(String[] args) {
    ArrayQueue queue = new ArrayQueue();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    System.out.println(queue.dequeue());
    System.out.println(queue.dequeue());
  }
}
` },
      { name: "queue: circular array", tabs: /circular/, code: `class CircularQueue {
  int[] data = new int[4];
  int front = 0, size = 0;

  void enqueue(int x) {
    if (size == data.length) throw new IllegalStateException("full");
    int avail = (front + size) % data.length;
    data[avail] = x;
    size++;
  }

  int dequeue() {
    int x = data[front];
    front = (front + 1) % data.length;
    size--;
    return x;
  }
}

public class Main {
  public static void main(String[] args) {
    CircularQueue queue = new CircularQueue();
    for (int i = 1; i <= 4; i++) {
      queue.enqueue(i);
    }
    System.out.println(queue.dequeue());
    queue.enqueue(5);
    System.out.println("front " + queue.front + ", size " + queue.size);
  }
}
` },
      { name: "deque: circular array", tabs: /Deque/, code: `class ArrayDequeDemo {
  int[] data = new int[4];
  int front = 0, size = 0;

  void addFirst(int x) {
    front = (front - 1 + data.length) % data.length;
    data[front] = x;
    size++;
  }

  void addLast(int x) {
    int avail = (front + size) % data.length;
    data[avail] = x;
    size++;
  }

  int removeLast() {
    int back = (front + size - 1) % data.length;
    size--;
    return data[back];
  }
}

public class Main {
  public static void main(String[] args) {
    ArrayDequeDemo deque = new ArrayDequeDemo();
    deque.addLast(2);
    deque.addFirst(1);
    deque.addLast(3);
    System.out.println(deque.removeLast());
    System.out.println("front is at " + deque.front);
  }
}
` },
      { name: "bracket checker", tabs: /Applications/, code: `import java.util.*;

public class Main {
  static boolean isBalanced(String s) {
    Deque<Character> st = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
      if ("([{".indexOf(c) >= 0) {
        st.push(c);
      } else if (")]}".indexOf(c) >= 0) {
        if (st.isEmpty()) {
          return false;
        }
        if ("([{".indexOf(st.pop()) != ")]}".indexOf(c)) {
          return false;
        }
      }
    }
    return st.isEmpty();
  }

  public static void main(String[] args) {
    System.out.println(isBalanced("{[()]}"));
    System.out.println(isBalanced("(]"));
  }
}
` },
      { name: "postfix evaluator", code: `import java.util.*;

public class Main {
  static double eval(String[] tokens) {
    Deque<Double> st = new ArrayDeque<>();
    for (String t : tokens) {
      if (t.equals("+") || t.equals("-") || t.equals("*") || t.equals("/")) {
        double b = st.pop();
        double a = st.pop();
        if (t.equals("+")) st.push(a + b);
        else if (t.equals("-")) st.push(a - b);
        else if (t.equals("*")) st.push(a * b);
        else st.push(a / b);
      } else {
        st.push(Double.parseDouble(t));
      }
    }
    return st.pop();
  }

  public static void main(String[] args) {
    System.out.println(eval(new String[] {"3", "4", "+", "2", "*"}));
  }
}
` },
    ],

    trees: [
      { name: "traversals", tabs: /Traversals/, code: `class Node {
  int key;
  Node left, right;

  Node(int key) {
    this.key = key;
  }
}

public class Main {
  static void inorder(Node n) {
    if (n == null) return;
    inorder(n.left);
    System.out.print(n.key + " ");
    inorder(n.right);
  }

  static void preorder(Node n) {
    if (n == null) return;
    System.out.print(n.key + " ");
    preorder(n.left);
    preorder(n.right);
  }

  public static void main(String[] args) {
    Node root = new Node(50);
    root.left = new Node(25);
    root.right = new Node(75);
    root.left.right = new Node(37);
    inorder(root);
    System.out.println();
    preorder(root);
    System.out.println();
  }
}
` },
      { name: "BST: insert and search", tabs: /Binary Search/, code: `class Node {
  int key;
  Node left, right;

  Node(int key) {
    this.key = key;
  }
}

public class Main {
  static Node insert(Node n, int k) {
    if (n == null) {
      return new Node(k);
    }
    if (k < n.key) {
      n.left = insert(n.left, k);
    } else if (k > n.key) {
      n.right = insert(n.right, k);
    }
    return n;
  }

  static boolean search(Node n, int k) {
    while (n != null) {
      if (k == n.key) {
        return true;
      }
      n = (k < n.key) ? n.left : n.right;
    }
    return false;
  }

  public static void main(String[] args) {
    Node root = null;
    for (int k : new int[] {50, 30, 70, 20, 40}) {
      root = insert(root, k);
    }
    System.out.println(search(root, 40));
    System.out.println(search(root, 45));
  }
}
` },
      { name: "BST: delete", code: `class Node {
  int key;
  Node left, right;

  Node(int key) {
    this.key = key;
  }
}

public class Main {
  static Node insert(Node n, int k) {
    if (n == null) return new Node(k);
    if (k < n.key) n.left = insert(n.left, k);
    else if (k > n.key) n.right = insert(n.right, k);
    return n;
  }

  static Node delete(Node n, int k) {
    if (n == null) return null;
    if (k < n.key) {
      n.left = delete(n.left, k);
    } else if (k > n.key) {
      n.right = delete(n.right, k);
    } else {
      if (n.left == null) return n.right;
      if (n.right == null) return n.left;
      Node s = n.right;
      while (s.left != null) s = s.left;
      n.key = s.key;
      n.right = delete(n.right, s.key);
    }
    return n;
  }

  static void inorder(Node n) {
    if (n == null) return;
    inorder(n.left);
    System.out.print(n.key + " ");
    inorder(n.right);
  }

  public static void main(String[] args) {
    Node root = null;
    for (int k : new int[] {50, 30, 70, 60, 80}) {
      root = insert(root, k);
    }
    root = delete(root, 70);
    inorder(root);
  }
}
` },
      { name: "AVL: rotations", tabs: /AVL/, code: `class Node {
  int key, height = 1;
  Node left, right;

  Node(int key) {
    this.key = key;
  }
}

public class Main {
  static int h(Node n) {
    return n == null ? 0 : n.height;
  }

  static void update(Node n) {
    n.height = 1 + Math.max(h(n.left), h(n.right));
  }

  static Node rotateRight(Node y) {
    Node x = y.left;
    y.left = x.right;
    x.right = y;
    update(y);
    update(x);
    return x;
  }

  static Node rotateLeft(Node x) {
    Node y = x.right;
    x.right = y.left;
    y.left = x;
    update(x);
    update(y);
    return y;
  }

  static Node insert(Node n, int k) {
    if (n == null) return new Node(k);
    if (k < n.key) n.left = insert(n.left, k);
    else n.right = insert(n.right, k);
    update(n);
    int b = h(n.left) - h(n.right);
    if (b > 1) {
      if (k > n.left.key) n.left = rotateLeft(n.left);
      return rotateRight(n);
    }
    if (b < -1) {
      if (k < n.right.key) n.right = rotateRight(n.right);
      return rotateLeft(n);
    }
    return n;
  }

  public static void main(String[] args) {
    Node root = null;
    for (int k : new int[] {10, 20, 30, 25}) {
      root = insert(root, k);
    }
    System.out.println("root " + root.key + ", height " + root.height);
  }
}
` },
      { name: "multi-way tree: search", tabs: /Tree$/, code: `class BNode {
  int[] keys;
  BNode[] kids;

  BNode(int[] keys, BNode[] kids) {
    this.keys = keys;
    this.kids = kids;
  }
}

public class Main {
  static boolean search(BNode n, int k) {
    while (n != null) {
      int i = 0;
      while (i < n.keys.length && k > n.keys[i]) {
        i++;
      }
      if (i < n.keys.length && k == n.keys[i]) {
        return true;
      }
      n = n.kids == null ? null : n.kids[i];
    }
    return false;
  }

  public static void main(String[] args) {
    BNode a = new BNode(new int[] {5, 8}, null);
    BNode b = new BNode(new int[] {20}, null);
    BNode root = new BNode(new int[] {10}, new BNode[] {a, b});
    System.out.println(search(root, 8));
    System.out.println(search(root, 15));
  }
}
` },
    ],

    "priority-queues": [
      { name: "unsorted list", tabs: /Unsorted/, code: `import java.util.*;

public class Main {
  static int removeMin(List<Integer> list) {
    int b = 0;
    for (int i = 1; i < list.size(); i++) {
      if (list.get(i) < list.get(b)) {
        b = i;
      }
    }
    return list.remove(b);
  }

  public static void main(String[] args) {
    List<Integer> pq = new ArrayList<>();
    pq.add(42);
    pq.add(17);
    pq.add(58);
    System.out.println(removeMin(pq));
    System.out.println(pq);
  }
}
` },
      { name: "sorted list", tabs: /Sorted/, code: `import java.util.*;

public class Main {
  static void insert(List<Integer> list, int k) {
    int i = list.size();
    while (i > 0 && list.get(i - 1) > k) {
      i--;
    }
    list.add(i, k);
  }

  public static void main(String[] args) {
    List<Integer> pq = new ArrayList<>();
    insert(pq, 42);
    insert(pq, 17);
    insert(pq, 58);
    System.out.println(pq);
    System.out.println("min " + pq.get(0));
  }
}
` },
      { name: "array heap", tabs: /Array-based/, code: `import java.util.Arrays;

class MinHeap {
  int[] h = new int[8];
  int n = 0;

  void insert(int k) {
    h[n] = k;
    int j = n;
    n++;
    while (j > 0) {
      int p = (j - 1) / 2;
      if (h[j] >= h[p]) break;
      int t = h[j];
      h[j] = h[p];
      h[p] = t;
      j = p;
    }
  }

  int removeMin() {
    int min = h[0];
    n--;
    h[0] = h[n];
    int j = 0;
    while (2 * j + 1 < n) {
      int c = 2 * j + 1;
      if (c + 1 < n && h[c + 1] < h[c]) c++;
      if (h[c] >= h[j]) break;
      int t = h[j];
      h[j] = h[c];
      h[c] = t;
      j = c;
    }
    return min;
  }
}

public class Main {
  public static void main(String[] args) {
    MinHeap heap = new MinHeap();
    for (int k : new int[] {9, 4, 7, 1}) {
      heap.insert(k);
    }
    System.out.println(heap.removeMin());
    System.out.println(heap.removeMin());
    System.out.println(Arrays.toString(Arrays.copyOf(heap.h, heap.n)));
  }
}
` },
      { name: "tree heap: find a position", tabs: /Tree-based/, code: `class Node {
  int key;
  Node left, right;

  Node(int key) {
    this.key = key;
  }
}

public class Main {
  /* position 1 is the root; the bits after the leading 1 are the turns: 0 left, 1 right */
  static Node nodeAt(Node root, int pos) {
    Node cur = root;
    int bit = Integer.highestOneBit(pos) >> 1;
    while (bit > 0) {
      cur = (pos & bit) == 0 ? cur.left : cur.right;
      bit = bit >> 1;
    }
    return cur;
  }

  public static void main(String[] args) {
    Node root = new Node(1);
    root.left = new Node(3);
    root.right = new Node(2);
    root.left.left = new Node(7);
    root.left.right = new Node(4);
    System.out.println(nodeAt(root, 5).key);
  }
}
` },
      { name: "PQ-sort", tabs: /PQ-Sort/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    int[] data = {5, 2, 9, 1};
    PriorityQueue<Integer> pq = new PriorityQueue<>();
    for (int x : data) {
      pq.add(x);
    }
    for (int i = 0; i < data.length; i++) {
      data[i] = pq.poll();
    }
    System.out.println(Arrays.toString(data));
  }
}
` },
    ],

    hashtables: [
      { name: "separate chaining", tabs: /chaining/, code: `class Node {
  int key;
  Node next;

  Node(int key, Node next) {
    this.key = key;
    this.next = next;
  }
}

public class Main {
  static Node[] table = new Node[5];

  static void put(int k) {
    int b = Math.floorMod(k, table.length);
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key == k) return;
    }
    table[b] = new Node(k, table[b]);
  }

  static boolean get(int k) {
    int b = Math.floorMod(k, table.length);
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key == k) return true;
    }
    return false;
  }

  public static void main(String[] args) {
    put(7);
    put(12);
    put(3);
    System.out.println(get(12));
    System.out.println(get(8));
  }
}
` },
      { name: "linear probing", tabs: /Linear/, code: `import java.util.Arrays;

public class Main {
  static final int EMPTY = -1;
  static int[] table = new int[7];

  static void put(int k) {
    for (int i = 0; i < table.length; i++) {
      int j = (k + i) % table.length;
      if (table[j] == EMPTY) {
        table[j] = k;
        return;
      }
      if (table[j] == k) return;
    }
    throw new IllegalStateException("no free slot");
  }

  public static void main(String[] args) {
    Arrays.fill(table, EMPTY);
    put(10);
    put(17);
    put(24);
    System.out.println(Arrays.toString(table));
  }
}
` },
      { name: "quadratic probing", tabs: /Quadratic/, code: `import java.util.Arrays;

public class Main {
  static final int EMPTY = -1;
  static int[] table = new int[7];

  static void put(int k) {
    for (int i = 0; i < table.length; i++) {
      int j = (k + i * i) % table.length;
      if (table[j] == EMPTY) {
        table[j] = k;
        return;
      }
      if (table[j] == k) return;
    }
    throw new IllegalStateException("no free slot");
  }

  public static void main(String[] args) {
    Arrays.fill(table, EMPTY);
    put(10);
    put(17);
    put(24);
    System.out.println(Arrays.toString(table));
  }
}
` },
      { name: "String hash", code: `public class Main {
  static int hash(String s) {
    int h = 0;
    for (int i = 0; i < s.length(); i++) {
      h = 31 * h + s.charAt(i);
    }
    return h;
  }

  public static void main(String[] args) {
    System.out.println(hash("abc"));
    System.out.println("abc".hashCode());
  }
}
` },
    ],

    graphs: [
      { name: "BFS: shortest distances", code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    int[][] adj = {{1, 2}, {0, 3}, {0, 3}, {1, 2, 4}, {3}};
    int[] dist = new int[adj.length];
    boolean[] seen = new boolean[adj.length];

    Queue<Integer> q = new LinkedList<>();
    seen[0] = true;
    q.add(0);
    while (!q.isEmpty()) {
      int u = q.poll();
      for (int v : adj[u]) {
        if (!seen[v]) {
          seen[v] = true;
          dist[v] = dist[u] + 1;
          q.add(v);
        }
      }
    }
    System.out.println(Arrays.toString(dist));
  }
}
` },
      { name: "DFS: discovery order", code: `public class Main {
  static int[][] adj = {{1, 2}, {0, 3}, {0}, {1}};
  static boolean[] seen = new boolean[4];

  static void dfs(int u) {
    seen[u] = true;
    System.out.print(u + " ");
    for (int v : adj[u]) {
      if (!seen[v]) {
        dfs(v);
      }
    }
  }

  public static void main(String[] args) {
    dfs(0);
  }
}
` },
      { name: "DFS forest: components", code: `public class Main {
  static int[][] adj = {{1}, {0}, {3}, {2}, {}};
  static boolean[] seen = new boolean[5];

  static void dfs(int u) {
    seen[u] = true;
    for (int v : adj[u]) {
      if (!seen[v]) {
        dfs(v);
      }
    }
  }

  public static void main(String[] args) {
    int components = 0;
    for (int u = 0; u < adj.length; u++) {
      if (!seen[u]) {
        components++;
        dfs(u);
      }
    }
    System.out.println(components + " components");
  }
}
` },
    ],

    sorting: [
      { name: "bubble sort", tabs: /Bubble/, code: sortProgram(`  static void bubbleSort(int[] a) {
    for (int i = a.length - 1; i >= 1; i--) {
      boolean swapped = false;
      for (int j = 0; j < i; j++) {
        if (a[j] > a[j + 1]) {
          int t = a[j];
          a[j] = a[j + 1];
          a[j + 1] = t;
          swapped = true;
        }
      }
      if (!swapped) break;
    }
  }
`, "bubbleSort(data)") },
      { name: "selection sort", tabs: /Selection/, code: sortProgram(`  static void selectionSort(int[] a) {
    for (int i = 0; i < a.length - 1; i++) {
      int min = i;
      for (int j = i + 1; j < a.length; j++) {
        if (a[j] < a[min]) {
          min = j;
        }
      }
      if (min != i) {
        int t = a[i];
        a[i] = a[min];
        a[min] = t;
      }
    }
  }
`, "selectionSort(data)") },
      { name: "insertion sort", tabs: /Insertion/, code: sortProgram(`  static void insertionSort(int[] a) {
    for (int i = 1; i < a.length; i++) {
      int key = a[i];
      int j = i - 1;
      while (j >= 0 && a[j] > key) {
        a[j + 1] = a[j];
        j--;
      }
      a[j + 1] = key;
    }
  }
`, "insertionSort(data)") },
      { name: "heap sort", tabs: /Heap/, code: sortProgram(`  static void downHeap(int[] a, int i, int size) {
    while (2 * i + 1 < size) {
      int c = 2 * i + 1;
      if (c + 1 < size && a[c + 1] > a[c]) c++;
      if (a[i] >= a[c]) break;
      int t = a[i];
      a[i] = a[c];
      a[c] = t;
      i = c;
    }
  }

  static void heapSort(int[] a) {
    for (int i = a.length / 2 - 1; i >= 0; i--) {
      downHeap(a, i, a.length);
    }
    for (int end = a.length - 1; end >= 1; end--) {
      int t = a[0];
      a[0] = a[end];
      a[end] = t;
      downHeap(a, 0, end);
    }
  }
`, "heapSort(data)") },
      { name: "merge sort", tabs: /Merge/, code: sortProgram(`  static void mergeSort(int[] a, int lo, int hi) {
    if (lo >= hi) return;
    int mid = (lo + hi) / 2;
    mergeSort(a, lo, mid);
    mergeSort(a, mid + 1, hi);
    int[] L = Arrays.copyOfRange(a, lo, mid + 1);
    int[] R = Arrays.copyOfRange(a, mid + 1, hi + 1);
    int i = 0, j = 0, k = lo;
    while (i < L.length && j < R.length) {
      a[k++] = (L[i] <= R[j]) ? L[i++] : R[j++];
    }
    while (i < L.length) a[k++] = L[i++];
    while (j < R.length) a[k++] = R[j++];
  }
`, "mergeSort(data, 0, data.length - 1)") },
      { name: "quick sort", tabs: /Quick/, code: sortProgram(`  static int partition(int[] a, int lo, int hi) {
    int pivot = a[hi];
    int i = lo;
    for (int j = lo; j < hi; j++) {
      if (a[j] < pivot) {
        int t = a[i];
        a[i] = a[j];
        a[j] = t;
        i++;
      }
    }
    int t = a[i];
    a[i] = a[hi];
    a[hi] = t;
    return i;
  }

  static void quickSort(int[] a, int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(a, lo, hi);
    quickSort(a, lo, p - 1);
    quickSort(a, p + 1, hi);
  }
`, "quickSort(data, 0, data.length - 1)") },
      { name: "two-third sort", tabs: /Two-Third/, code: sortProgram(`  static void twoThirdSort(int[] a, int i, int j) {
    if (a[i] > a[j]) {
      int tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    if (j - i + 1 > 2) {
      int t = (j - i + 1) / 3;
      twoThirdSort(a, i, j - t);
      twoThirdSort(a, i + t, j);
      twoThirdSort(a, i, j - t);
    }
  }
`, "twoThirdSort(data, 0, data.length - 1)", "4, 1, 3, 2") },
      { name: "counting sort", tabs: /Counting/, code: sortProgram(`  static void countingSort(int[] a) {
    int lo = a[0], hi = a[0];
    for (int x : a) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    int[] C = new int[hi - lo + 1];
    int[] B = new int[a.length];
    for (int x : a) {
      C[x - lo]++;
    }
    for (int v = 1; v < C.length; v++) {
      C[v] += C[v - 1];
    }
    for (int idx = a.length - 1; idx >= 0; idx--) {
      int c = a[idx] - lo;
      C[c]--;
      B[C[c]] = a[idx];
    }
    System.arraycopy(B, 0, a, 0, a.length);
  }
`, "countingSort(data)", "3, 1, 2, 3, 0, 1") },
    ],
  };
})();
