/* ============================================================
   playground-examples.js: starter programs for the Code playground.
   Each module lists its own; `tabs` picks the one to open on, from
   the tab the student is looking at.

   Each program holds every function its tab shows. main comes first and
   calls each one on a line of its own, so it reads as a short menu of
   what the structure can do. They are all real Java: the test suite
   compiles each one with javac and checks that the playground prints
   exactly what the JVM prints.
   ============================================================ */
(function () {
  "use strict";
  const sortProgram = (body, call, data) => `import java.util.Arrays;

public class Main {
  public static void main(String[] args) {
    int[] data = {${data || "5, 2, 9, 1, 7"}};
    ${call};
    System.out.println(Arrays.toString(data));
  }

${body}}
`;

  /* linear and quadratic probing differ in one expression */
  const probingProgram = (cls, probe) => `import java.util.*;

public class Main {
  public static void main(String[] args) {
    ${cls} t = new ${cls}(7);
    t.put(10);
    t.put(17);
    t.put(24);
    t.remove(17);
    System.out.println("get(24) = " + t.get(24));
    t.put(31);
    System.out.println(Arrays.toString(t.table));
    t.rehash();
    System.out.println(Arrays.toString(t.table));
  }
}

class ${cls} {
  static final int EMPTY = -1;
  static final int DELETED = -2;   // a tombstone
  int[] table;
  int m;
  int n = 0;

  ${cls}(int m) {
    this.m = m;
    table = newTable(m);
  }

  void put(int k) {
    int tomb = -1;
    for (int i = 0; i < m; i++) {
      int j = Math.floorMod(hash(k) + ${probe}, m);
      if (table[j] == EMPTY) {
        table[tomb >= 0 ? tomb : j] = k;
        n++;
        return;
      }
      if (table[j] == DELETED) {
        if (tomb < 0) tomb = j;
      } else if (table[j] == k) {
        return;
      }
    }
    if (tomb < 0) throw new IllegalStateException("no free slot");
    table[tomb] = k;
    n++;
  }

  boolean get(int k) {
    for (int i = 0; i < m; i++) {
      int j = Math.floorMod(hash(k) + ${probe}, m);
      if (table[j] == EMPTY) return false;
      if (table[j] == k) return true;
    }
    return false;
  }

  void remove(int k) {
    for (int i = 0; i < m; i++) {
      int j = Math.floorMod(hash(k) + ${probe}, m);
      if (table[j] == EMPTY) return;
      if (table[j] == k) {
        table[j] = DELETED;
        n--;
        return;
      }
    }
  }

  void rehash() {
    int[] old = table;
    m = nextPrime(2 * m + 1);
    table = newTable(m);
    n = 0;
    for (int k : keysOf(old)) {
      put(k);
    }
  }

  int[] newTable(int size) {
    int[] t = new int[size];
    Arrays.fill(t, EMPTY);
    return t;
  }

  List<Integer> keysOf(int[] old) {
    List<Integer> keys = new ArrayList<>();
    for (int x : old) {
      if (x != EMPTY && x != DELETED) keys.add(x);
    }
    return keys;
  }

  static int nextPrime(int x) {
    while (!isPrime(x)) x++;
    return x;
  }

  static boolean isPrime(int x) {
    if (x < 2) return false;
    for (int d = 2; d * d <= x; d++) {
      if (x % d == 0) return false;
    }
    return true;
  }

  static int hash(int k) {
    return k;
  }
}
`;

  window.DSA.PLAYGROUND_EXAMPLES = {
    arrays: [
      { name: "fixed array", tabs: /Fixed/, code: `public class Main {
  public static void main(String[] args) {
    FixedArray list = new FixedArray(6);
    list.add(10);
    list.add(30);
    list.insert(1, 20);
    list.set(2, 35);
    System.out.println("get(1) = " + list.get(1));
    System.out.println("indexOf(35) = " + list.indexOf(35));
    System.out.println("remove(0) = " + list.remove(0));
  }
}

class FixedArray {
  int[] a;
  int n = 0;

  FixedArray(int capacity) {
    a = new int[capacity];
  }

  void add(int x) {
    if (n == a.length) throw new IllegalStateException("full");
    a[n] = x;
    n++;
  }

  void insert(int i, int x) {
    if (i < 0 || i > n) throw new IndexOutOfBoundsException();
    if (n == a.length) throw new IllegalStateException("full");
    for (int k = n - 1; k >= i; k--) {
      a[k + 1] = a[k];
    }
    a[i] = x;
    n++;
  }

  int remove(int i) {
    if (i < 0 || i >= n) throw new IndexOutOfBoundsException();
    int x = a[i];
    for (int k = i; k < n - 1; k++) {
      a[k] = a[k + 1];
    }
    a[n - 1] = 0;
    n--;
    return x;
  }

  int get(int i) {
    if (i < 0 || i >= n) throw new IndexOutOfBoundsException();
    return a[i];
  }

  void set(int i, int x) {
    if (i < 0 || i >= n) throw new IndexOutOfBoundsException();
    a[i] = x;
  }

  int indexOf(int x) {
    for (int i = 0; i < n; i++) {
      if (a[i] == x) return i;
    }
    return -1;
  }
}
` },
      { name: "dynamic array", tabs: /Dynamic/, code: `public class Main {
  public static void main(String[] args) {
    DynamicArray list = new DynamicArray();
    list.add(10);
    list.add(30);
    list.add(40);
    list.insert(1, 20);
    list.insert(4, 50);
    System.out.println("capacity = " + list.a.length);
    list.set(4, 55);
    System.out.println("get(1) = " + list.get(1));
    System.out.println("indexOf(55) = " + list.indexOf(55));
    System.out.println("remove(0) = " + list.remove(0));
  }
}

class DynamicArray {
  int[] a = new int[2];
  int n = 0;

  void add(int x) {
    if (n == a.length) {
      resize(2 * a.length);   // for arithmetic growth, use a.length + 2
    }
    a[n] = x;
    n++;
  }

  void insert(int i, int x) {
    if (i < 0 || i > n) throw new IndexOutOfBoundsException();
    if (n == a.length) {
      resize(2 * a.length);   // for arithmetic growth, use a.length + 2
    }
    for (int k = n - 1; k >= i; k--) {
      a[k + 1] = a[k];
    }
    a[i] = x;
    n++;
  }

  void resize(int newCap) {
    int[] b = new int[newCap];
    for (int k = 0; k < n; k++) {
      b[k] = a[k];
    }
    a = b;
  }

  int remove(int i) {
    if (i < 0 || i >= n) throw new IndexOutOfBoundsException();
    int x = a[i];
    for (int k = i; k < n - 1; k++) {
      a[k] = a[k + 1];
    }
    a[n - 1] = 0;
    n--;
    return x;
  }

  int get(int i) {
    if (i < 0 || i >= n) throw new IndexOutOfBoundsException();
    return a[i];
  }

  void set(int i, int x) {
    if (i < 0 || i >= n) throw new IndexOutOfBoundsException();
    a[i] = x;
  }

  int indexOf(int x) {
    for (int i = 0; i < n; i++) {
      if (a[i] == x) return i;
    }
    return -1;
  }
}
` },
      { name: "2-D array", tabs: /2-D/, code: `import java.util.Arrays;

public class Main {
  public static void main(String[] args) {
    int[][] grid = {{1, 2, 3}, {4, 5, 6}};
    set(grid, 0, 1, 9);
    System.out.println("get(0, 1) = " + get(grid, 0, 1));
    System.out.println("rowSum(1) = " + rowSum(grid, 1));
    System.out.println("find(6) = " + Arrays.toString(find(grid, 6)));
    traverseRowMajor(grid);
    System.out.println();
    traverseColumnMajor(grid);
    System.out.println();
  }

  static int get(int[][] m, int r, int c) {
    if (r < 0 || r >= m.length || c < 0 || c >= m[r].length) throw new IndexOutOfBoundsException();
    return m[r][c];
  }

  static void set(int[][] m, int r, int c, int x) {
    if (r < 0 || r >= m.length || c < 0 || c >= m[r].length) throw new IndexOutOfBoundsException();
    m[r][c] = x;
  }

  static int rowSum(int[][] m, int r) {
    int s = 0;
    for (int c = 0; c < m[r].length; c++) {
      s += m[r][c];
    }
    return s;
  }

  static int[] find(int[][] m, int x) {
    for (int r = 0; r < m.length; r++) {
      for (int c = 0; c < m[r].length; c++) {
        if (m[r][c] == x) return new int[] {r, c};
      }
    }
    return new int[] {-1, -1};
  }

  static void traverseRowMajor(int[][] m) {
    for (int r = 0; r < m.length; r++) {
      for (int c = 0; c < m[r].length; c++) {
        visit(m[r][c]);
      }
    }
  }

  static void traverseColumnMajor(int[][] m) {
    for (int c = 0; c < m[0].length; c++) {
      for (int r = 0; r < m.length; r++) {
        visit(m[r][c]);
      }
    }
  }

  static void visit(int x) {
    System.out.print(x + " ");
  }
}
` },
      { name: "singly linked list", tabs: /Singly/, code: `public class Main {
  public static void main(String[] args) {
    SinglyLinkedList list = new SinglyLinkedList();
    list.addFirst(20);
    list.addFirst(10);
    list.addLast(40);
    list.insert(2, 30);
    list.addLast(50);
    System.out.println("indexOf(30) = " + list.indexOf(30));
    list.reverse();
    System.out.println("removeFirst() = " + list.removeFirst());
    System.out.println("removeLast() = " + list.removeLast());
    System.out.println("remove(1) = " + list.remove(1));
  }
}

class Node {
  int data;
  Node next;

  Node(int data) {
    this.data = data;
  }
}

class SinglyLinkedList {
  Node head, tail;
  int size = 0;

  void addFirst(int x) {
    Node node = new Node(x);
    node.next = head;
    head = node;
    if (tail == null) tail = node;
    size++;
  }

  void addLast(int x) {
    Node node = new Node(x);
    if (head == null) head = node;
    else tail.next = node;
    tail = node;
    size++;
  }

  void insert(int i, int x) {
    if (i < 1 || i > size) throw new IndexOutOfBoundsException();
    Node prev = head;
    for (int k = 1; k < i; k++) prev = prev.next;
    Node node = new Node(x);
    node.next = prev.next;
    prev.next = node;
    if (node.next == null) tail = node;
    size++;
  }

  int removeFirst() {
    if (head == null) throw new RuntimeException("empty");
    int x = head.data;
    head = head.next;
    if (head == null) tail = null;
    size--;
    return x;
  }

  int removeLast() {
    if (head == tail) return removeFirst();
    Node prev = head;
    while (prev.next != tail) prev = prev.next;
    int x = tail.data;
    prev.next = null;
    tail = prev;
    size--;
    return x;
  }

  int remove(int i) {
    if (i < 1 || i >= size) throw new IndexOutOfBoundsException();
    Node prev = head;
    for (int k = 1; k < i; k++) prev = prev.next;
    Node cur = prev.next;
    prev.next = cur.next;
    if (cur == tail) tail = prev;
    size--;
    return cur.data;
  }

  int indexOf(int x) {
    int i = 0;
    for (Node cur = head; cur != null; cur = cur.next) {
      if (cur.data == x) return i;
      i++;
    }
    return -1;
  }

  void reverse() {
    Node prev = null, cur = head;
    tail = head;
    while (cur != null) {
      Node next = cur.next;
      cur.next = prev;
      prev = cur;
      cur = next;
    }
    head = prev;
  }
}
` },
      { name: "doubly linked list", tabs: /Doubly/, code: `public class Main {
  public static void main(String[] args) {
    DoublyLinkedList list = new DoublyLinkedList();
    list.addFirst(20);
    list.addFirst(10);
    list.addLast(40);
    list.insert(2, 30);
    list.addLast(50);
    System.out.println("indexOf(30) = " + list.indexOf(30));
    list.printBackward();
    System.out.println("removeFirst() = " + list.removeFirst());
    System.out.println("removeLast() = " + list.removeLast());
    System.out.println("remove(1) = " + list.remove(1));
  }
}

class Node {
  int data;
  Node next, prev;

  Node(int data) {
    this.data = data;
  }
}

class DoublyLinkedList {
  Node head, tail;
  int size = 0;

  void addFirst(int x) {
    Node node = new Node(x);
    node.next = head;
    if (head != null) head.prev = node;
    else tail = node;
    head = node;
    size++;
  }

  void addLast(int x) {
    Node node = new Node(x);
    node.prev = tail;
    if (tail != null) tail.next = node;
    else head = node;
    tail = node;
    size++;
  }

  void insert(int i, int x) {
    if (i < 1 || i >= size) throw new IndexOutOfBoundsException();
    Node cur = head;
    for (int k = 1; k <= i; k++) cur = cur.next;
    Node node = new Node(x);
    node.prev = cur.prev;
    node.next = cur;
    cur.prev.next = node;
    cur.prev = node;
    size++;
  }

  int removeFirst() {
    if (head == null) throw new RuntimeException("empty");
    int x = head.data;
    head = head.next;
    if (head == null) tail = null;
    else head.prev = null;
    size--;
    return x;
  }

  int removeLast() {
    if (tail == null) throw new RuntimeException("empty");
    int x = tail.data;
    tail = tail.prev;
    if (tail == null) head = null;
    else tail.next = null;
    size--;
    return x;
  }

  int remove(int i) {
    if (i < 1 || i >= size - 1) throw new IndexOutOfBoundsException();
    Node cur = head;
    for (int k = 1; k <= i; k++) cur = cur.next;
    cur.prev.next = cur.next;
    cur.next.prev = cur.prev;
    size--;
    return cur.data;
  }

  int indexOf(int x) {
    int i = 0;
    for (Node cur = head; cur != null; cur = cur.next) {
      if (cur.data == x) return i;
      i++;
    }
    return -1;
  }

  void printBackward() {
    for (Node cur = tail; cur != null; cur = cur.prev) {
      visit(cur.data);
    }
    System.out.println();
  }

  static void visit(int x) {
    System.out.print(x + " ");
  }
}
` },
      { name: "circular list", tabs: /Circular/, code: `public class Main {
  public static void main(String[] args) {
    CircularList ring = new CircularList();
    ring.addFirst(20);
    ring.addFirst(10);
    ring.addLast(30);
    System.out.println("indexOf(30) = " + ring.indexOf(30));
    ring.rotate();
    System.out.println("first is now " + ring.tail.next.data);
    System.out.println("removeFirst() = " + ring.removeFirst());
  }
}

class Node {
  int data;
  Node next;

  Node(int data) {
    this.data = data;
  }
}

class CircularList {
  Node tail;   // tail.next is the head
  int size = 0;

  void addFirst(int x) {
    Node node = new Node(x);
    if (tail == null) {
      tail = node;
      node.next = node;
    } else {
      node.next = tail.next;
      tail.next = node;
    }
    size++;
  }

  void addLast(int x) {
    addFirst(x);
    tail = tail.next;
  }

  int removeFirst() {
    if (tail == null) throw new RuntimeException("empty");
    Node head = tail.next;
    if (head == tail) tail = null;
    else tail.next = head.next;
    size--;
    return head.data;
  }

  void rotate() {
    if (tail != null) {
      tail = tail.next;
    }
  }

  int indexOf(int x) {
    if (tail == null) return -1;
    Node cur = tail.next;
    int i = 0;
    do {
      if (cur.data == x) return i;
      cur = cur.next;
      i++;
    } while (cur != tail.next);
    return -1;
  }
}
` },
    ],

    recursion: [
      { name: "factorial", tabs: /factorial/, code: `public class Main {
  public static void main(String[] args) {
    System.out.println(factorial(5));
    System.out.println(factorialIter(5));
  }

  static long factorial(int n) {
    if (n <= 1) {
      return 1;
    }
    return n * factorial(n - 1);
  }

  static long factorialIter(int n) {
    long result = 1;
    for (int i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }
}
` },
      { name: "fibonacci: naive", tabs: /naive/, code: `public class Main {
  public static void main(String[] args) {
    System.out.println(fib(5));
    System.out.println(fibIter(5));
  }

  static int fib(int n) {
    if (n <= 1) {
      return n;
    }
    return fib(n - 1) + fib(n - 2);
  }

  static int fibIter(int n) {
    if (n <= 1) {
      return n;
    }
    int a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
      int t = a + b;
      a = b;
      b = t;
    }
    return b;
  }
}
` },
      { name: "fibonacci: memoised", tabs: /memo/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    System.out.println(fib(8, new HashMap<>()));
    System.out.println(fibTable(8));
  }

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

  static long fibTable(int n) {
    if (n <= 1) {
      return n;
    }
    long[] t = new long[n + 1];
    t[1] = 1;
    for (int i = 2; i <= n; i++) {
      t[i] = t[i - 1] + t[i - 2];
    }
    return t[n];
  }
}
` },
      { name: "gcd: Euclid", tabs: /gcd/, code: `public class Main {
  public static void main(String[] args) {
    System.out.println(gcd(84, 30));
    System.out.println(gcdIter(84, 30));
  }

  static int gcd(int a, int b) {
    if (b == 0) {
      return a;
    }
    return gcd(b, a % b);
  }

  static int gcdIter(int a, int b) {
    while (b != 0) {
      int r = a % b;
      a = b;
      b = r;
    }
    return a;
  }
}
` },
      { name: "power: fast", tabs: /power/, code: `public class Main {
  public static void main(String[] args) {
    System.out.println(power(2, 10));
    System.out.println(power(2, -2));
    System.out.println(powerIter(2, 10));
  }

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

  static double powerIter(double x, int n) {
    if (n < 0) {
      x = 1 / x;
      n = -n;
    }
    double result = 1;
    while (n > 0) {
      if (n % 2 == 1) {
        result *= x;
      }
      x *= x;
      n /= 2;
    }
    return result;
  }
}
` },
      { name: "towers of Hanoi", tabs: /Hanoi/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    hanoi(2, 'A', 'C', 'B');
    hanoiIter(2);
  }

  static void hanoi(int n, char from, char to, char via) {
    if (n == 0) {
      return;
    }
    hanoi(n - 1, from, via, to);
    System.out.println(from + " -> " + to);
    hanoi(n - 1, via, to, from);
  }

  // a task is {k, from, to, via}; k = -1 means "make this move"
  static void hanoiIter(int n) {
    Deque<int[]> st = new ArrayDeque<>();
    st.push(new int[] {n, 'A', 'C', 'B'});
    while (!st.isEmpty()) {
      int[] t = st.pop();
      if (t[0] == -1) {
        move(t[1], t[2]);
      } else if (t[0] > 0) {
        st.push(new int[] {t[0] - 1, t[3], t[2], t[1]});
        st.push(new int[] {-1, t[1], t[2], 0});
        st.push(new int[] {t[0] - 1, t[1], t[3], t[2]});
      }
    }
  }

  static void move(int from, int to) {
    System.out.println((char) from + " -> " + (char) to);
  }
}
` },
      { name: "binary search", tabs: /binarySearch/, code: `public class Main {
  public static void main(String[] args) {
    int[] data = {2, 5, 8, 12, 16, 23, 38};
    System.out.println(binarySearch(data, 23, 0, data.length - 1));
    System.out.println(binarySearch(data, 7, 0, data.length - 1));
    System.out.println(binarySearchIter(data, 23));
  }

  static int binarySearch(int[] a, int target, int lo, int hi) {
    if (lo > hi) {
      return -1;
    }
    int mid = (lo + hi) / 2;
    if (a[mid] == target) {
      return mid;
    }
    if (target < a[mid]) {
      return binarySearch(a, target, lo, mid - 1);
    }
    return binarySearch(a, target, mid + 1, hi);
  }

  static int binarySearchIter(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {
      int mid = (lo + hi) / 2;
      if (a[mid] == target) {
        return mid;
      }
      if (target < a[mid]) {
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return -1;
  }
}
` },
      { name: "permutations", tabs: /permutations/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    permute("", "abc");
    permutationsIter("ab");
  }

  static void permute(String chosen, String rest) {
    if (rest.isEmpty()) {
      System.out.println(chosen);
      return;
    }
    for (int i = 0; i < rest.length(); i++) {
      permute(chosen + rest.charAt(i), rest.substring(0, i) + rest.substring(i + 1));
    }
  }

  static void permutationsIter(String s) {
    Deque<String[]> st = new ArrayDeque<>();
    st.push(new String[] {"", s});
    while (!st.isEmpty()) {
      String[] t = st.pop();
      String chosen = t[0], rest = t[1];
      if (rest.isEmpty()) {
        System.out.println(chosen);
      } else {
        for (int i = rest.length() - 1; i >= 0; i--) {
          st.push(new String[] {chosen + rest.charAt(i), rest.substring(0, i) + rest.substring(i + 1)});
        }
      }
    }
  }
}
` },
    ],

    "stacks-queues": [
      { name: "array stack", tabs: /^Stack/, code: `public class Main {
  public static void main(String[] args) {
    ArrayStack stack = new ArrayStack(4);
    stack.push(1);
    stack.push(2);
    stack.push(3);
    System.out.println("top() = " + stack.top());
    System.out.println("pop() = " + stack.pop());
  }
}

class ArrayStack {
  int[] data;
  int t = -1;   // index of the top; -1 means empty

  ArrayStack(int capacity) {
    data = new int[capacity];
  }

  void push(int x) {
    if (t == data.length - 1) throw new IllegalStateException("full");
    t++;
    data[t] = x;
  }

  int pop() {
    if (t == -1) throw new RuntimeException("empty");
    int x = data[t];
    data[t] = 0;
    t--;
    return x;
  }

  int top() {
    if (t == -1) throw new RuntimeException("empty");
    return data[t];
  }
}
` },
      { name: "queue: plain array", tabs: /plain array/, code: `public class Main {
  public static void main(String[] args) {
    ArrayQueue queue = new ArrayQueue(4);
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    System.out.println("dequeue() = " + queue.dequeue());
  }
}

class ArrayQueue {
  int[] data;   // the front is always data[0]
  int n = 0;

  ArrayQueue(int capacity) {
    data = new int[capacity];
  }

  void enqueue(int x) {
    if (n == data.length) throw new IllegalStateException("full");
    data[n] = x;
    n++;
  }

  int dequeue() {
    if (n == 0) throw new RuntimeException("empty");
    int x = data[0];
    for (int k = 1; k < n; k++) {
      data[k - 1] = data[k];
    }
    n--;
    data[n] = 0;
    return x;
  }
}
` },
      { name: "queue: front moves, no wrap", tabs: /plain vs/, code: `public class Main {
  public static void main(String[] args) {
    DriftingQueue queue = new DriftingQueue(4);
    queue.enqueue(1);
    queue.enqueue(2);
    System.out.println("dequeue() = " + queue.dequeue());
    queue.enqueue(3);
    System.out.println("front " + queue.front + ", rear " + queue.rear);
  }
}

class DriftingQueue {
  int[] data;
  int front = 0;   // index of the front element
  int rear = 0;    // index of the next free slot

  DriftingQueue(int capacity) {
    data = new int[capacity];
  }

  void enqueue(int x) {
    if (rear == data.length) throw new IllegalStateException("full");
    data[rear] = x;
    rear++;
  }

  int dequeue() {
    if (front == rear) throw new RuntimeException("empty");
    int x = data[front];
    data[front] = 0;
    front++;
    return x;
  }
}
` },
      { name: "queue: circular array", tabs: /circular/, code: `public class Main {
  public static void main(String[] args) {
    CircularQueue queue = new CircularQueue(4);
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueue(4);
    System.out.println("dequeue() = " + queue.dequeue());
    queue.enqueue(5);
    System.out.println("first() = " + queue.first());
  }
}

class CircularQueue {
  int[] data;
  int front = 0, size = 0;

  CircularQueue(int capacity) {
    data = new int[capacity];
  }

  void enqueue(int x) {
    if (size == data.length) throw new IllegalStateException("full");
    int avail = (front + size) % data.length;
    data[avail] = x;
    size++;
  }

  int dequeue() {
    if (size == 0) throw new RuntimeException("empty");
    int x = data[front];
    data[front] = 0;
    front = (front + 1) % data.length;
    size--;
    return x;
  }

  int first() {
    if (size == 0) throw new RuntimeException("empty");
    return data[front];
  }
}
` },
      { name: "deque: circular array", tabs: /Deque/, code: `public class Main {
  public static void main(String[] args) {
    CircularDeque deque = new CircularDeque(4);
    deque.addLast(2);
    deque.addFirst(1);
    deque.addLast(3);
    System.out.println("removeFirst() = " + deque.removeFirst());
    System.out.println("removeLast() = " + deque.removeLast());
  }
}

class CircularDeque {
  int[] data;
  int front = 0, size = 0;

  CircularDeque(int capacity) {
    data = new int[capacity];
  }

  void addFirst(int x) {
    if (size == data.length) throw new IllegalStateException("full");
    front = (front - 1 + data.length) % data.length;
    data[front] = x;
    size++;
  }

  void addLast(int x) {
    if (size == data.length) throw new IllegalStateException("full");
    int avail = (front + size) % data.length;
    data[avail] = x;
    size++;
  }

  int removeFirst() {
    if (size == 0) throw new RuntimeException("empty");
    int x = data[front];
    data[front] = 0;
    front = (front + 1) % data.length;
    size--;
    return x;
  }

  int removeLast() {
    if (size == 0) throw new RuntimeException("empty");
    int back = (front + size - 1) % data.length;
    int x = data[back];
    data[back] = 0;
    size--;
    return x;
  }
}
` },
      { name: "applications: brackets and postfix", tabs: /Applications/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    System.out.println(isBalanced("{[()]}"));
    System.out.println(isBalanced("(]"));
    System.out.println(evalPostfix(new String[] {"3", "4", "+", "2", "*"}));
  }

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

  static double evalPostfix(String[] tokens) {
    Deque<Double> st = new ArrayDeque<>();
    for (String t : tokens) {
      if (isNumber(t)) {
        st.push(Double.parseDouble(t));
      } else {
        double b = st.pop();
        double a = st.pop();
        st.push(apply(t, a, b));
      }
    }
    return st.pop();
  }

  // "-3" and "2.5" end in a digit; an operator such as "-" doesn't
  static boolean isNumber(String t) {
    return Character.isDigit(t.charAt(t.length() - 1));
  }

  static double apply(String op, double a, double b) {
    if (op.equals("+")) return a + b;
    if (op.equals("-")) return a - b;
    if (op.equals("*")) return a * b;
    if (op.equals("/")) return a / b;
    if (op.equals("%")) return a % b;
    if (op.equals("^")) return Math.pow(a, b);
    throw new IllegalArgumentException("unknown operator " + op);
  }
}
` },
    ],

    trees: [
      { name: "traversals", tabs: /Traversals/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    Node root = new Node(50);
    root.left = new Node(25);
    root.right = new Node(75);
    root.left.right = new Node(37);
    preorder(root);
    System.out.println();
    inorder(root);
    System.out.println();
    postorder(root);
    System.out.println();
    levelorder(root);
    System.out.println();
    System.out.println("height = " + height(root));
    System.out.println("size = " + size(root));
  }

  static void preorder(Node n) {
    if (n == null) return;
    visit(n);
    preorder(n.left);
    preorder(n.right);
  }

  static void inorder(Node n) {
    if (n == null) return;
    inorder(n.left);
    visit(n);
    inorder(n.right);
  }

  static void postorder(Node n) {
    if (n == null) return;
    postorder(n.left);
    postorder(n.right);
    visit(n);
  }

  static void levelorder(Node root) {
    Queue<Node> q = new LinkedList<>();
    q.add(root);
    while (!q.isEmpty()) {
      Node n = q.remove();
      visit(n);
      if (n.left != null) q.add(n.left);
      if (n.right != null) q.add(n.right);
    }
  }

  static int height(Node n) {
    if (n == null) return -1;
    return 1 + Math.max(height(n.left), height(n.right));
  }

  static int size(Node n) {
    if (n == null) return 0;
    return 1 + size(n.left) + size(n.right);
  }

  static void visit(Node n) {
    System.out.print(n.key + " ");
  }
}

class Node {
  int key;
  Node left, right;

  Node(int key) {
    this.key = key;
  }
}
` },
      { name: "BST: iterative", tabs: /Binary Search/, code: `public class Main {
  public static void main(String[] args) {
    BinarySearchTree tree = new BinarySearchTree();
    for (int k : new int[] {50, 30, 70, 20, 40}) {
      tree.insert(k);
    }
    System.out.println("search(40) found: " + (tree.search(40) != null));
    System.out.println("predecessor(50) = " + tree.predecessor(50).key);
    System.out.println("successor(40) = " + tree.successor(40).key);
    tree.delete(30);
    System.out.println("search(30) found: " + (tree.search(30) != null));
  }
}

class Node {
  int key;
  Node left, right, parent;

  Node(int key, Node parent) {
    this.key = key;
    this.parent = parent;
  }
}

class BinarySearchTree {
  Node root;

  Node search(int k) {
    Node n = root;
    while (n != null) {
      if (k == n.key) return n;
      n = (k < n.key) ? n.left : n.right;
    }
    return null;
  }

  void insert(int k) {
    if (root == null) {
      root = new Node(k, null);
      return;
    }
    Node n = root;
    while (k != n.key) {
      if (k < n.key) {
        if (n.left == null) n.left = new Node(k, n);
        n = n.left;
      } else {
        if (n.right == null) n.right = new Node(k, n);
        n = n.right;
      }
    }
  }

  void delete(int k) {
    Node n = search(k);
    if (n == null) return;
    if (n.left != null && n.right != null) {
      Node s = n.right;   // the successor; n.left's rightmost node also works
      while (s.left != null) s = s.left;
      n.key = s.key;
      n = s;
    }
    Node child = (n.left != null) ? n.left : n.right;
    if (child != null) child.parent = n.parent;
    replaceChild(n.parent, n, child);
  }

  void replaceChild(Node p, Node old, Node fresh) {
    if (p == null) root = fresh;
    else if (p.left == old) p.left = fresh;
    else p.right = fresh;
  }

  Node predecessor(int k) {
    Node n = search(k);
    if (n == null) return null;
    if (n.left != null) {
      n = n.left;
      while (n.right != null) n = n.right;
      return n;
    }
    Node p = n.parent;
    while (p != null && n == p.left) {
      n = p;
      p = p.parent;
    }
    return p;
  }

  Node successor(int k) {
    Node n = search(k);
    if (n == null) return null;
    if (n.right != null) {
      n = n.right;
      while (n.left != null) n = n.left;
      return n;
    }
    Node p = n.parent;
    while (p != null && n == p.right) {
      n = p;
      p = p.parent;
    }
    return p;
  }
}
` },
      { name: "BST: recursive", code: `public class Main {
  public static void main(String[] args) {
    Node root = null;
    for (int k : new int[] {50, 30, 70, 60, 80}) {
      root = insert(root, k);
    }
    System.out.println("search(60) found: " + (search(root, 60) != null));
    System.out.println("min = " + min(root).key + ", max = " + max(root).key);
    root = delete(root, 70);
    System.out.println("search(70) found: " + (search(root, 70) != null));
  }

  static Node search(Node n, int k) {
    if (n == null) return null;
    if (k == n.key) return n;
    if (k < n.key) return search(n.left, k);
    return search(n.right, k);
  }

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
      Node s = min(n.right);   // or max(n.left), then delete from n.left
      n.key = s.key;
      n.right = delete(n.right, s.key);
    }
    return n;
  }

  static Node min(Node n) {
    while (n.left != null) n = n.left;
    return n;
  }

  static Node max(Node n) {
    while (n.right != null) n = n.right;
    return n;
  }
}

class Node {
  int key;
  Node left, right;

  Node(int key) {
    this.key = key;
  }
}
` },
      { name: "AVL tree", tabs: /AVL/, code: `public class Main {
  public static void main(String[] args) {
    AVLTree tree = new AVLTree();
    for (int k : new int[] {10, 20, 30, 25, 28}) {
      tree.insert(k);
    }
    System.out.println("root = " + tree.root.key);
    System.out.println("search(25) found: " + (tree.search(25) != null));
    System.out.println("predecessor(28) = " + tree.predecessor(28).key);
    System.out.println("successor(25) = " + tree.successor(25).key);
    tree.delete(10);
    System.out.println("root = " + tree.root.key);
  }
}

class Node {
  int key, height = 1;
  Node left, right, parent;

  Node(int key, Node parent) {
    this.key = key;
    this.parent = parent;
  }
}

class AVLTree {
  Node root;

  void insert(int k) {
    Node n = bstInsert(k);
    rebalance(n.parent);
  }

  void delete(int k) {
    rebalance(bstDelete(k));
  }

  void rebalance(Node n) {
    while (n != null) {
      updateHeight(n);
      int b = bf(n);
      if (b > 1) {
        if (bf(n.left) < 0) rotateLeft(n.left);
        n = rotateRight(n);
      } else if (b < -1) {
        if (bf(n.right) > 0) rotateRight(n.right);
        n = rotateLeft(n);
      }
      n = n.parent;
    }
  }

  Node rotateRight(Node y) {
    Node x = y.left;
    y.left = x.right;
    if (x.right != null) x.right.parent = y;
    x.parent = y.parent;
    replaceChild(y.parent, y, x);
    x.right = y;
    y.parent = x;
    updateHeight(y);
    updateHeight(x);
    return x;
  }

  Node rotateLeft(Node x) {
    Node y = x.right;
    x.right = y.left;
    if (y.left != null) y.left.parent = x;
    y.parent = x.parent;
    replaceChild(x.parent, x, y);
    y.left = x;
    x.parent = y;
    updateHeight(x);
    updateHeight(y);
    return y;
  }

  int height(Node n) {
    return n == null ? 0 : n.height;
  }

  void updateHeight(Node n) {
    n.height = 1 + Math.max(height(n.left), height(n.right));
  }

  int bf(Node n) {   // above 0 leans left, below 0 leans right
    return height(n.left) - height(n.right);
  }

  Node search(int k) {
    Node n = root;
    while (n != null) {
      if (k == n.key) return n;
      n = (k < n.key) ? n.left : n.right;
    }
    return null;
  }

  Node bstInsert(int k) {   // returns the new leaf
    if (root == null) {
      root = new Node(k, null);
      return root;
    }
    Node n = root;
    while (k != n.key) {
      if (k < n.key) {
        if (n.left == null) {
          n.left = new Node(k, n);
          return n.left;
        }
        n = n.left;
      } else {
        if (n.right == null) {
          n.right = new Node(k, n);
          return n.right;
        }
        n = n.right;
      }
    }
    return n;
  }

  Node bstDelete(int k) {   // returns the removed node's parent
    Node n = search(k);
    if (n == null) return null;
    if (n.left != null && n.right != null) {
      Node s = n.right;
      while (s.left != null) s = s.left;
      n.key = s.key;
      n = s;
    }
    Node child = (n.left != null) ? n.left : n.right;
    if (child != null) child.parent = n.parent;
    replaceChild(n.parent, n, child);
    return n.parent;
  }

  void replaceChild(Node p, Node old, Node fresh) {
    if (p == null) root = fresh;
    else if (p.left == old) p.left = fresh;
    else p.right = fresh;
  }

  Node predecessor(int k) {
    Node n = search(k);
    if (n == null) return null;
    if (n.left != null) {
      n = n.left;
      while (n.right != null) n = n.right;
      return n;
    }
    Node p = n.parent;
    while (p != null && n == p.left) {
      n = p;
      p = p.parent;
    }
    return p;
  }

  Node successor(int k) {
    Node n = search(k);
    if (n == null) return null;
    if (n.right != null) {
      n = n.right;
      while (n.left != null) n = n.left;
      return n;
    }
    Node p = n.parent;
    while (p != null && n == p.right) {
      n = p;
      p = p.parent;
    }
    return p;
  }
}
` },
      { name: "(2,4)-tree and B-tree", tabs: /\(2,4\)|B-Tree/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    BTree tree = new BTree(4);   // order 4 is a (2,4)-tree; try 5 for a larger B-tree
    for (int k : new int[] {10, 20, 30, 40, 50, 60, 70}) {
      tree.insert(k);
    }
    System.out.println("search(40) found: " + (tree.search(40) != null));
    tree.delete(70);
    tree.delete(60);
    tree.delete(30);
    System.out.println("search(30) found: " + (tree.search(30) != null));
    System.out.println("root keys = " + tree.root.keys);
  }
}

class BNode {
  List<Integer> keys = new ArrayList<>();
  List<BNode> kids = new ArrayList<>();   // empty for a leaf
  BNode parent;

  boolean isLeaf() {
    return kids.isEmpty();
  }

  int lastKey() {
    return keys.get(keys.size() - 1);
  }

  // keep the left part; the right part becomes a new node
  BNode splitAfter(int mid) {
    BNode right = new BNode();
    while (keys.size() > mid + 1) {
      right.keys.add(keys.remove(mid + 1));
    }
    keys.remove(mid);   // this key is moving up to the parent
    while (kids.size() > mid + 1) {
      BNode kid = kids.remove(mid + 1);
      kid.parent = right;
      right.kids.add(kid);
    }
    return right;
  }

  void insertKeyAndChild(int key, BNode child) {
    int i = BTree.sortedPos(keys, key);
    keys.add(i, key);
    kids.add(i + 1, child);
    child.parent = this;
  }

  boolean canBorrowFromSibling(int min) {
    int i = parent.kids.indexOf(this);
    return (i > 0 && parent.kids.get(i - 1).keys.size() > min)
        || (i < parent.kids.size() - 1 && parent.kids.get(i + 1).keys.size() > min);
  }

  // a rotation through the parent; left sibling first
  void transfer(int min) {
    int i = parent.kids.indexOf(this);
    if (i > 0 && parent.kids.get(i - 1).keys.size() > min) {
      BNode s = parent.kids.get(i - 1);
      keys.add(0, parent.keys.get(i - 1));
      parent.keys.set(i - 1, s.keys.remove(s.keys.size() - 1));
      if (!s.isLeaf()) {
        BNode kid = s.kids.remove(s.kids.size() - 1);
        kid.parent = this;
        kids.add(0, kid);
      }
    } else {
      BNode s = parent.kids.get(i + 1);
      keys.add(parent.keys.get(i));
      parent.keys.set(i, s.keys.remove(0));
      if (!s.isLeaf()) {
        BNode kid = s.kids.remove(0);
        kid.parent = this;
        kids.add(kid);
      }
    }
  }

  // merge with a neighbour and the key between them; returns the parent
  BNode fuseWithSibling() {
    int i = parent.kids.indexOf(this);
    int left = i > 0 ? i - 1 : i;
    BNode a = parent.kids.get(left);
    BNode b = parent.kids.get(left + 1);
    a.keys.add(parent.keys.remove(left));
    for (int k : b.keys) {
      a.keys.add(k);
    }
    for (BNode kid : b.kids) {
      kid.parent = a;
      a.kids.add(kid);
    }
    parent.kids.remove(left + 1);
    return parent;
  }
}

class Entry {   // where search found a key: node.keys.get(i)
  BNode node;
  int i;

  Entry(BNode node, int i) {
    this.node = node;
    this.i = i;
  }
}

class BTree {
  int M;     // the most children a node may have
  int MIN;   // the fewest keys a non-root node may hold
  BNode root;

  BTree(int order) {
    M = order;
    MIN = (order + 1) / 2 - 1;
  }

  Entry search(int k) {
    BNode n = root;
    while (n != null) {
      int i = sortedPos(n.keys, k);
      if (i < n.keys.size() && k == n.keys.get(i)) return new Entry(n, i);
      if (n.isLeaf()) return null;
      n = n.kids.get(i);
    }
    return null;
  }

  void insert(int k) {
    if (search(k) != null) return;
    BNode n = findLeaf(k);
    n.keys.add(sortedPos(n.keys, k), k);
    while (n.keys.size() > M - 1) {
      int mid = n.keys.size() / 2;
      int up = n.keys.get(mid);
      BNode right = n.splitAfter(mid);
      if (n.parent == null) {
        root = new BNode();
        root.kids.add(n);
        n.parent = root;
        root.keys.add(up);
        root.kids.add(right);
        right.parent = root;
        return;
      }
      n.parent.insertKeyAndChild(up, right);
      n = n.parent;
    }
  }

  void delete(int k) {
    Entry e = search(k);
    if (e == null) return;
    BNode n = e.node;
    int i = e.i;
    if (!n.isLeaf()) {
      BNode p = maxLeaf(n.kids.get(i));
      n.keys.set(i, p.lastKey());
      n = p;
      i = p.keys.size() - 1;
    }
    n.keys.remove(i);
    while (n != root && n.keys.size() < MIN) {
      if (n.canBorrowFromSibling(MIN)) {
        n.transfer(MIN);
        break;
      }
      n = n.fuseWithSibling();
    }
    if (root.keys.isEmpty() && !root.isLeaf()) {
      root = root.kids.get(0);
      root.parent = null;
    }
  }

  BNode findLeaf(int k) {
    if (root == null) root = new BNode();
    BNode n = root;
    while (!n.isLeaf()) {
      n = n.kids.get(sortedPos(n.keys, k));
    }
    return n;
  }

  static int sortedPos(List<Integer> keys, int k) {   // how many keys are smaller than k
    int i = 0;
    while (i < keys.size() && keys.get(i) < k) i++;
    return i;
  }

  BNode maxLeaf(BNode n) {
    while (!n.isLeaf()) {
      n = n.kids.get(n.kids.size() - 1);
    }
    return n;
  }
}
` },
    ],

    "priority-queues": [
      { name: "unsorted list", tabs: /Unsorted/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    UnsortedListPQ pq = new UnsortedListPQ();
    pq.insert(42);
    pq.insert(17);
    pq.insert(58);
    System.out.println("min() = " + pq.min());
    System.out.println("removeMin() = " + pq.removeMin());
    System.out.println("isEmpty() = " + pq.isEmpty());
  }
}

class UnsortedListPQ {
  ArrayList<Integer> list = new ArrayList<>();

  void insert(int k) {
    list.add(k);
  }

  int min() {
    if (list.isEmpty()) throw new RuntimeException("empty");
    int best = list.get(0);
    for (int k : list) {
      if (k < best) best = k;
    }
    return best;
  }

  int removeMin() {
    if (list.isEmpty()) throw new RuntimeException("empty");
    int b = 0;
    for (int i = 1; i < list.size(); i++) {
      if (list.get(i) < list.get(b)) b = i;
    }
    return list.remove(b);
  }

  boolean isEmpty() {
    return list.isEmpty();
  }
}
` },
      { name: "sorted list", tabs: /Sorted/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    SortedListPQ pq = new SortedListPQ();
    pq.insert(42);
    pq.insert(17);
    pq.insert(58);
    System.out.println("min() = " + pq.min());
    System.out.println("removeMin() = " + pq.removeMin());
    System.out.println("isEmpty() = " + pq.isEmpty());
  }
}

class SortedListPQ {
  ArrayList<Integer> list = new ArrayList<>();   // smallest first

  void insert(int k) {
    int i = list.size();
    while (i > 0 && list.get(i - 1) > k) {
      i--;
    }
    list.add(i, k);
  }

  int min() {
    if (list.isEmpty()) throw new RuntimeException("empty");
    return list.get(0);
  }

  int removeMin() {
    if (list.isEmpty()) throw new RuntimeException("empty");
    return list.remove(0);
  }

  boolean isEmpty() {
    return list.isEmpty();
  }
}
` },
      { name: "array heap", tabs: /Array-based/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    HeapPQ pq = new HeapPQ();
    pq.insert(9);
    pq.insert(4);
    pq.insert(1);
    System.out.println("min() = " + pq.min());
    System.out.println("removeMin() = " + pq.removeMin());
    System.out.println("isEmpty() = " + pq.isEmpty());
    pq.heapify(new int[] {5, 3, 8, 1});
    System.out.println("heapify: " + pq.heap);
    pq.buildByInsertion(new int[] {5, 3, 8, 1});
    System.out.println("by insertion: " + pq.heap);
  }
}

class HeapPQ {
  ArrayList<Integer> heap = new ArrayList<>();   // heap.get(0) is the minimum

  void insert(int k) {
    heap.add(k);
    upHeap(heap.size() - 1);
  }

  int removeMin() {
    if (heap.isEmpty()) throw new RuntimeException("empty");
    int min = heap.get(0);
    int last = heap.remove(heap.size() - 1);
    if (!heap.isEmpty()) {
      heap.set(0, last);
      downHeap(0);
    }
    return min;
  }

  void upHeap(int j) {
    while (j > 0) {
      int p = (j - 1) / 2;
      if (heap.get(j) >= heap.get(p)) break;
      swap(j, p);
      j = p;
    }
  }

  void downHeap(int j) {
    int n = heap.size();
    while (2 * j + 1 < n) {
      int c = 2 * j + 1;
      if (c + 1 < n && heap.get(c + 1) < heap.get(c)) c++;
      if (heap.get(c) >= heap.get(j)) break;
      swap(j, c);
      j = c;
    }
  }

  void swap(int i, int j) {
    int t = heap.get(i);
    heap.set(i, heap.get(j));
    heap.set(j, t);
  }

  int min() {
    if (heap.isEmpty()) throw new RuntimeException("empty");
    return heap.get(0);
  }

  void heapify(int[] a) {
    heap.clear();
    for (int x : a) {
      heap.add(x);
    }
    for (int j = heap.size() / 2 - 1; j >= 0; j--) {
      downHeap(j);
    }
  }

  void buildByInsertion(int[] a) {
    heap.clear();
    for (int x : a) {
      insert(x);
    }
  }

  boolean isEmpty() {
    return heap.isEmpty();
  }
}
` },
      { name: "tree heap", tabs: /Tree-based/, code: `public class Main {
  public static void main(String[] args) {
    LinkedHeapPQ pq = new LinkedHeapPQ();
    for (int k : new int[] {7, 3, 5, 1, 4}) {
      pq.insert(k);
    }
    System.out.println("min() = " + pq.min());
    System.out.println("removeMin() = " + pq.removeMin());
    System.out.println("isEmpty() = " + pq.isEmpty());
  }
}

class Node {
  int key;
  Node left, right, parent;

  Node(int key) {
    this.key = key;
  }
}

class LinkedHeapPQ {
  Node root;
  int n = 0;

  void insert(int k) {
    Node node = new Node(k);
    n++;
    if (n == 1) {
      root = node;
      return;
    }
    Node parent = nodeAt(n / 2);
    if (n % 2 == 0) parent.left = node;
    else parent.right = node;
    node.parent = parent;
    while (node.parent != null && node.key < node.parent.key) {
      swapKeys(node, node.parent);
      node = node.parent;
    }
  }

  // position 1 is the root; the bits after the leading 1 are the turns: 0 left, 1 right
  Node nodeAt(int pos) {
    Node cur = root;
    int bit = Integer.highestOneBit(pos) >> 1;
    while (bit > 0) {
      cur = (pos & bit) == 0 ? cur.left : cur.right;
      bit = bit >> 1;
    }
    return cur;
  }

  int removeMin() {
    if (n == 0) throw new RuntimeException("empty");
    int min = root.key;
    Node last = nodeAt(n);
    root.key = last.key;
    if (n == 1) root = null;
    else if (n % 2 == 0) last.parent.left = null;
    else last.parent.right = null;
    n--;
    Node cur = root;
    while (cur != null && cur.left != null) {
      Node c = cur.left;
      if (cur.right != null && cur.right.key < c.key) c = cur.right;
      if (c.key >= cur.key) break;
      swapKeys(cur, c);
      cur = c;
    }
    return min;
  }

  void swapKeys(Node a, Node b) {
    int t = a.key;
    a.key = b.key;
    b.key = t;
  }

  int min() {
    if (root == null) throw new RuntimeException("empty");
    return root.key;
  }

  boolean isEmpty() {
    return n == 0;
  }
}
` },
      { name: "PQ-sort", tabs: /PQ-Sort/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    show("selection sort", new UnsortedPQ());
    show("insertion sort", new SortedPQ());
    show("heap sort", new HeapPQ());
  }

  static void show(String name, PQ p) {
    Deque<Integer> s = new ArrayDeque<>();
    for (int x : new int[] {5, 2, 9, 1}) {
      s.addLast(x);
    }
    pqSort(s, p);
    System.out.println(name + ": " + s);
  }

  // one algorithm: the PQ you pass in decides which sort it is
  static void pqSort(Deque<Integer> s, PQ p) {
    while (!s.isEmpty()) {
      p.insert(s.removeFirst());
    }
    while (!p.isEmpty()) {
      s.addLast(p.removeMin());
    }
  }
}

class PQ {
  ArrayList<Integer> list = new ArrayList<>();

  void insert(int k) {
    list.add(k);
  }

  int removeMin() {
    int b = 0;
    for (int i = 1; i < list.size(); i++) {
      if (list.get(i) < list.get(b)) b = i;
    }
    return list.remove(b);
  }

  boolean isEmpty() {
    return list.isEmpty();
  }
}

class UnsortedPQ extends PQ {
}

class SortedPQ extends PQ {
  void insert(int k) {
    int i = list.size();
    while (i > 0 && list.get(i - 1) > k) {
      i--;
    }
    list.add(i, k);
  }

  int removeMin() {
    return list.remove(0);
  }
}

class HeapPQ extends PQ {
  PriorityQueue<Integer> heap = new PriorityQueue<>();   // the "array heap" program builds one by hand

  void insert(int k) {
    heap.add(k);
  }

  int removeMin() {
    return heap.poll();
  }

  boolean isEmpty() {
    return heap.isEmpty();
  }
}
` },
    ],

    hashtables: [
      { name: "separate chaining", tabs: /chaining/, code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    ChainingHashTable t = new ChainingHashTable(5);
    t.put(7);
    t.put(12);
    t.put(3);
    System.out.println("get(12) = " + t.get(12));
    System.out.println("get(8) = " + t.get(8));
    t.remove(12);
    System.out.println("get(12) = " + t.get(12));
    t.put(17);
    t.put(22);
    t.put(4);   // the table is now too full, so put calls rehash
    System.out.println("buckets = " + t.m);
  }
}

class Node {
  int key;
  Node next;

  Node(int key, Node next) {
    this.key = key;
    this.next = next;
  }
}

class ChainingHashTable {
  static final double MAX_LOAD = 0.9;
  Node[] table;
  int m;
  int n = 0;

  ChainingHashTable(int m) {
    this.m = m;
    table = newTable(m);
  }

  void put(int k) {
    int b = Math.floorMod(hash(k), m);
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key == k) return;
    }
    table[b] = new Node(k, table[b]);
    n++;
    if ((double) n / m > MAX_LOAD) rehash();
  }

  boolean get(int k) {
    int b = Math.floorMod(hash(k), m);
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key == k) return true;
    }
    return false;
  }

  void remove(int k) {
    int b = Math.floorMod(hash(k), m);
    Node prev = null;
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key == k) {
        if (prev == null) table[b] = c.next;
        else prev.next = c.next;
        n--;
        return;
      }
      prev = c;
    }
  }

  void rehash() {
    Node[] old = table;
    m = nextPrime(2 * m + 1);
    table = newTable(m);
    n = 0;
    for (int k : keysOf(old)) {
      put(k);
    }
  }

  Node[] newTable(int size) {
    return new Node[size];
  }

  List<Integer> keysOf(Node[] old) {
    List<Integer> keys = new ArrayList<>();
    for (Node bucket : old) {
      for (Node c = bucket; c != null; c = c.next) {
        keys.add(c.key);
      }
    }
    return keys;
  }

  static int nextPrime(int x) {
    while (!isPrime(x)) x++;
    return x;
  }

  static boolean isPrime(int x) {
    if (x < 2) return false;
    for (int d = 2; d * d <= x; d++) {
      if (x % d == 0) return false;
    }
    return true;
  }

  static int hash(int k) {
    return k;
  }
}
` },
      { name: "linear probing", tabs: /Linear/, code: probingProgram("LinearProbingTable", "i") },
      { name: "quadratic probing", tabs: /Quadratic/, code: probingProgram("QuadraticProbingTable", "i * i") },
      { name: "String keys", code: `public class Main {
  public static void main(String[] args) {
    System.out.println("hash(abc) = " + StringTable.hash("abc"));
    StringTable t = new StringTable(5);
    t.put("apple");
    t.put("kiwi");
    System.out.println("get(kiwi) = " + t.get("kiwi"));
    t.remove("kiwi");
    System.out.println("get(kiwi) = " + t.get("kiwi"));
  }
}

class Node {
  String key;
  Node next;

  Node(String key, Node next) {
    this.key = key;
    this.next = next;
  }
}

// the integer-key tables work the same way: only hash changes
class StringTable {
  Node[] table;
  int m;

  StringTable(int m) {
    this.m = m;
    table = new Node[m];
  }

  static int hash(String s) {
    int h = 0;
    for (int i = 0; i < s.length(); i++) {
      h = 31 * h + s.charAt(i);
    }
    return h;
  }

  void put(String k) {
    int b = Math.floorMod(hash(k), m);
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key.equals(k)) return;
    }
    table[b] = new Node(k, table[b]);
  }

  boolean get(String k) {
    int b = Math.floorMod(hash(k), m);
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key.equals(k)) return true;
    }
    return false;
  }

  void remove(String k) {
    int b = Math.floorMod(hash(k), m);
    Node prev = null;
    for (Node c = table[b]; c != null; c = c.next) {
      if (c.key.equals(k)) {
        if (prev == null) table[b] = c.next;
        else prev.next = c.next;
        return;
      }
      prev = c;
    }
  }
}
` },
    ],

    graphs: [
      { name: "graph: all functions", code: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    Graph g = new Graph(6);
    g.addEdge(0, 1);
    g.addEdge(0, 2);
    g.addEdge(1, 3);
    g.addEdge(2, 3);
    g.addEdge(4, 5);
    g.removeEdge(2, 3);
    g.bfs(0);
    System.out.println("dist = " + Arrays.toString(g.dist));
    g.dfs(0);
    g.dfsForest();
    System.out.println("discovered = " + Arrays.toString(g.d));
    System.out.println("finished = " + Arrays.toString(g.f));
  }
}

class Graph {
  static final int WHITE = 0, GREY = 1, BLACK = 2;
  int n;
  List<List<Integer>> adj = new ArrayList<>();
  boolean[] seen;
  int[] dist, parent;      // used by bfs
  int[] color, d, f;       // used by dfs
  int time = 0;

  Graph(int n) {
    this.n = n;
    for (int u = 0; u < n; u++) {
      adj.add(new ArrayList<>());
    }
    seen = new boolean[n];
    dist = new int[n];
    parent = new int[n];
    color = new int[n];
    d = new int[n];
    f = new int[n];
  }

  void addEdge(int u, int v) {
    adj.get(u).add(v);
    adj.get(v).add(u);
  }

  void removeEdge(int u, int v) {
    adj.get(u).remove(adj.get(u).indexOf(v));
    adj.get(v).remove(adj.get(v).indexOf(u));
  }

  void bfs(int s) {
    seen[s] = true;
    Queue<Integer> q = new LinkedList<>();
    q.add(s);
    while (!q.isEmpty()) {
      int u = q.remove();
      for (int v : adj.get(u)) {
        if (!seen[v]) {
          dist[v] = dist[u] + 1;
          parent[v] = u;
          seen[v] = true;
          q.add(v);
        }
      }
    }
  }

  void dfs(int u) {
    color[u] = GREY;
    time++;
    d[u] = time;
    for (int v : adj.get(u)) {
      if (color[v] == WHITE) {
        dfs(v);
      }
    }
    color[u] = BLACK;
    time++;
    f[u] = time;
  }

  void dfsForest() {
    for (int u = 0; u < n; u++) {
      if (color[u] == WHITE) {
        dfs(u);
      }
    }
  }
}
` },
      { name: "BFS only", code: `import java.util.*;

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
      { name: "DFS only", code: `public class Main {
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
      { name: "heap sort", tabs: /Heap/, code: sortProgram(`  static void heapSort(int[] a) {
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

  static void downHeap(int[] a, int i, int size) {
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
`, "heapSort(data)") },
      { name: "merge sort", tabs: /Merge/, code: sortProgram(`  static void mergeSort(int[] a, int lo, int hi) {
    if (lo >= hi) return;
    int mid = (lo + hi) / 2;
    mergeSort(a, lo, mid);
    mergeSort(a, mid + 1, hi);
    merge(a, lo, mid, hi);
  }

  static void merge(int[] a, int lo, int mid, int hi) {
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
      { name: "quick sort", tabs: /Quick/, code: sortProgram(`  static void quickSort(int[] a, int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(a, lo, hi);
    quickSort(a, lo, p - 1);
    quickSort(a, p + 1, hi);
  }

  static int partition(int[] a, int lo, int hi) {
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
    int lo = min(a), hi = max(a);
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

  static int min(int[] a) {
    int m = a[0];
    for (int x : a) {
      m = Math.min(m, x);
    }
    return m;
  }

  static int max(int[] a) {
    int m = a[0];
    for (int x : a) {
      m = Math.max(m, x);
    }
    return m;
  }
`, "countingSort(data)", "3, 1, 2, 3, 0, 1") },
    ],
  };
})();
